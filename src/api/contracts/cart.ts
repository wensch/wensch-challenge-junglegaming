/**
 * Server-side cart. Owner is resolved per request:
 * - authenticated: `Authorization` header -> user cart;
 * - visitor: `X-Guest-Id: <uuid>` header (uuid generated once, kept in localStorage) -> guest cart.
 * On login/register the client calls POST /cart/merge { guestId } exactly once; the guest cart is
 * then deleted server-side, so a repeated merge is a no-op (idempotent).
 * Lines are unique per (nftId, editionId). Quantities are integers, capped by availability and maxPerOrder.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { ethSchema, idSchema, imageSchema, isoDateTimeSchema, quantitySchema, stockSchema, uuidSchema, versionSchema } from './common'

/**
 * Line health computed by the server against the live catalog:
 * - ok: price and availability unchanged since the line was last touched;
 * - price_changed: `unitPrice` differs from `addedUnitPrice`;
 * - insufficient: available > 0 but < quantity;
 * - sold_out: available === 0.
 */
export const cartLineStatusSchema = z.enum(['ok', 'price_changed', 'insufficient', 'sold_out'])
export type CartLineStatus = z.infer<typeof cartLineStatusSchema>

export const cartLineSchema = z.object({
  id: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
  name: z.string(),
  tokenId: z.string(),
  editionLabel: z.string(),
  image: imageSchema,
  /** Current catalog price. */
  unitPrice: ethSchema,
  /** Price when the line was added/last acknowledged (for "preço alterado" messaging). */
  addedUnitPrice: ethSchema,
  /** unitPrice x quantity, computed by the server. */
  lineTotal: ethSchema,
  available: stockSchema,
  /** min(available, edition.maxPerOrder): upper bound for the quantity stepper. */
  maxQuantity: stockSchema,
  status: cartLineStatusSchema,
  /** NFT version the line was computed from (matches `nft.updated` versions). */
  nftVersion: versionSchema,
})
export type CartLine = z.infer<typeof cartLineSchema>

export const cartOwnerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('guest'), guestId: uuidSchema }),
  z.object({ kind: z.literal('user'), userId: idSchema }),
])

export const cartSchema = z.object({
  id: idSchema,
  owner: cartOwnerSchema,
  lines: z.array(cartLineSchema),
  /** Coupon stored on the cart; its validity/discount is decided by the quote. */
  couponCode: z.string().nullable(),
  itemCount: z.int().min(0),
  /** Informational; the authoritative subtotal/total is the Quote. */
  subtotal: ethSchema,
  version: versionSchema,
  updatedAt: isoDateTimeSchema,
})
export type Cart = z.infer<typeof cartSchema>

/** POST /cart/items — adds `quantity` to an existing (nftId, editionId) line or creates it. */
export const addCartItemRequestSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
})
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>

/** PATCH /cart/items/:lineId — sets the absolute quantity. Also acknowledges a price change. */
export const updateCartItemRequestSchema = z.object({
  quantity: quantitySchema,
})
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>

/** POST /cart/merge */
export const mergeCartRequestSchema = z.object({ guestId: uuidSchema })
export type MergeCartRequest = z.infer<typeof mergeCartRequestSchema>

/** Lines whose quantity had to be reduced during the merge (availability/maxPerOrder). */
export const mergeCartResponseSchema = z.object({
  cart: cartSchema,
  adjusted: z.array(z.object({ lineId: idSchema, requested: z.int().min(1), applied: z.int().min(0) })),
})
export type MergeCartResponse = z.infer<typeof mergeCartResponseSchema>

/** PUT /cart/coupon -> Cart (422 COUPON_INVALID | COUPON_EXPIRED). DELETE /cart/coupon -> Cart. */
export const applyCouponRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Informe o código')
    .max(32, 'Código muito longo')
    .transform((c) => c.toUpperCase()),
})
export type ApplyCouponRequest = z.input<typeof applyCouponRequestSchema>
