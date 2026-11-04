/**
 * Client-side session/guest identity storage (ARCHITECTURE §4, §5).
 * - `kurio.session` (localStorage): `{ token, expiresAt }` — survives refresh. The user object is NOT
 *   stored: it always comes from `GET /session` (`['session']` query).
 * - `kurio.guestId` (localStorage): UUID v4 for the visitor cart (`X-Guest-Id`).
 * - Per-user drafts (sessionStorage) use the prefix `kurio.u.<userId>.` so a user switch can drop them.
 * Values read from storage are validated: a tampered/corrupted entry is discarded, never trusted.
 */
import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from '@/api/contracts'

const SESSION_KEY = 'kurio.session'
const GUEST_KEY = 'kurio.guestId'
export const USER_DRAFT_PREFIX = 'kurio.u.'

const storedSessionSchema = z.object({ token: z.string().min(16).max(512), expiresAt: isoDateTimeSchema })
export type StoredSession = z.infer<typeof storedSessionSchema>

type Listener = () => void
const listeners = new Set<Listener>()

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function readJson(key: string): unknown {
  const raw = safeGet(localStorage, key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function notify() {
  for (const l of listeners) l()
}

export function getStoredSession(): StoredSession | null {
  const parsed = storedSessionSchema.safeParse(readJson(SESSION_KEY))
  if (!parsed.success) return null
  // Locally expired tokens are dropped without a round-trip; the server stays the authority otherwise.
  if (Date.parse(parsed.data.expiresAt) <= Date.now()) return null
  return parsed.data
}

export function getToken(): string | null {
  return getStoredSession()?.token ?? null
}

export function setStoredSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(storedSessionSchema.parse(session)))
  notify()
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY)
  notify()
}

/** Subscribe to session changes in this tab and in other tabs (storage event). */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_KEY || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// ---------------------------------------------------------------------------
// Visitor id (reactive: `subscribeGuestId` + `useGuestId` via useSyncExternalStore).
// ---------------------------------------------------------------------------
const guestListeners = new Set<Listener>()
function notifyGuest() {
  for (const l of guestListeners) l()
}

/** Subscribe to guest-id changes in this tab and in other tabs (storage event). */
export function subscribeGuestId(listener: Listener): () => void {
  guestListeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === GUEST_KEY || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    guestListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Returns the existing guest id without creating one (render-safe snapshot). */
export function peekGuestId(): string | null {
  const current = safeGet(localStorage, GUEST_KEY)
  return current && uuidSchema.safeParse(current).success ? current : null
}

/**
 * Returns the visitor id, creating it if needed. Call it explicitly right before the first visitor
 * mutation (e.g. "add to cart"), so the cart owner — and its query key — exist before the request.
 */
export function ensureGuestId(): string {
  const current = peekGuestId()
  if (current) return current
  const id = crypto.randomUUID()
  localStorage.setItem(GUEST_KEY, id)
  notifyGuest()
  return id
}

export function clearGuestId(): void {
  localStorage.removeItem(GUEST_KEY)
  notifyGuest()
}

/** sessionStorage key for a per-user draft (checkout form, purchase attempt). */
export function userDraftKey(userId: string, name: string): string {
  return `${USER_DRAFT_PREFIX}${userId}.${name}`
}

/** Removes per-user drafts; `keepUserId` preserves the drafts of that user (re-login after expiry). */
export function clearUserDrafts(keepUserId?: string): void {
  const keep = keepUserId ? `${USER_DRAFT_PREFIX}${keepUserId}.` : null
  const doomed: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k?.startsWith(USER_DRAFT_PREFIX) && !(keep && k.startsWith(keep))) doomed.push(k)
  }
  for (const k of doomed) sessionStorage.removeItem(k)
}
