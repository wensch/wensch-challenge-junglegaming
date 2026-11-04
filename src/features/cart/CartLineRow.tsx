/**
 * One cart line. Desktop (>= lg): table row of the Figma (70 px, columns NFT / Preço / Edições / Total / remover).
 * Below lg: card of the mobile frame (image on the left, stepper on the right). Same markup, two layouts.
 * All values (unit price, line total, availability) come from the cart/quote returned by the API.
 */
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { CartLine } from '@/api/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export interface CartLineRowProps {
  line: CartLine
  onQuantity: (line: CartLine, quantity: number) => void
  onRemove: (line: CartLine) => void
  onAcknowledge: (line: CartLine) => void
}

const stepBtn =
  'grid size-6 shrink-0 place-items-center rounded-full bg-brand text-ink outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40'

function LineNotice({ line, onAcknowledge }: { line: CartLine; onAcknowledge: (line: CartLine) => void }) {
  if (line.status === 'price_changed') {
    return (
      <p data-testid={`line-notice-${line.id}`} className="text-caption-sm text-text-accent">
        Preço alterado de {formatEth(line.addedUnitPrice)} para {formatEth(line.unitPrice)}.{' '}
        <button type="button" onClick={() => onAcknowledge(line)} className="underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          Aceitar novo preço
        </button>
      </p>
    )
  }
  if (line.status === 'sold_out') {
    return (
      <p data-testid={`line-notice-${line.id}`} className="text-caption-sm text-destructive">
        Esgotado: remova este item para continuar.
      </p>
    )
  }
  if (line.status === 'insufficient') {
    return (
      <p data-testid={`line-notice-${line.id}`} className="text-caption-sm text-destructive">
        Só {line.available === 1 ? 'resta 1 unidade' : `restam ${line.available} unidades`}: reduza a quantidade.
      </p>
    )
  }
  return null
}

export function CartLineRow({ line, onQuantity, onRemove, onAcknowledge }: CartLineRowProps) {
  const atMax = line.quantity >= line.maxQuantity
  const canDecrement = line.quantity > 1
  const nft = `${line.name}`
  return (
    <li
      data-testid="cart-line"
      data-line-id={line.id}
      className={cn(
        'relative flex min-h-[100px] items-stretch gap-3 overflow-hidden rounded-card bg-surface-card pr-4',
        'lg:grid lg:min-h-[70px] lg:grid-cols-[minmax(0,1fr)_110px_75px_110px_24px] lg:items-center lg:gap-x-6 xl:gap-x-10 lg:rounded-none lg:pr-6',
      )}
    >
      {/* NFT */}
      <div className="flex min-w-0 flex-1 items-center gap-4 lg:flex-none">
        <img src={line.image.src} alt={line.image.alt || nft} width={70} height={70} className="size-[100px] shrink-0 object-cover lg:size-[70px]" />
        <div className="flex min-w-0 flex-col gap-1 py-3 lg:py-0">
          <Link to="/nft/$id" params={{ id: line.nftId }} search={{ edition: line.editionId }} className="truncate text-body-md font-bold text-text-primary underline-offset-4 outline-none hover:underline focus-visible:underline">
            {nft}
          </Link>
          <p className="truncate text-caption-sm text-text-secondary">
            <span className="lg:hidden">Edição: {line.editionLabel}</span>
            <span className="hidden lg:inline">ID do token: {line.tokenId}</span>
          </p>
          <p data-testid="line-unit-price" className="text-body-lg font-bold text-text-accent lg:hidden">
            {formatEth(line.unitPrice)}
          </p>
          <LineNotice line={line} onAcknowledge={onAcknowledge} />
        </div>
      </div>

      {/* Preço (desktop) */}
      <p className="hidden whitespace-nowrap text-body-md font-bold text-text-accent lg:block">{formatEth(line.unitPrice)}</p>

      {/* Quantidade */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 self-end pb-3 lg:self-center lg:pb-0">
        <div role="group" aria-label={`Quantidade de ${nft}`} className="flex items-center gap-3">
          <button
            type="button"
            className={stepBtn}
            disabled={!canDecrement}
            aria-label={`Diminuir quantidade de ${nft}`}
            onClick={() => onQuantity(line, line.quantity - 1)}
          >
            <Minus aria-hidden="true" className="size-3.5" strokeWidth={3} />
          </button>
          <span data-testid="line-quantity" className="w-5 text-center text-body-md text-text-primary tabular-nums">
            {line.quantity}
          </span>
          <button
            type="button"
            className={stepBtn}
            disabled={atMax}
            aria-label={`Aumentar quantidade de ${nft}${atMax ? ` (limite de ${line.maxQuantity})` : ''}`}
            onClick={() => onQuantity(line, line.quantity + 1)}
          >
            <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
          </button>
        </div>
        {atMax && line.maxQuantity > 0 && <span className="text-tiny text-text-secondary">Limite: {line.maxQuantity}</span>}
      </div>

      {/* Total (desktop) */}
      <p data-testid="line-total" className="hidden whitespace-nowrap text-body-md font-bold text-text-accent lg:block">
        {formatEth(line.lineTotal)}
      </p>

      {/* Remover */}
      <button
        type="button"
        aria-label={`Remover ${nft} do carrinho`}
        onClick={() => onRemove(line)}
        className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-control text-text-accent outline-none hover:text-text-primary focus-visible:ring-3 focus-visible:ring-ring/60 lg:static"
      >
        <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>
    </li>
  )
}
