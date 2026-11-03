/**
 * Socket.IO event envelope (server -> client). The Socket.IO event name equals `type`.
 * Client rules (see ARCHITECTURE.md "Reconciliação"):
 * - dedupe by `id` (LRU of seen ids);
 * - per `resource`, apply only if `version` > last applied version (older/equal = ignored);
 * - private events carry `userId` and are dropped if it differs from the current session user;
 * - terminal order states are never overwritten.
 * Connection: `io(VITE_SOCKET_URL, { transports: ['websocket'], auth: { token } })`; no acks.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { ethSchema, idSchema, isoDateTimeSchema, stockSchema, versionSchema } from './common'
import { orderStatusSchema, transactionSchema } from './orders'

export const EVENT_TYPES = ['nft.updated', 'order.updated'] as const
export const eventTypeSchema = z.enum(EVENT_TYPES)
export type EventType = z.infer<typeof eventTypeSchema>

const envelopeBase = {
  /** Stable, globally unique event id (duplicates share it). */
  id: z.string().min(1).max(64),
  /** Version of the resource AFTER the change (same counter as REST `version`). */
  version: versionSchema,
  occurredAt: isoDateTimeSchema,
}

export const nftUpdatedDataSchema = z.object({
  nftId: idSchema,
  /** Price of the default edition (card price). */
  price: ethSchema,
  compareAtPrice: ethSchema.nullable(),
  available: stockSchema,
  soldOut: z.boolean(),
  editions: z.array(z.object({ id: idSchema, price: ethSchema, available: stockSchema })),
})
export type NftUpdatedData = z.infer<typeof nftUpdatedDataSchema>

export const nftUpdatedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('nft.updated'),
  resource: z.object({ kind: z.literal('nft'), id: idSchema }),
  /** Public event: no userId. */
  userId: z.undefined().optional(),
  data: nftUpdatedDataSchema,
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedDataSchema = z.object({
  orderId: idSchema,
  status: orderStatusSchema,
  transaction: transactionSchema.nullable(),
  declineReason: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
})
export type OrderUpdatedData = z.infer<typeof orderUpdatedDataSchema>

export const orderUpdatedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('order.updated'),
  resource: z.object({ kind: z.literal('order'), id: idSchema }),
  /** Private event: always scoped to the order owner. */
  userId: idSchema,
  data: orderUpdatedDataSchema,
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const realtimeEventSchema = z.discriminatedUnion('type', [nftUpdatedEventSchema, orderUpdatedEventSchema])
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>
export type RealtimeEventOf<T extends EventType> = Extract<RealtimeEvent, { type: T }>

/** Key used for version bookkeeping: `nft:nft_042`, `order:ord_1`. */
export const resourceKey = (e: Pick<RealtimeEvent, 'resource'>) => `${e.resource.kind}:${e.resource.id}`

/** Typed map for socket.io-client generics: `Socket<ServerToClientEvents>`. */
export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}
/** The app emits nothing (binding has no acks; subscription is implied by auth.token). */
export type ClientToServerEvents = Record<string, never>

/** Shape of the Socket.IO handshake `auth` payload. */
export const socketAuthSchema = z.object({ token: z.string().min(16).nullable() })
export type SocketAuth = z.infer<typeof socketAuthSchema>
