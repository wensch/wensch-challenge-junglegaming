/**
 * Orders. Creation is idempotent via the `Idempotency-Key` header (UUID v4 per purchase attempt):
 * - same key + same body  -> the SAME order (200 on replay, 201 on first creation);
 * - same key + other body -> 409 IDEMPOTENCY_CONFLICT { orderId }.
 * New orders start `pending`; the simulation moves them to `confirmed` or `declined` (terminal)
 * and announces it via `order.updated`. The receipt is a snapshot taken at creation time and is
 * never recomputed from the catalog.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { displayNameSchema, emailSchema, usernameSchema } from './auth'
import { ensNameSchema, ethSchema, idSchema, imageSchema, isoDateTimeSchema, networkSchema, quantitySchema, versionSchema } from './common'
import { walletTypeSchema } from './wallets'

export const ORDER_STATUSES = ['pending', 'confirmed', 'declined'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'declined']
export const isTerminalOrderStatus = (s: OrderStatus) => TERMINAL_ORDER_STATUSES.includes(s)

/** Collector data from the "Pagamento" frame (the wallet itself comes from `walletId`). */
export const collectorSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  profileName: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema,
  referralCode: z.string().trim().regex(/^[A-Z0-9-]{4,16}$/, 'Código de indicação inválido'),
  note: z.string().trim().max(500, 'Máximo de 500 caracteres').optional(),
})
export type Collector = z.infer<typeof collectorSchema>

/** POST /orders (header Idempotency-Key required). */
export const createOrderRequestSchema = z.object({
  quoteId: idSchema,
  quoteVersion: versionSchema,
  walletId: idSchema,
  /** Must be an active connection from POST /wallets/:id/connect for the same network. */
  connectionId: idSchema,
  network: networkSchema,
  collector: collectorSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const receiptLineSchema = z.object({
  /** Cart line that originated this item (used to remove only what was bought). */
  cartLineId: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  tokenId: z.string(),
  editionLabel: z.string(),
  image: imageSchema,
  quantity: quantitySchema,
  unitPrice: ethSchema,
  lineTotal: ethSchema,
})
export type ReceiptLine = z.infer<typeof receiptLineSchema>

/** Immutable snapshot of what was charged. */
export const receiptSchema = z.object({
  lines: z.array(receiptLineSchema).min(1),
  subtotal: ethSchema,
  couponCode: z.string().nullable(),
  discount: ethSchema,
  networkFee: ethSchema,
  total: ethSchema,
  network: networkSchema,
  wallet: z.object({ id: idSchema, label: z.string(), address: z.string(), type: walletTypeSchema }),
  collector: collectorSchema,
})
export type Receipt = z.infer<typeof receiptSchema>

/** Simulated on-chain reference; only present when confirmed. */
export const transactionSchema = z.object({
  hash: z.string().regex(/^0x[a-f0-9]{64}$/),
  explorerUrl: z.url(),
  confirmedAt: isoDateTimeSchema,
})

export const orderSchema = z.object({
  id: idSchema,
  userId: idSchema,
  status: orderStatusSchema,
  /** Monotonic; shared with `order.updated` events. */
  version: versionSchema,
  quoteId: idSchema,
  quoteVersion: versionSchema,
  receipt: receiptSchema,
  transaction: transactionSchema.nullable(),
  declineReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Order = z.infer<typeof orderSchema>

/** GET /orders?status=pending — used to recover an in-flight purchase after refresh. */
export const orderListQuerySchema = z.object({ status: orderStatusSchema.optional() })
export const orderListResponseSchema = z.object({ items: z.array(orderSchema) })
export type OrderListResponse = z.infer<typeof orderListResponseSchema>
