/** Catalog domain: views over NftRec, listing/filtering, and the only mutation path that emits nft.updated. */
import {
  CATEGORIES,
  NETWORKS,
  type Edition,
  type NftDetail,
  type NftListQuery,
  type NftListResponse,
  type NftSummary,
  type NftUpdatedEvent,
} from '@/api/contracts'
import { compare, isEth, normalize } from '@/lib/money'
import { db, nextId, nowIso, persist, type NftRec } from './db'
import { broadcast } from './realtime'

export const findNft = (id: string): NftRec | undefined => db().nfts.find((n) => n.id === id)
export const findEdition = (n: NftRec, editionId: string): Edition | undefined => n.editions.find((e) => e.id === editionId)
const defaultEdition = (n: NftRec): Edition => findEdition(n, n.defaultEditionId) ?? n.editions[0]!

export function summary(n: NftRec): NftSummary {
  const d = defaultEdition(n)
  const available = n.editions.reduce((acc, e) => acc + e.available, 0)
  return {
    id: n.id,
    name: n.name,
    tokenId: n.tokenId,
    collection: n.collection,
    category: n.category,
    network: n.network,
    image: n.image,
    defaultEditionId: d.id,
    price: d.price,
    compareAtPrice: d.compareAtPrice,
    available,
    soldOut: available === 0,
    listedAt: n.listedAt,
    isNew: n.isNew,
    isTrending: n.isTrending,
    version: n.version,
  }
}

export function detail(n: NftRec): NftDetail {
  return {
    ...summary(n),
    description: n.description,
    longDescription: n.longDescription,
    gallery: n.gallery,
    attributes: n.attributes,
    contract: n.contract,
    royaltyPercent: n.royaltyPercent,
    rating: n.rating,
    reviews: n.reviews,
    provenance: n.provenance,
    editions: n.editions,
  }
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Skip = 'categories' | 'networks' | 'price' | null

function matches(s: NftSummary, q: NftListQuery, skip: Skip): boolean {
  if (q.tab === 'new' && !s.isNew) return false
  if (q.tab === 'trending' && !s.isTrending) return false
  if (q.collectionId && s.collection.id !== q.collectionId) return false
  if (q.excludeId && s.id === q.excludeId) return false
  if (q.q) {
    const hay = fold(`${s.name} ${s.tokenId} ${s.collection.name}`)
    if (!fold(q.q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false
  }
  if (skip !== 'categories' && q.categories.length && !q.categories.includes(s.category)) return false
  if (skip !== 'networks' && q.networks.length && !q.networks.includes(s.network)) return false
  if (skip !== 'price') {
    if (q.priceMin !== undefined && compare(s.price, q.priceMin) < 0) return false
    if (q.priceMax !== undefined && compare(s.price, q.priceMax) > 0) return false
  }
  return true
}

function sortItems(items: NftSummary[], sort: NftListQuery['sort']): NftSummary[] {
  const byRecent = (a: NftSummary, b: NftSummary) => b.listedAt.localeCompare(a.listedAt) || a.id.localeCompare(b.id)
  const copy = [...items]
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => compare(a.price, b.price) || byRecent(a, b))
    case 'price_desc':
      return copy.sort((a, b) => compare(b.price, a.price) || byRecent(a, b))
    case 'name_asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
    default:
      return copy.sort(byRecent)
  }
}

export function listNfts(q: NftListQuery, empty = false): NftListResponse {
  const all = empty ? [] : db().nfts.map(summary)
  const base = all.filter((s) => matches(s, q, null))
  const sorted = sortItems(base, q.sort)
  const total = sorted.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / q.pageSize)
  const items = sorted.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)

  const withoutCat = all.filter((s) => matches(s, q, 'categories'))
  const withoutNet = all.filter((s) => matches(s, q, 'networks'))
  const withoutPrice = all.filter((s) => matches(s, q, 'price'))
  const prices = withoutPrice.map((s) => s.price).sort(compare)
  return {
    items,
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages },
    facets: {
      categories: CATEGORIES.map((value) => ({ value, count: withoutCat.filter((s) => s.category === value).length })),
      networks: NETWORKS.map((value) => ({ value, count: withoutNet.filter((s) => s.network === value).length })),
      priceRange: { min: prices[0] ?? '0', max: prices[prices.length - 1] ?? '0' },
    },
  }
}

export function featured(): { hero: NftSummary[]; spotlight: NftSummary } {
  const all = db().nfts.map(summary)
  const inStock = all.filter((s) => !s.soldOut)
  const hero = sortItems(inStock.filter((s) => s.isTrending), 'recent').slice(0, 5)
  const spotlight = inStock.find((s) => s.compareAtPrice !== null) ?? inStock[0] ?? all[0]!
  return { hero: hero.length ? hero : [spotlight], spotlight }
}

// ---------------------------------------------------------------------------
// Mutation + realtime (MSW-18): every price/stock change goes through mutateNft.
// ---------------------------------------------------------------------------

export function nftUpdatedEvent(n: NftRec): NftUpdatedEvent {
  const s = summary(n)
  return {
    id: nextId('evt', 6),
    type: 'nft.updated',
    version: n.version,
    occurredAt: nowIso(),
    resource: { kind: 'nft', id: n.id },
    data: {
      nftId: n.id,
      price: s.price,
      compareAtPrice: s.compareAtPrice,
      available: s.available,
      soldOut: s.soldOut,
      editions: n.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
}

export interface NftPatch {
  /** Price of the default edition. */
  price?: string
  editions?: { id: string; price?: string; available?: number }[]
}

/** Applies `change`, bumps the version, persists and broadcasts `nft.updated`. */
export function mutateNft(nftId: string, change: (n: NftRec) => void): NftRec | undefined {
  const n = findNft(nftId)
  if (!n) return undefined
  change(n)
  n.version += 1
  persist()
  broadcast(nftUpdatedEvent(n))
  return n
}

export function patchNft(nftId: string, patch: NftPatch): NftRec | undefined {
  return mutateNft(nftId, (n) => {
    if (patch.price !== undefined && isEth(patch.price)) {
      const d = n.editions.find((e) => e.id === n.defaultEditionId)
      if (d) d.price = normalize(patch.price)
    }
    for (const p of patch.editions ?? []) {
      const e = n.editions.find((x) => x.id === p.id)
      if (!e) continue
      if (p.price !== undefined && isEth(p.price)) e.price = normalize(p.price)
      if (p.available !== undefined) e.available = Math.max(0, Math.trunc(p.available))
    }
  })
}
