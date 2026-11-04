/**
 * Recovery of an in-flight purchase (ARCHITECTURE §6): `GET /orders?status=pending` lists the orders
 * that still wait for the simulation. Shown in the cart and checkout so a refresh or a reconnection never
 * leads to a second purchase of the same items: the user is sent to the existing order.
 */
import { Link } from '@tanstack/react-router'
import { formatEth } from '@/lib/money'
import { usePendingOrders } from '@/queries/orders'

export function PendingOrderBanner() {
  const pending = usePendingOrders()
  const first = pending.data?.items[0]
  if (!first) return null
  return (
    <div data-testid="pending-order-banner" role="status" className="rounded-control border border-line-soft bg-surface-card px-4 py-3 text-body-sm text-text-primary">
      <p>
        Você tem um pedido aguardando confirmação ({formatEth(first.receipt.total)}).{' '}
        <Link to="/orders/$id" params={{ id: first.id }} className="font-bold text-text-accent underline underline-offset-4">
          Acompanhar pedido
        </Link>
      </p>
    </div>
  )
}
