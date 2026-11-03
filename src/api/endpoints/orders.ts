/** Order endpoints (API-6, API-10). */
import { buildPath, endpoints, HEADERS, uuidSchema, type CreateOrderRequest, type OrderStatus } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

/**
 * `idempotencyKey` is mandatory and must be reused verbatim on retries of the same attempt
 * (ARCHITECTURE §6); the caller owns its lifecycle (sessionStorage per user).
 */
export const createOrder = (body: CreateOrderRequest, idempotencyKey: string, opts: CallOptions = {}) => {
  const key = uuidSchema.parse(idempotencyKey)
  return send(endpoints.createOrder, {
    path: buildPath(endpoints.createOrder.path),
    body,
    ...opts,
    headers: { ...opts.headers, [HEADERS.idempotencyKey]: key },
  })
}

export const getOrder = (orderId: string, opts: CallOptions = {}) =>
  send(endpoints.getOrder, { path: buildPath(endpoints.getOrder.path, { orderId }), ...opts })

export const listOrders = (status: OrderStatus | undefined, opts: CallOptions = {}) =>
  send(endpoints.listOrders, { path: buildPath(endpoints.listOrders.path), ...(status ? { query: { status } } : {}), ...opts })
