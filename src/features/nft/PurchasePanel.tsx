/**
 * Edition chips, quantity stepper and buy/add/favorite actions (DET-3, DET-4).
 * - Sold-out editions are disabled chips with visible "esgotada" text (not only color).
 * - Quantity is a react-hook-form + zod field bounded by `min(available, maxPerOrder)`; API conflicts
 *   (CONFLICT_AVAILABILITY / VALIDATION) are mapped back to that field, with `aria-describedby`.
 */
import { useEffect, useId, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError, type Edition, type NftDetail } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { errorMessageOf } from '@/components/layout/PageStates'
import { useAddToCart } from '@/queries/cart-add'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './FavoriteButton'
import { NftPrice } from './NftCard'
import { toSummary } from '@/queries/favorites'

/** Units a single order may take of an edition. */
const maxQuantityOf = (edition: Edition): number => Math.min(edition.available, edition.maxPerOrder)

function limitMessage(edition: Edition): string {
  if (edition.available === 0) return 'Esta edição está esgotada.'
  return edition.available < edition.maxPerOrder
    ? `Só há ${edition.available} ${edition.available === 1 ? 'unidade disponível' : 'unidades disponíveis'}.`
    : `O limite é de ${edition.maxPerOrder} ${edition.maxPerOrder === 1 ? 'unidade' : 'unidades'} por pedido.`
}

function quantitySchema(edition: Edition) {
  const max = maxQuantityOf(edition)
  return z.object({
    quantity: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Informe uma quantidade inteira.')
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().int().min(1, 'A quantidade mínima é 1.').max(Math.max(max, 1), limitMessage(edition))),
  })
}
type QuantityInput = { quantity: string }
type QuantityOutput = { quantity: number }

export function EditionChips({ editions, selectedId, onSelect }: { editions: Edition[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div role="group" aria-labelledby="edition-label" className="flex flex-col gap-3">
      <p id="edition-label" className="text-body-sm font-bold text-text-primary">
        Edição:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {editions.map((edition) => {
          const selected = edition.id === selectedId
          const soldOut = edition.available === 0
          return (
            <button
              key={edition.id}
              type="button"
              aria-pressed={selected}
              disabled={soldOut && !selected}
              onClick={() => onSelect(edition.id)}
              className={cn(
                'h-7 rounded-full border px-3 text-caption-sm text-text-secondary transition-colors enabled:hover:border-primary',
                selected ? 'border-primary text-text-accent' : 'border-line-soft',
                soldOut && 'line-through',
              )}
            >
              {edition.label}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PurchasePanel({ nft, edition }: { nft: NftDetail; edition: Edition }) {
  const uid = useId()
  const navigate = useNavigate()
  const add = useAddToCart()
  const max = maxQuantityOf(edition)
  const unavailable = max === 0
  const resolver = useMemo(() => zodResolver<QuantityInput, unknown, QuantityOutput>(quantitySchema(edition)), [edition])
  const { register, handleSubmit, setValue, getValues, control, setError, clearErrors, trigger, formState } = useForm<QuantityInput, unknown, QuantityOutput>({
    resolver,
    mode: 'onChange',
    defaultValues: { quantity: '1' },
  })
  const error = formState.errors.quantity?.message
  const typed = parseInt(useWatch({ control, name: 'quantity' }), 10)
  const atMax = !Number.isNaN(typed) && typed >= max
  const atMin = !Number.isNaN(typed) && typed <= 1
  const serverError = formState.errors.root?.server?.message

  // The limit changes with the edition and with real-time stock: re-validate the current value.
  useEffect(() => {
    void trigger('quantity')
  }, [resolver, trigger])

  const step = (delta: number) => {
    const current = parseInt(getValues('quantity'), 10)
    const next = Math.min(Math.max((Number.isNaN(current) ? 1 : current) + delta, 1), Math.max(max, 1))
    setValue('quantity', String(next), { shouldValidate: true, shouldDirty: true })
    clearErrors('root.server')
  }

  const submit = (intent: 'add' | 'buy') =>
    handleSubmit(async ({ quantity }) => {
      clearErrors('root.server')
      try {
        await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity })
        toast.success(`${quantity} × ${nft.name} (${edition.label}) no carrinho.`)
        if (intent === 'buy') await navigate({ to: '/cart' })
      } catch (e) {
        if (isApiError(e) && e.is('CONFLICT_AVAILABILITY')) {
          const item = e.payload.items.find((i) => i.editionId === edition.id)
          const available = item?.available ?? edition.available
          setError('quantity', { type: 'server', message: available === 0 ? 'Esta edição esgotou.' : `Só há ${available} ${available === 1 ? 'unidade disponível' : 'unidades disponíveis'}.` })
        } else if (isApiError(e) && e.is('VALIDATION') && e.fieldErrors?.quantity?.[0]) {
          setError('quantity', { type: 'server', message: e.fieldErrors.quantity[0] })
        } else {
          setError('root.server', { type: 'server', message: errorMessageOf(e) })
        }
      }
    })

  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedBy = [error ? errorId : null, hintId].filter(Boolean).join(' ')

  return (
    <form onSubmit={(e) => void submit('add')(e)} noValidate aria-label="Comprar" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4 md:flex-nowrap">
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-text-secondary md:hidden" aria-hidden="true">
            Qtd.
          </span>
          <button
            type="button"
            aria-label="Diminuir quantidade"
            disabled={unavailable || atMin}
            onClick={() => step(-1)}
            className="grid size-[26px] place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 md:size-[33px]"
          >
            <Minus aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
          <label htmlFor={`${uid}-qty`} className="sr-only">
            Quantidade
          </label>
          <input
            id={`${uid}-qty`}
            inputMode="numeric"
            autoComplete="off"
            disabled={unavailable}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="h-8 w-10 rounded-control bg-transparent text-center text-body-lg font-bold text-text-primary aria-invalid:border aria-invalid:border-destructive disabled:opacity-50 md:text-heading"
            {...register('quantity', { onChange: () => clearErrors('root.server') })}
          />
          <button
            type="button"
            aria-label="Aumentar quantidade"
            disabled={unavailable || atMax}
            onClick={() => step(1)}
            className="grid size-[26px] place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 md:size-[33px]"
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <NftPrice price={edition.price} compareAtPrice={edition.compareAtPrice} className="text-body-lg md:hidden" />

        <div className="flex w-full items-center gap-2 md:w-auto">
          <Button
            type="button"
            disabled={unavailable || add.isPending}
            onClick={() => void submit('buy')()}
            className="h-[60px] flex-1 rounded-full text-body-lg font-bold md:h-10 md:w-[130px] md:flex-none md:rounded-control md:text-body-md"
          >
            <span className="md:hidden">Comprar NFT</span>
            <span className="hidden md:inline">COMPRAR</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={unavailable || add.isPending}
            aria-label="Adicionar ao carrinho"
            title="Adicionar ao carrinho"
            onClick={() => void submit('add')()}
            className="size-[60px] shrink-0 rounded-full border-line-soft bg-surface-card text-text-accent md:order-first md:size-10 md:rounded-control md:border-primary"
          >
            <ShoppingCart aria-hidden="true" className="size-5" />
          </Button>
          <FavoriteButton nft={toSummary(nft)} variant="button" className="hidden md:inline-flex" />
        </div>
      </div>

      <div className="min-h-5 text-caption-sm">
        <p id={hintId} className={cn('text-text-secondary', error && 'sr-only')}>
          {unavailable ? limitMessage(edition) : `Máximo de ${max} por pedido.`}
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-destructive">
            {serverError}
          </p>
        )}
      </div>
    </form>
  )
}
