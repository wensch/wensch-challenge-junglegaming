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
 *     the server computes (cart, quote, order lists);
 *  6. no regression by in-flight REST — the last applied event of each resource is kept; when a REST
 *     fetch that left BEFORE the event lands with an older `version`, the event is re-applied on top
 *     of it (a terminal order is never turned back into pending). An event that finds the resource
 *     still loading (no data yet) is kept the same way, so the first response cannot erase it.
 *     Queries built with `src/queries` also use `structuralSharing: keepNewest` (second guard).
 * After a reconnection `onReconnect` invalidates the active resources: REST is the truth after a gap.
 */
import type { QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query'
import {
  isTerminalOrderStatus,
  realtimeEventSchema,
  resourceKey,
  type Cart,
  type FavoritesResponse,
  type FeaturedResponse,
  type NftDetail,
  type NftListResponse,
  type NftSummary,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/api/contracts'
import { isCartKey, isQuoteKey, PRIVATE_PREFIX, queryKeys } from '@/queries/keys'

export type ReconcileOutcome = 'applied' | 'invalid' | 'duplicate' | 'foreign' | 'stale'

export interface ReconcileResult {
  outcome: ReconcileOutcome
  event: RealtimeEvent | null
}

export interface ReconcilerOptions {
  queryClient: QueryClient
  /** User of the session that owns the socket (`null` for visitors). */
  getUserId: () => string | null
  /** Max remembered event ids (and last events per resource). */
  maxSeen?: number
  log?: (message: string, detail?: unknown) => void
}

export interface Reconciler {
  handle(payload: unknown): ReconcileResult
  /** Feed a version observed through REST (keeps late/duplicated events from regressing state). */
  noteVersion(key: string, version: number): void
  knownVersion(key: string): number
  onReconnect(): void
  /** Stops watching the query cache (socket teardown). */
  dispose(): void
}

/** Bounded map; insertion order = recency (oldest entry evicted first). */
class Lru<V> {
  private readonly items = new Map<string, V>()
  constructor(private readonly max: number) {}
  get(key: string) {
    return this.items.get(key)
  }
  has(key: string) {
    return this.items.has(key)
  }
  set(key: string, value: V) {
    this.items.delete(key)
    this.items.set(key, value)
    if (this.items.size > this.max) {
      const oldest = this.items.keys().next().value
      if (oldest !== undefined) this.items.delete(oldest)
    }
  }
  get size() {
    return this.items.size
  }
}

function patchSummary<T extends NftSummary>(item: T, e: NftUpdatedEvent): T {
  if (item.id !== e.data.nftId || item.version >= e.version) return item
  return { ...item, price: e.data.price, compareAtPrice: e.data.compareAtPrice, available: e.data.available, soldOut: e.data.soldOut, version: e.version }
}

function patchDetail(detail: NftDetail, e: NftUpdatedEvent): NftDetail {
  if (detail.id !== e.data.nftId || detail.version >= e.version) return detail
  const byId = new Map(e.data.editions.map((ed) => [ed.id, ed]))
  return {
    ...patchSummary(detail, e),
    editions: detail.editions.map((ed) => {
      const next = byId.get(ed.id)
      return next ? { ...ed, price: next.price, available: next.available } : ed
    }),
  }
}

function patchList(list: NftListResponse, e: NftUpdatedEvent): NftListResponse {
  if (!list.items.some((i) => i.id === e.data.nftId && i.version < e.version)) return list
  return { ...list, items: list.items.map((i) => patchSummary(i, e)) }
}

function patchFeatured(f: FeaturedResponse, e: NftUpdatedEvent): FeaturedResponse {
  const hero = f.hero.map((i) => patchSummary(i, e))
  const spotlight = patchSummary(f.spotlight, e)
  return hero.every((h, i) => h === f.hero[i]) && spotlight === f.spotlight ? f : { hero, spotlight }
}

function patchFavorites(fav: FavoritesResponse, e: NftUpdatedEvent): FavoritesResponse {
  if (!fav.items.some((i) => i.id === e.data.nftId && i.version < e.version)) return fav
  return { ...fav, items: fav.items.map((i) => patchSummary(i, e)) }
}

function patchOrder(order: Order, e: OrderUpdatedEvent): Order {
  if (order.id !== e.data.orderId || isTerminalOrderStatus(order.status) || order.version >= e.version) return order
  return { ...order, status: e.data.status, transaction: e.data.transaction, declineReason: e.data.declineReason, updatedAt: e.data.updatedAt, version: e.version }
}

const isNftKey = (key: readonly unknown[], part: 'detail' | 'list' | 'featured') => key[0] === 'nfts' && key[1] === part
const isFavoritesKey = (key: readonly unknown[]) => key[0] === PRIVATE_PREFIX && key[2] === 'favorites'
const isOrderDetailKey = (key: readonly unknown[]) => key[0] === PRIVATE_PREFIX && key[2] === 'orders' && key[3] === 'detail'

export function createReconciler({ queryClient, getUserId, maxSeen = 500, log = () => {} }: ReconcilerOptions): Reconciler {
  const seen = new Lru<true>(maxSeen)
  const versions = new Map<string, number>()
  const lastNft = new Lru<NftUpdatedEvent>(maxSeen)
  const lastOrder = new Lru<OrderUpdatedEvent>(maxSeen)

  function cachedVersion(e: RealtimeEvent): number {
    if (e.type === 'nft.updated') {
      let v = queryClient.getQueryData(queryKeys.nfts.detail(e.resource.id))?.version ?? 0
      for (const [, list] of queryClient.getQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() })) {
        for (const item of list?.items ?? []) if (item.id === e.resource.id) v = Math.max(v, item.version)
      }
      return v
    }
    const userId = getUserId()
    return userId ? (queryClient.getQueryData(queryKeys.user(userId).order(e.resource.id))?.version ?? 0) : 0
  }

  function knownVersion(key: string) {
    return versions.get(key) ?? 0
  }

  function applyNft(e: NftUpdatedEvent) {
    queryClient.setQueryData(queryKeys.nfts.detail(e.data.nftId), (old) => (old ? patchDetail(old, e) : old))
    queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() }, (old) => (old ? patchList(old, e) : old))
    queryClient.setQueryData(queryKeys.nfts.featured(), (old) => (old ? patchFeatured(old, e) : old))
    // The favorites list stores summaries too (`['u', userId, 'favorites']`): price/stock change there as well.
    queryClient.setQueriesData<FavoritesResponse>({ predicate: (q) => isFavoritesKey(q.queryKey) }, (old) => (old ? patchFavorites(old, e) : old))
    // Cart lines and quotes are server-computed: refetch them if this NFT is in a cached cart.
    for (const [key, cart] of queryClient.getQueriesData<Cart>({ predicate: (q) => isCartKey(q.queryKey) })) {
      if (!cart?.lines.some((l) => l.nftId === e.data.nftId)) continue
      const owner = key.slice(0, 2)
      void queryClient.invalidateQueries({ queryKey: [...owner, 'cart'] })
      void queryClient.invalidateQueries({ queryKey: [...owner, 'quote'] })
    }
  }

  function applyOrder(e: OrderUpdatedEvent): ReconcileOutcome {
    const keys = queryKeys.user(e.userId)
    const key = keys.order(e.data.orderId)
    const current = queryClient.getQueryData(key)
    if (current && isTerminalOrderStatus(current.status)) return 'stale'
    if (current) queryClient.setQueryData(key, patchOrder(current, e))
    // Not loaded and not loading: whoever opens it fetches the current state. (If it IS loading, the
    // cache guard below re-applies this event over the response.)
    else if (queryClient.isFetching({ queryKey: key }) === 0) void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({ queryKey: [...keys.orders(), 'list'] })
    // A confirmed purchase removes the bought lines server-side.
    if (e.data.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: queryKeys.owner({ kind: 'user', userId: e.userId }).cart() })
    return 'applied'
  }

  /**
   * Second half of the version guard: a FETCH result (not a manual write) older than the last applied
   * event of a resource gets that event re-applied on top of it, synchronously, before anyone reads it.
   */
  function onCacheEvent(event: QueryCacheNotifyEvent) {
    if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual) return
    const key = event.query.queryKey
    const data: unknown = event.query.state.data
    if (data === undefined) return

    if (lastNft.size > 0 && key[0] === 'nfts') {
      if (isNftKey(key, 'detail')) {
        const e = lastNft.get(`nft:${String(key[2])}`)
        if (e && (data as NftDetail).version < e.version) queryClient.setQueryData(queryKeys.nfts.detail(e.data.nftId), (old) => (old ? patchDetail(old, e) : old))
        return
      }
      const isList = isNftKey(key, 'list')
      if (!isList && !isNftKey(key, 'featured')) return
      const items: NftSummary[] = isList ? (data as NftListResponse).items : [...(data as FeaturedResponse).hero, (data as FeaturedResponse).spotlight]
      for (const item of items) {
        const e = lastNft.get(`nft:${item.id}`)
        if (!e || item.version >= e.version) continue
        if (isList) queryClient.setQueryData<NftListResponse>(key, (old) => (old ? patchList(old, e) : old))
        else queryClient.setQueryData(queryKeys.nfts.featured(), (old) => (old ? patchFeatured(old, e) : old))
      }
      return
    }

    if (lastOrder.size > 0 && isOrderDetailKey(key)) {
      const e = lastOrder.get(`order:${String(key[4])}`)
      const order = data as Order
      if (e && e.userId === key[1] && order.version < e.version && !isTerminalOrderStatus(order.status)) {
        queryClient.setQueryData(queryKeys.user(e.userId).order(e.data.orderId), (old) => (old ? patchOrder(old, e) : old))
      }
    }
  }
  const unsubscribe = queryClient.getQueryCache().subscribe(onCacheEvent)

  function handle(payload: unknown): ReconcileResult {
    const parsed = realtimeEventSchema.safeParse(payload)
    if (!parsed.success) {
      log('[realtime] dropped invalid event', parsed.error.issues)
      return { outcome: 'invalid', event: null }
    }
    const e = parsed.data
    if (seen.has(e.id)) return { outcome: 'duplicate', event: e }
    seen.set(e.id, true)

    if (e.type === 'order.updated' && e.userId !== getUserId()) return { outcome: 'foreign', event: e }

    const key = resourceKey(e)
    if (e.version <= Math.max(knownVersion(key), cachedVersion(e))) return { outcome: 'stale', event: e }

    let outcome: ReconcileOutcome = 'applied'
    if (e.type === 'nft.updated') {
      applyNft(e)
      lastNft.set(key, e)
    } else {
      outcome = applyOrder(e)
      if (outcome === 'applied') lastOrder.set(key, e)
    }
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

  return { handle, noteVersion, knownVersion, onReconnect, dispose: unsubscribe }
}
