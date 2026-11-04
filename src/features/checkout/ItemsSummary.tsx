/** "Seus NFTs": quote lines (quantity, subtotal) with the cart image. Values come from the quote. */
import type { CartLine, Quote } from '@/api/contracts'
import { formatEth } from '@/lib/money'

export function ItemsSummary({ quote, cartLines, compact = false }: { quote: Quote; cartLines: CartLine[]; compact?: boolean }) {
  const imageOf = (lineId: string) => cartLines.find((l) => l.id === lineId)?.image
  return (
    <ul data-testid="checkout-items" aria-label="Seus NFTs" className="flex flex-col gap-3">
      {quote.lines.map((line) => {
        const image = imageOf(line.lineId)
        return (
          <li key={line.lineId} className="flex min-h-[70px] items-center gap-3 bg-surface-card pr-3">
            {image ? (
              <img src={image.src} alt={image.alt || line.name} width={70} height={70} className="size-[70px] shrink-0 object-cover" />
            ) : (
              <span aria-hidden="true" className="size-[70px] shrink-0 bg-muted" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm font-bold text-text-primary">{line.name}</span>
              <span className="truncate text-caption-sm text-text-secondary">ID do token: {line.tokenId}</span>
            </span>
            <span className="text-caption-sm text-text-secondary">(x {line.quantity})</span>
            <span className={compact ? 'text-body-sm font-bold text-text-accent' : 'text-body-md font-bold text-text-accent'}>{formatEth(line.lineTotal)}</span>
          </li>
        )
      })}
    </ul>
  )
}
