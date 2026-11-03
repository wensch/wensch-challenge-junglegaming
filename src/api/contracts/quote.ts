/**
 * Quote = server-computed price of the current cart for a network. It is the ONLY reference
 * for totals shown in the cart summary/checkout and for creating an order.
 * Every recomputation that changes any monetary value, availability, coupon or fee bumps `version`
 * (same `id` while the cart is the same). POST /orders must send { quoteId, quoteVersion };
 * a mismatch yields 409 QUOTE_STALE with the fresh quote and the list of changes.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { ethSchema, idSchema, isoDateTimeSchema, networkSchema, quantitySchema, stockSchema, versionSchema } from './common'

export const quoteLineSchema = z.object({
  lineId: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  tokenId: z.string(),
  editionLabel: z.string(),
  quantity: quantitySchema,
  available: stockSchema,
  unitPrice: ethSchema,
  lineTotal: ethSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const couponSchema = z.object({
  code: z.string(),
  label: z.string(), // e.g. "Desconto do lançamento"
  kind: z.enum(['percent', 'fixed']),
  /** percent: "10" = 10%; fixed: ETH amount. */
  value: ethSchema,
  expiresAt: isoDateTimeSchema.nullable(),
})
export type Coupon = z.infer<typeof couponSchema>

/** Problems that block ordering (UI must resolve them first). */
export const quoteIssueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('insufficient'), lineId: idSchema, requested: z.int().min(1), available: stockSchema }),
  z.object({ kind: z.literal('sold_out'), lineId: idSchema }),
  z.object({ kind: z.literal('coupon_invalid'), code: z.string() }),
  z.object({ kind: z.literal('coupon_expired'), code: z.string() }),
  z.object({ kind: z.literal('empty_cart') }),
])
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteSchema = z.object({
  id: idSchema,
  version: versionSchema,
  cartVersion: versionSchema,
  network: networkSchema,
  currency: z.literal('ETH'),
  lines: z.array(quoteLineSchema),
  subtotal: ethSchema,
  coupon: couponSchema.nullable(),
  discount: ethSchema,
  networkFee: ethSchema,
  /** The layout labels the fee "Taxa estimada". */
  networkFeeEstimated: z.boolean(),
  /** subtotal - discount + networkFee (computed by the server). */
  total: ethSchema,
  issues: z.array(quoteIssueSchema),
  /** True when `issues` is empty and the quote can be used for POST /orders. */
  orderable: z.boolean(),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
})
export type Quote = z.infer<typeof quoteSchema>

/** POST /quotes — quotes the caller's current cart (coupon taken from the cart). */
export const createQuoteRequestSchema = z.object({
  network: networkSchema,
})
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>

/** What changed between the quote the user saw and the fresh one (409 QUOTE_STALE). */
export const quoteChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('price'), lineId: idSchema, from: ethSchema, to: ethSchema }),
  z.object({ kind: z.literal('availability'), lineId: idSchema, from: stockSchema, to: stockSchema }),
  z.object({ kind: z.literal('coupon'), code: z.string(), reason: z.enum(['expired', 'invalid', 'changed']) }),
  z.object({ kind: z.literal('fee'), from: ethSchema, to: ethSchema }),
  z.object({ kind: z.literal('total'), from: ethSchema, to: ethSchema }),
])
export type QuoteChange = z.infer<typeof quoteChangeSchema>
