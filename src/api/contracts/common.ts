/**
 * Shared primitives for every REST/Socket.IO contract.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 *
 * Money rule: ETH values are ALWAYS decimal strings (never `number`).
 * Arithmetic happens only in `src/lib/money.ts` (decimal.js).
 */
import { z } from 'zod'

/** Non-negative decimal ETH amount, up to 18 fractional digits (wei precision). */
export const ETH_PATTERN = /^\d+(\.\d{1,18})?$/
export const ethSchema = z.string().regex(ETH_PATTERN, 'Valor em ETH inválido')
export type Eth = z.infer<typeof ethSchema>

/** Integer quantity (never fractional). */
export const quantitySchema = z.int().min(1).max(999)
export type Quantity = z.infer<typeof quantitySchema>

/** Non-negative integer stock counter. */
export const stockSchema = z.int().min(0)

/** Opaque resource identifier (`nft_042`, `ord_x1y2`, ...). */
export const idSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Identificador inválido')
export type Id = z.infer<typeof idSchema>

/** ISO-8601 instant with offset/`Z`. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true })
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>

/** Monotonic per-resource version (starts at 1, only grows). */
export const versionSchema = z.int().min(1)

/** Blockchain networks used by catalog filter, wallets and checkout. */
export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const networkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof networkSchema>

/** Image reference served by the app (`/nft/*.webp`) or an avatar data/blob URL. */
export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  width: z.int().positive(),
  height: z.int().positive(),
})
export type Image = z.infer<typeof imageSchema>

export const paginationMetaSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1).max(60),
  total: z.int().min(0),
  totalPages: z.int().min(0),
})
export type PaginationMeta = z.infer<typeof paginationMetaSchema>

/** Ethereum/Polygon (EVM) address. */
export const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
/** Solana base58 address. */
export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidAddress(network: Network, address: string): boolean {
  return network === 'solana' ? SOLANA_ADDRESS_PATTERN.test(address) : EVM_ADDRESS_PATTERN.test(address)
}

/** `<label>.eth` ENS name (the `.eth` suffix is the only TLD offered by the layout). */
export const ensNameSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?\.eth$/, 'Nome ENS inválido (use letras minúsculas, números e hífen, terminando em .eth)')

/** Same-origin relative path; blocks open redirects (`//evil`, `https://...`, `/\\evil`). */
export const safeRedirectSchema = z
  .string()
  .max(512)
  .refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\'), 'Redirecionamento inválido')

/** HTTP headers shared by Axios client and MSW handlers. */
export const HEADERS = {
  authorization: 'Authorization',
  idempotencyKey: 'Idempotency-Key',
  guestId: 'X-Guest-Id',
  requestId: 'X-Request-Id',
} as const

/** UUID v4 used for guest ids and idempotency keys. */
export const uuidSchema = z.uuid()
