/**
 * Purchase attempt = one `Idempotency-Key` per FINGERPRINT (ARCHITECTURE §6).
 *
 * Fingerprint = SHA-256 of the canonical payload (quoteId, quoteVersion, walletId, connectionId,
 * network, collector). The key is created on the first "Enviar pedido" for a fingerprint and kept in
 * `sessionStorage` (per user, `kurio.u.<userId>.attempt`), so:
 *  - a repeated click, an automatic retry after a timeout and a manual retry after a refresh all send the
 *    SAME key and the server answers with the SAME order (200);
 *  - any change (new quote version after QUOTE_STALE, other wallet/network, edited collector) produces a
 *    new fingerprint and therefore a new key;
 *  - the record never crosses users (key prefix + `clearUserDrafts` on teardown, checked on read).
 * The stored value is validated on read: a tampered entry is ignored.
 */
import { z } from 'zod'
import { idSchema, uuidSchema, type CreateOrderRequest } from '@/api/contracts'
import { userDraftKey } from '@/session/store'

const attemptSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  key: uuidSchema,
  orderId: idSchema.optional(),
})
type Attempt = z.infer<typeof attemptSchema>

const slot = (userId: string) => userDraftKey(userId, 'attempt')

/** Canonical, order-independent serialization of what makes two purchase attempts "the same". */
function canonical(body: CreateOrderRequest): string {
  const { collector } = body
  return JSON.stringify([
    body.quoteId,
    body.quoteVersion,
    body.walletId,
    body.connectionId,
    body.network,
    [collector.displayName, collector.username, collector.profileName, collector.email, collector.ensName, collector.referralCode, collector.note ?? ''],
  ])
}

export async function fingerprintOf(body: CreateOrderRequest): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(body))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function readAttempt(userId: string): Attempt | null {
  try {
    const raw = sessionStorage.getItem(slot(userId))
    if (!raw) return null
    const parsed = attemptSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function writeAttempt(userId: string, attempt: Attempt): void {
  try {
    sessionStorage.setItem(slot(userId), JSON.stringify(attempt))
  } catch {
    /* storage unavailable: the key still lives for this call; a retry after refresh would mint a new one */
  }
}

/** Same fingerprint -> same key; otherwise a fresh UUID v4 replaces the stored attempt. */
export function ensureAttempt(userId: string, fingerprint: string): Attempt {
  const current = readAttempt(userId)
  if (current && current.fingerprint === fingerprint) return current
  const next: Attempt = { fingerprint, key: crypto.randomUUID() }
  writeAttempt(userId, next)
  return next
}

/** Remembers the order created for the attempt (recovery after refresh). */
export function recordAttemptOrder(userId: string, orderId: string): void {
  const current = readAttempt(userId)
  if (current) writeAttempt(userId, { ...current, orderId })
}

export function clearAttempt(userId: string): void {
  try {
    sessionStorage.removeItem(slot(userId))
  } catch {
    /* nothing to clear */
  }
}
