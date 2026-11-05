/**
 * Subtotal / discount / network fee / total block shared by the cart summary, the checkout and the
 * receipt. It only FORMATS strings it is given: values come from the quote (cart, checkout) or from the
 * receipt snapshot (order). Nothing is computed here (ARCHITECTURE §5).
 */
import { formatEth, isZero } from '@/lib/money'
import { cn } from '@/lib/utils'

interface OrderTotalsProps {
  subtotal: string
  discount: string
  /** Label of the discount row (Figma: "Desconto do lançamento"); the coupon label when there is one. */
  discountLabel: string
  networkFee: string
  total: string
  feeEstimated: boolean
  className?: string
  /** Prefix for data-testid of each value (`<prefix>-subtotal`...). */
  testIdPrefix: string
}

/** Figma shows the empty discount as "(-) 00.00". */
function formatDiscount(discount: string): string {
  return isZero(discount) ? '(-) 00.00' : `(-) ${formatEth(discount)}`
}

export function OrderTotals({ subtotal, discount, discountLabel, networkFee, total, feeEstimated, className, testIdPrefix }: OrderTotalsProps) {
  return (
    <dl className={cn('text-body-sm text-text-primary', className)}>
      <div className="flex items-baseline justify-between gap-4 py-0.5 max-lg:py-0">
        <dt>Subtotal</dt>
        <dd data-testid={`${testIdPrefix}-subtotal`} className="text-body-md">
          {formatEth(subtotal)}
        </dd>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <dt>{discountLabel}</dt>
        <dd data-testid={`${testIdPrefix}-discount`}>{formatDiscount(discount)}</dd>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <span data-testid={`${testIdPrefix}-fee`} className="text-body-md">
            {formatEth(networkFee)}
          </span>
          {feeEstimated && <span className="mt-2 block max-lg:mt-0 text-caption-sm text-text-accent">Taxa estimada</span>}
        </dd>
      </div>
      <div className="mt-4 max-lg:mt-3 flex items-baseline justify-between gap-4 text-body-md font-bold">
        <dt>Total</dt>
        <dd data-testid={`${testIdPrefix}-total`} className="text-text-accent">
          {formatEth(total)}
        </dd>
      </div>
    </dl>
  )
}
