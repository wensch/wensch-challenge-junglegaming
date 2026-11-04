/**
 * In-memory mock database. State is a plain JSON-serializable object persisted to localStorage under a
 * versioned key; `persist()` is called after every mutation. Types come from the frozen contracts.
 */
import { z } from 'zod'
import type { Coupon, Edition, Network, NftDetail, Order, Quote, Wallet } from '@/api/contracts'

export const DB_VERSION = 1
export const DB_STORAGE_KEY = `mock:db:v${DB_VERSION}`
/** Tiny revision stamp written after every DB write; comparing it avoids re-reading the (possibly MB-sized) DB. */
export const DB_REV_KEY = `${DB_STORAGE_KEY}:rev`

/** Catalog record: the detail contract is the storage shape (summary is derived). */
export type NftRec = Omit<NftDetail, 'available' | 'soldOut' | 'price' | 'compareAtPrice' | 'editions'> & { editions: Edition[] }

export interface UserRec {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  ensName: string
  walletAlias: string
  salt: string
  passwordHash: string
  /** Profile version (optimistic lock for PATCH /profile). */
  version: number
  createdAt: string
  updatedAt: string
}

export interface SessionRec {
  tokenHash: string
  userId: string
  issuedAt: string
  expiresAt: string
}

export interface CartLineRec {
  id: string
  nftId: string
  editionId: string
  quantity: number
  addedUnitPrice: string
}

export interface CartRec {
  id: string
  /** `u:<userId>` or `g:<guestId>` */
  ownerKey: string
  lines: CartLineRec[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface WalletRec extends Wallet {
  userId: string
}

export interface ConnectionRec {
  connectionId: string
  userId: string
  walletId: string
  network: Network
  address: string
  connectedAt: string
}

export interface QuoteRec {
  id: string
  cartId: string
  fingerprint: string
  /** Snapshots by version, to explain what changed in QUOTE_STALE. */
  history: Record<number, Quote>
  current: Quote
}

export interface OrderMeta {
  mode: 'confirmed' | 'declined' | 'hold'
  /** Cart owner key, to remove only purchased lines once confirmed. */
  ownerKey: string
  /** Stock reserved at creation (restored when declined). */
  reserved: { nftId: string; editionId: string; quantity: number }[]
}

export interface DbState {
  schema: number
  seq: Record<string, number>
  nfts: NftRec[]
  coupons: Coupon[]
  users: UserRec[]
  sessions: SessionRec[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRec>
  wallets: WalletRec[]
  connections: ConnectionRec[]
  quotes: Record<string, QuoteRec>
  orders: Order[]
  orderMeta: Record<string, OrderMeta>
  /** `<userId>:<key>` -> request hash + resulting order */
  idempotency: Record<string, { bodyHash: string; orderId: string }>
}

const rec = z.looseObject({})
const recWithId = z.looseObject({ id: z.string() })
/** Structural validation of what comes back from localStorage (deep shapes are guaranteed by the writers). */
const persistedSchema = z.looseObject({
  schema: z.literal(DB_VERSION),
  seq: z.record(z.string(), z.number()),
  nfts: z.array(recWithId),
  coupons: z.array(rec),
  users: z.array(recWithId),
  sessions: z.array(z.looseObject({ tokenHash: z.string(), userId: z.string(), issuedAt: z.string(), expiresAt: z.string() })),
  favorites: z.record(z.string(), z.array(z.string())),
  carts: z.record(z.string(), recWithId),
  wallets: z.array(recWithId),
  connections: z.array(rec),
  quotes: z.record(z.string(), rec),
  orders: z.array(recWithId),
  orderMeta: z.record(z.string(), rec),
  idempotency: z.record(z.string(), rec),
})

let state: DbState | null = null
/** Last serialized value this tab wrote or read; a different stored value means another tab wrote. */
let lastRaw: string | null = null
/** Revision stamp matching `lastRaw`. */
let lastRev: string | null = null
let revCounter = 0
const tabId = Math.random().toString(36).slice(2, 10)
const syncListeners = new Set<() => void>()

/** Called after the in-memory state was replaced by another tab's write. */
export function onDbSynced(fn: () => void): void {
  syncListeners.add(fn)
}

function readRev(): string | null {
  try {
    return localStorage.getItem(DB_REV_KEY)
  } catch {
    return null
  }
}

function readStored(): { raw: string; parsed: DbState } | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return null
    const parsed = persistedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { raw, parsed: parsed.data as unknown as DbState } : null
  } catch {
    return null
  }
}

/**
 * Cross-tab consistency: before every access the stored copy is compared with the one this tab last saw;
 * if another tab persisted in between, its state is adopted (a mutation never overwrites foreign writes
 * with a stale snapshot of the whole database).
 */
export function refreshFromStorage(): boolean {
  if (!state) return false
  let raw: string | null
  let rev: string | null
  try {
    // Cheap path: same revision stamp as the last one this tab wrote or adopted -> nothing to re-read.
    rev = localStorage.getItem(DB_REV_KEY)
    if (rev !== null && rev === lastRev) return false
    raw = localStorage.getItem(DB_STORAGE_KEY)
    if (raw === null || raw === lastRaw) {
      lastRev = rev
      return false
    }
  } catch {
    return false
  }
  const stored = readStored()
  if (!stored) return false
  state = stored.parsed
  lastRaw = stored.raw
  lastRev = rev
  for (const fn of syncListeners) fn()
  return true
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB not initialised')
  refreshFromStorage()
  return state
}

export function setDb(next: DbState): void {
  state = next
  persist()
}

export function persist(): void {
  if (!state) return
  try {
    const raw = JSON.stringify(state)
    localStorage.setItem(DB_STORAGE_KEY, raw)
    lastRaw = raw
    lastRev = `${tabId}:${++revCounter}`
    localStorage.setItem(DB_REV_KEY, lastRev)
  } catch {
    // Quota exceeded (e.g. large avatar): keep serving from memory. Drop the stamp so other tabs fall back
    // to the string comparison (slow path) and still notice a DB write that happened without a new stamp.
    lastRev = null
    try {
      localStorage.removeItem(DB_REV_KEY)
    } catch {
      /* storage unavailable */
    }
  }
}

/** Persisted DB if present, valid and of the current version; otherwise null (caller reseeds). */
export function loadPersisted(): DbState | null {
  const stored = readStored()
  if (!stored) {
    clearPersisted()
    return null
  }
  lastRaw = stored.raw
  lastRev = readRev()
  return stored.parsed
}

export function clearPersisted(): void {
  lastRaw = null
  lastRev = null
  try {
    localStorage.removeItem(DB_STORAGE_KEY)
    localStorage.removeItem(DB_REV_KEY)
  } catch {
    // ignore
  }
}

/** Monotonic id generator persisted with the DB: `nextId('ord')` -> `ord_0001`. */
export function nextId(prefix: string, width = 4): string {
  const s = db().seq
  s[prefix] = (s[prefix] ?? 0) + 1
  // Reserve the number now so another tab's next nextId() (which re-reads storage) cannot reuse it.
  persist()
  return `${prefix}_${String(s[prefix]).padStart(width, '0')}`
}

export const nowIso = () => new Date().toISOString()
