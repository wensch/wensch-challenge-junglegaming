/**
 * Typed queryOptions for orders (ARCHITECTURE §6, §7). Private: keys under `['u', userId]`, fetched
 * with the owner's token (`ownedQueryFn`). Writes go through `keepNewest`, so a late REST snapshot
 * never turns a confirmed/declined order back into pending.
 */
import { queryOptions } from '@tanstack/react-query'
import { isTerminalOrderStatus, type Order, type OrderStatus } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { queryKeys } from './keys'
import { ownedQueryFn } from './owner'
import { keepNewest } from './versioned'

export interface UserCredential {
  userId: string
  token: string
}

/** Fallback polling while an order is pending and the socket is down (ARCHITECTURE §7). */
export const PENDING_ORDER_POLL_MS = 5_000

/** Terminal orders never change: no refetch. Pending ones are always stale. */
function orderStaleTime(query: { state: { data: Order | undefined } }): number {
  const data = query.state.data
  return data && isTerminalOrderStatus(data.status) ? Number.POSITIVE_INFINITY : 0
}

export const orderQueries = {
  detail: (user: UserCredential, orderId: string) =>
    queryOptions({
      queryKey: queryKeys.user(user.userId).order(orderId),
      queryFn: ownedQueryFn({ kind: 'user', ...user }, (as, signal) => ordersApi.getOrder(orderId, { signal, as })),
      staleTime: orderStaleTime,
      structuralSharing: keepNewest,
    }),
  list: (user: UserCredential, status?: OrderStatus) =>
    queryOptions({
      queryKey: queryKeys.user(user.userId).orderList(status),
      queryFn: ownedQueryFn({ kind: 'user', ...user }, (as, signal) => ordersApi.listOrders(status, { signal, as })),
      staleTime: 0,
      structuralSharing: keepNewest,
    }),
}
