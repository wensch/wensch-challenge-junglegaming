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

/**
 * Same-origin relative path; blocks open redirects (v1.2.0 hardening).
 * Rejected: anything not starting with a single `/` (`//evil`, `https://...`, `javascript:`), any
 * backslash and any C0 control / DEL character (WHATWG URL parsers silently drop TAB/LF/CR, so
 * `"/\t/evil.com"` would resolve to `//evil.com`). Accepted values are resolved against a sentinel
 * origin: if the origin changes the value is rejected; otherwise the output is normalized to
 * `pathname + search + hash` (what the router navigates to).
 */
const REDIRECT_BASE = 'http://redirect.invalid'
// eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
const REDIRECT_FORBIDDEN = /[\u0000-\u001F\u007F\\]/
export function toSafeRedirect(value: string): string | null {
  if (value.length > 512 || !value.startsWith('/') || value.startsWith('//') || REDIRECT_FORBIDDEN.test(value)) return null
  let url: URL
  try {
    url = new URL(value, REDIRECT_BASE)
  } catch {
    return null
  }
  if (url.origin !== REDIRECT_BASE) return null
  const normalized = `${url.pathname}${url.search}${url.hash}`
  // Dot segments can collapse into a protocol-relative path (`/.//evil.com` -> `//evil.com`).
  if (normalized.startsWith('//')) return null
  return normalized
}
export const safeRedirectSchema = z
  .string()
  .max(512)
  .refine((v) => toSafeRedirect(v) !== null, 'Redirecionamento inválido')
  .transform((v) => toSafeRedirect(v) ?? '/')

/**
 * URL that may be rendered as `href`/`src` (v1.2.0). Only `https:` — `javascript:`, `data:text/html`,
 * `http:` and friends are rejected at the contract boundary.
 */
export const httpsUrlSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain })

/**
 * Avatar reference (v1.2.0): an `https:` URL, a same-origin absolute path (`/avatars/x.webp`) or an
 * inline raster image (`data:image/png|jpeg|webp;base64,...`, as returned by the avatar upload).
 * SVG and every other data/blob/script scheme are rejected.
 */
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/
export const avatarUrlSchema = z
  .string()
  .min(1)
  .max(3_000_000)
  .refine(
    (v) => AVATAR_DATA_URL.test(v) || (v.startsWith('/') && toSafeRedirect(v) !== null) || httpsUrlSchema.safeParse(v).success,
    'URL de avatar inválida',
  )

/**
 * Compares two valid ETH decimal strings without float math (contracts must not depend on
 * `src/lib`). Returns -1, 0 or 1.
 */
export function compareEthStrings(a: string, b: string): -1 | 0 | 1 {
  const [ai = '0', af = ''] = a.split('.')
  const [bi = '0', bf = ''] = b.split('.')
  const aInt = ai.replace(/^0+(?=\d)/, '')
  const bInt = bi.replace(/^0+(?=\d)/, '')
  if (aInt.length !== bInt.length) return aInt.length < bInt.length ? -1 : 1
  const width = Math.max(af.length, bf.length)
  const aa = aInt + af.padEnd(width, '0')
  const bb = bInt + bf.padEnd(width, '0')
  return aa === bb ? 0 : aa < bb ? -1 : 1
}

/** HTTP headers shared by Axios client and MSW handlers. */
export const HEADERS = {
  authorization: 'Authorization',
  idempotencyKey: 'Idempotency-Key',
  guestId: 'X-Guest-Id',
  requestId: 'X-Request-Id',
} as const

/** UUID v4 used for guest ids and idempotency keys. */
export const uuidSchema = z.uuid()
