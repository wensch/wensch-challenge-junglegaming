/**
 * Typed queryOptions for orders (ARCHITECTURE §6, §7). Private: keys under `['u', userId]`, fetched
 * with the owner's token (`ownedQueryFn`). Writes go through `keepNewest`, so a late REST snapshot
 * never turns a confirmed/declined order back into pending.
 */
import { skipToken, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { isApiError, isTerminalOrderStatus, type ApiError, type CreateOrderRequest, type Order, type OrderListResponse, type OrderStatus } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { MAX_QUERY_RETRIES, retryDelay } from './client'
import { queryKeys } from './keys'
import { isCurrentOwner, ownedQueryFn } from './owner'
import { useSession } from './session'
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

const fetchOrder = (user: UserCredential, orderId: string) => ownedQueryFn({ kind: 'user', ...user }, (as, signal) => ordersApi.getOrder(orderId, { signal, as }))
const fetchOrders = (user: UserCredential, status?: OrderStatus) => ownedQueryFn({ kind: 'user', ...user }, (as, signal) => ordersApi.listOrders(status, { signal, as }))
const NO_ORDER_KEY = ['order', 'none'] as const
const NO_ORDERS_KEY = ['orders', 'none'] as const

// ---------------------------------------------------------------------------
// Hooks. Pending orders are ALWAYS stale (`staleTime: 0`) and `refetchOnWindowFocus` stays on
// so coming back to the tab or reconnecting re-reads the order from REST, which is the source of
// truth after any gap in the event stream. Terminal orders are `Infinity` (never refetched).
// ---------------------------------------------------------------------------

/** Credential of the logged user, or `null` for a visitor / while the session is resolving. */
export function useUserCredential(): UserCredential | null {
  const session = useSession()
  return session.data ? { userId: session.data.user.id, token: session.data.token } : null
}

/**
 * One order. While it is pending and the socket is NOT delivering events (`poll`), it is re-read every
 * `PENDING_ORDER_POLL_MS` (fallback polling, ARCHITECTURE §7); with the socket up, events update it.
 */
export function useOrder(orderId: string, { poll }: { poll: boolean }) {
  const user = useUserCredential()
  return useQuery<Order, ApiError, Order, QueryKey>({
    queryKey: user ? queryKeys.user(user.userId).order(orderId) : NO_ORDER_KEY,
    queryFn: user ? fetchOrder(user, orderId) : skipToken,
    staleTime: orderStaleTime,
    structuralSharing: keepNewest,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (poll && query.state.data?.status === 'pending' ? PENDING_ORDER_POLL_MS : false),
  })
}

/** Orders still `pending` (recovery after refresh / reconnection, ARCHITECTURE §6). */
export function usePendingOrders() {
  const user = useUserCredential()
  return useQuery<OrderListResponse, ApiError, OrderListResponse, QueryKey>({
    queryKey: user ? queryKeys.user(user.userId).orderList('pending') : NO_ORDERS_KEY,
    queryFn: user ? fetchOrders(user, 'pending') : skipToken,
    staleTime: 0,
    structuralSharing: keepNewest,
    refetchOnWindowFocus: true,
  })
}

/**
 * Creates the order. `retry`: only TRANSIENT failures (timeout, network, 5xx), up to 2x with backoff,
 * ALWAYS with the same `Idempotency-Key` (it travels in the variables), so a retry after a timeout
 * returns the SAME order (200). Nothing is written to the cache of an owner that is no longer current.
 */
export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation<Order, ApiError, { user: UserCredential; body: CreateOrderRequest; idempotencyKey: string }>({
    mutationFn: ({ user, body, idempotencyKey }) => ordersApi.createOrder(body, idempotencyKey, { as: { token: user.token } }),
    retry: (failureCount, error) => failureCount < MAX_QUERY_RETRIES && isApiError(error) && error.is('TRANSIENT'),
    retryDelay,
    onSuccess: (order, { user }) => {
      if (!isCurrentOwner({ kind: 'user', ...user })) return
      qc.setQueryData(queryKeys.user(user.userId).order(order.id), order)
      void qc.invalidateQueries({ queryKey: [...queryKeys.user(user.userId).orders(), 'list'] })
    },
  })
}
