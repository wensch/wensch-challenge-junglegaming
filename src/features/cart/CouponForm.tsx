/**
 * Promo code (Figma "Código promocional" + "Aplicar"). react-hook-form + the contract schema
 * (`applyCouponRequestSchema`: trim, 1..32 chars, upper-cased). API errors become the field error:
 * COUPON_INVALID / COUPON_EXPIRED / VALIDATION. Applied code is shown with a "Remover" action.
 */
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { applyCouponRequestSchema, isApiError, type ApplyCouponRequest } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { applyFieldErrors } from '@/features/shared/forms'
import { useApplyCoupon, useRemoveCoupon } from '@/queries/cart-mutations'
import { cn } from '@/lib/utils'

function couponErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.is('COUPON_EXPIRED')) return `O cupom ${error.payload.couponCode} expirou.`
    if (error.is('COUPON_INVALID')) return `O cupom ${error.payload.couponCode} é inválido.`
    if (error.is('TRANSIENT')) return 'Não foi possível aplicar o cupom agora. Tente novamente.'
  }
  return 'Não foi possível aplicar o cupom.'
}

export function CouponForm({ appliedCode, appliedLabel, onMessage }: { appliedCode: string | null; appliedLabel: string | null; onMessage: (text: string) => void }) {
  const id = useId()
  const errorId = `${id}-error`
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplyCouponRequest, unknown, { code: string }>({ resolver: zodResolver(applyCouponRequestSchema), defaultValues: { code: '' } })

  const submit = handleSubmit(async ({ code }) => {
    try {
      await apply.mutateAsync({ code })
      reset({ code: '' })
      onMessage(`Cupom ${code} aplicado.`)
    } catch (error) {
      if (isApiError(error) && error.is('VALIDATION') && applyFieldErrors(error, setError, ['code']).length === 0) return
      setError('code', { type: 'server', message: couponErrorMessage(error) })
    }
  })

  const message = errors.code?.message

  return (
    <div data-testid="coupon">
      {appliedCode ? (
        <p className="text-body-sm font-bold text-text-primary">Cupom aplicado</p>
      ) : (
        <label htmlFor={`${id}-input`} className="text-body-sm font-bold text-text-primary">
          Código promocional
        </label>
      )}
      {appliedCode ? (
        <div className="mt-2 flex h-10 items-center justify-between gap-3 rounded-control border border-line-soft bg-surface-card px-3">
          <p className="min-w-0 truncate text-body-sm text-text-primary" data-testid="coupon-applied">
            <span className="font-bold text-text-accent">{appliedCode}</span>
            {appliedLabel ? <span className="text-text-secondary"> · {appliedLabel}</span> : null}
          </p>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => onMessage('Cupom removido.'),
                onError: () => onMessage('Não foi possível remover o cupom. Tente novamente.'),
              })
            }
            className="flex items-center gap-1 text-caption-sm text-text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50"
            aria-label={`Remover cupom ${appliedCode}`}
          >
            <X aria-hidden="true" className="size-3.5" /> Remover
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="mt-2">
          <div className={cn('flex h-10 overflow-hidden rounded-control border bg-transparent', message ? 'border-destructive' : 'border-line-soft')}>
            <input
              id={`${id}-input`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Digite o código promocional..."
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? errorId : undefined}
              className="min-w-0 flex-1 bg-transparent px-2 text-caption-sm text-text-primary outline-none placeholder:text-text-secondary focus-visible:bg-surface-card"
              {...register('code')}
            />
            <Button type="submit" disabled={isSubmitting || apply.isPending} className="h-10 w-[102px] rounded-none px-0 text-body-md font-bold">
              Aplicar
            </Button>
          </div>
          {message ? (
            <p id={errorId} role="alert" className="mt-1.5 text-caption-sm text-destructive">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
