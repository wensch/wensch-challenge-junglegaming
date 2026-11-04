/**
 * Monotonic writes for versioned resources (ARCHITECTURE §7, §8).
 *
 * `keepNewest` is used as `structuralSharing` by every queryOptions of a versioned resource (NFT
 * detail/list/featured, order detail/list, profile, wallets). Whatever writes into those queries —
 * a REST response that left before an event, an out-of-order refetch, a reconciler patch — can only
 * move a resource forward:
 *  - an object with `version` is replaced only by the same resource with `version >=`;
 *  - an order in a terminal status (`confirmed` | `declined`) is never replaced by another status;
 *  - arrays/objects are walked so list items and featured cards get the same per-item guard.
 * Unchanged parts keep their references (`replaceEqualDeep`), as the default structural sharing does.
 */
import { replaceEqualDeep } from '@tanstack/react-query'
import { isTerminalOrderStatus, ORDER_STATUSES, type OrderStatus } from '@/api/contracts'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isVersioned = (v: unknown): v is Rec & { version: number } => isRec(v) && typeof v.version === 'number'
const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
const sameResource = (a: Rec, b: Rec) => a.id === undefined || b.id === undefined || a.id === b.id

/** Which of two snapshots of the same resource may stay in the cache. */
export function pickNewest<T>(old: T, next: T): T {
  if (!isVersioned(old) || !isVersioned(next) || !sameResource(old, next)) return next
  if (isOrderStatus(old.status) && isTerminalOrderStatus(old.status) && old.status !== next.status) return old
  return old.version > next.version ? old : next
}

function guard(old: unknown, next: unknown, depth: number): unknown {
  if (depth > 4) return next
  if (isVersioned(old) && isVersioned(next)) return pickNewest(old, next)
  if (Array.isArray(old) && Array.isArray(next)) {
    const byId = new Map<unknown, unknown>()
    for (const item of old) if (isVersioned(item) && item.id !== undefined) byId.set(item.id, item)
    if (byId.size === 0) return next
    return next.map((item: unknown) => (isVersioned(item) && byId.has(item.id) ? pickNewest(byId.get(item.id), item) : item))
  }
  if (isRec(old) && isRec(next)) {
    let out: Rec | null = null
    for (const [k, v] of Object.entries(next)) {
      const guarded = guard(old[k], v, depth + 1)
      if (guarded !== v) (out ??= { ...next })[k] = guarded
    }
    return out ?? next
  }
  return next
}

/** `structuralSharing` for versioned resources: never regress version nor a terminal order. */
export function keepNewest(oldData: unknown, newData: unknown): unknown {
  if (oldData === undefined) return newData
  return replaceEqualDeep(oldData, guard(oldData, newData, 0))
}
