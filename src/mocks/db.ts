/**
 * In-memory mock database. State is a plain JSON-serializable object persisted to localStorage under a
 * versioned key; `persist()` is called after every mutation. Types come from the frozen contracts.
 */
import type { Coupon, Edition, Network, NftDetail, Order, Quote, Wallet } from '@/api/contracts'

export const DB_VERSION = 1
export const DB_STORAGE_KEY = `mock:db:v${DB_VERSION}`

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

let state: DbState | null = null

export function db(): DbState {
  if (!state) throw new Error('Mock DB not initialised')
  return state
}

export function setDb(next: DbState): void {
  state = next
  persist()
}

export function persist(): void {
  if (!state) return
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded (e.g. large avatar): keep serving from memory.
  }
}

export function loadPersisted(): DbState | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed.schema === DB_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(DB_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Monotonic id generator persisted with the DB: `nextId('ord')` -> `ord_0001`. */
export function nextId(prefix: string, width = 4): string {
  const s = db().seq
  s[prefix] = (s[prefix] ?? 0) + 1
  return `${prefix}_${String(s[prefix]).padStart(width, '0')}`
}

export const nowIso = () => new Date().toISOString()
