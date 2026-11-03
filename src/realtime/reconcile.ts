/**
 * REST <-> Socket.IO reconciliation (ARCHITECTURE §8). Pure cache logic, no socket here, so it can
 * be exercised by feeding raw payloads.
 *
 * Pipeline for every incoming payload:
 *  1. validate the envelope (zod) — invalid payloads are dropped, never thrown into the UI;
 *  2. dedupe by event `id` (bounded LRU) — a repeated id never re-applies effects;
 *  3. isolation — `order.updated` for another user is dropped;
 *  4. monotonic version — applied only if `version` > max(last event version, cached REST version);
 *     terminal orders are never overwritten;
 *  5. apply — targeted `setQueryData` (detail, list cards, featured, order) + invalidation of what
 *     the server computes (cart, quote, order lists).
 * After a reconnection `onReconnect` invalidates the active resources: REST is the truth after a gap.
 */
import type { QueryClient } from '@tanstack/react-query'
import {
  isTerminalOrderStatus,
  realtimeEventSchema,
  resourceKey,
  type Cart,
  type FeaturedResponse,
  type NftDetail,
  type NftListResponse,
  type NftSummary,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/api/contracts'
import { isCartKey, isQuoteKey, queryKeys } from '@/queries/keys'

export type ReconcileOutcome = 'applied' | 'invalid' | 'duplicate' | 'foreign' | 'stale'

export interface ReconcileResult {
  outcome: ReconcileOutcome
  event: RealtimeEvent | null
}

export interface ReconcilerOptions {
  queryClient: QueryClient
  /** User of the session that owns the socket (`null` for visitors). */
  getUserId: () => string | null
  /** Max remembered event ids. */
  maxSeen?: number
  log?: (message: string, detail?: unknown) => void
}

export interface Reconciler {
  handle(payload: unknown): ReconcileResult
  /** Feed a version observed through REST (keeps late/duplicated events from regressing state). */
  noteVersion(key: string, version: number): void
  knownVersion(key: string): number
  onReconnect(): void
}

class BoundedSet {
  private readonly items = new Map<string, true>()
  constructor(private readonly max: number) {}
  has(id: string) {
    return this.items.has(id)
  }
  add(id: string) {
    this.items.delete(id)
    this.items.set(id, true)
    if (this.items.size > this.max) {
      const oldest = this.items.keys().next().value
      if (oldest !== undefined) this.items.delete(oldest)
    }
  }
}

function patchSummary<T extends NftSummary>(item: T, e: NftUpdatedEvent): T {
  if (item.id !== e.data.nftId || item.version >= e.version) return item
  return { ...item, price: e.data.price, compareAtPrice: e.data.compareAtPrice, available: e.data.available, soldOut: e.data.soldOut, version: e.version }
}

function patchDetail(detail: NftDetail, e: NftUpdatedEvent): NftDetail {
  if (detail.version >= e.version) return detail
  const byId = new Map(e.data.editions.map((ed) => [ed.id, ed]))
  return {
    ...patchSummary(detail, e),
    editions: detail.editions.map((ed) => {
      const next = byId.get(ed.id)
      return next ? { ...ed, price: next.price, available: next.available } : ed
    }),
  }
}

export function createReconciler({ queryClient, getUserId, maxSeen = 500, log = () => {} }: ReconcilerOptions): Reconciler {
  const seen = new BoundedSet(maxSeen)
  const versions = new Map<string, number>()

  function cachedVersion(e: RealtimeEvent): number {
    if (e.type === 'nft.updated') {
      let v = queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(e.resource.id))?.version ?? 0
      for (const [, list] of queryClient.getQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() })) {
        for (const item of list?.items ?? []) if (item.id === e.resource.id) v = Math.max(v, item.version)
      }
      return v
    }
    const userId = getUserId()
    return userId ? (queryClient.getQueryData<Order>(queryKeys.user(userId).order(e.resource.id))?.version ?? 0) : 0
  }

  function knownVersion(key: string) {
    return versions.get(key) ?? 0
  }

  function applyNft(e: NftUpdatedEvent) {
    queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(e.data.nftId), (old) => (old ? patchDetail(old, e) : old))
    queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() }, (old) =>
      old && old.items.some((i) => i.id === e.data.nftId) ? { ...old, items: old.items.map((i) => patchSummary(i, e)) } : old,
    )
    queryClient.setQueryData<FeaturedResponse>(queryKeys.nfts.featured(), (old) =>
      old ? { hero: old.hero.map((i) => patchSummary(i, e)), spotlight: patchSummary(old.spotlight, e) } : old,
    )
    // Cart lines and quotes are server-computed: refetch them if this NFT is in a cached cart.
    for (const [key, cart] of queryClient.getQueriesData<Cart>({ predicate: (q) => isCartKey(q.queryKey) })) {
      if (!cart?.lines.some((l) => l.nftId === e.data.nftId)) continue
      const owner = key.slice(0, 2)
      void queryClient.invalidateQueries({ queryKey: [...owner, 'cart'] })
      void queryClient.invalidateQueries({ queryKey: [...owner, 'quote'] })
    }
  }

  function applyOrder(e: OrderUpdatedEvent, userId: string): ReconcileOutcome {
    const keys = queryKeys.user(userId)
    const current = queryClient.getQueryData<Order>(keys.order(e.data.orderId))
    if (current && isTerminalOrderStatus(current.status)) return 'stale'
    if (current) {
      queryClient.setQueryData<Order>(keys.order(e.data.orderId), {
        ...current,
        status: e.data.status,
        transaction: e.data.transaction,
        declineReason: e.data.declineReason,
        updatedAt: e.data.updatedAt,
        version: e.version,
      })
    } else {
      void queryClient.invalidateQueries({ queryKey: keys.order(e.data.orderId) })
    }
    void queryClient.invalidateQueries({ queryKey: [...keys.orders(), 'list'] })
    // A confirmed purchase removes the bought lines server-side.
    if (e.data.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: queryKeys.owner({ kind: 'user', userId }).cart() })
    return 'applied'
  }

  function handle(payload: unknown): ReconcileResult {
    const parsed = realtimeEventSchema.safeParse(payload)
    if (!parsed.success) {
      log('[realtime] dropped invalid event', parsed.error.issues)
      return { outcome: 'invalid', event: null }
    }
    const e = parsed.data
    if (seen.has(e.id)) return { outcome: 'duplicate', event: e }
    seen.add(e.id)

    const userId = getUserId()
    if (e.type === 'order.updated' && e.userId !== userId) return { outcome: 'foreign', event: e }

    const key = resourceKey(e)
    if (e.version <= Math.max(knownVersion(key), cachedVersion(e))) return { outcome: 'stale', event: e }

    let outcome: ReconcileOutcome = 'applied'
    if (e.type === 'nft.updated') applyNft(e)
    else outcome = applyOrder(e, userId!)
    if (outcome === 'applied') versions.set(key, e.version)
    return { outcome, event: e }
  }

  function noteVersion(key: string, version: number) {
    if (version > knownVersion(key)) versions.set(key, version)
  }

  function onReconnect() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all() })
    void queryClient.invalidateQueries({ predicate: (q) => isCartKey(q.queryKey) || isQuoteKey(q.queryKey) })
    const userId = getUserId()
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.user(userId).orders() })
  }

  return { handle, noteVersion, knownVersion, onReconnect }
}
