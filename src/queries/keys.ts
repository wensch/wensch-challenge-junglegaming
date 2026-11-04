/**
 * Query key factory (ARCHITECTURE §7, §9). Single place where keys are spelled.
 *
 * - Public data: `['nfts', ...]` (never depends on who is logged in).
 * - Session: `['session']` — the only auth query outside the private prefix.
 * - Private data: ALWAYS `['u', userId, ...]`. Teardown removes the whole `['u']` prefix.
 * - Visitor data: `['guest', guestId, ...]` (cart and quote before login).
 */
import type { DataTag } from '@tanstack/react-query'
import { nftListQuerySchema, type ApiError, type Cart, type FeaturedResponse, type NftDetail, type NftListQuery, type Network, type Order, type OrderStatus } from '@/api/contracts'

/** Attaches the cached data type to a key (getQueryData/setQueryData infer it; queryOptions check it). */
declare const normalizedBrand: unique symbol
/** `NftListQuery` that went through `normalizeNftListQuery` (defaults applied, lists canonical). */
export type NormalizedNftListQuery = NftListQuery & { readonly [normalizedBrand]: true }

/** Canonical list query: defaults applied, lists sorted/unique, so `{}` and `{ pageSize: 9 }` share one key. */
export function normalizeNftListQuery(query: Partial<NftListQuery>): NormalizedNftListQuery {
  return nftListQuerySchema.parse(query) as NormalizedNftListQuery
}

const tag = <T>() => <const K extends readonly unknown[]>(key: K) => key as DataTag<K, T, ApiError>

export const PRIVATE_PREFIX = 'u' as const
export const GUEST_PREFIX = 'guest' as const

/** Who owns a cart/quote: the logged user or the visitor id. */
export type CartOwner = { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string }

const ownerRoot = (owner: CartOwner) => (owner.kind === 'user' ? ([PRIVATE_PREFIX, owner.userId] as const) : ([GUEST_PREFIX, owner.guestId] as const))

export const queryKeys = {
  session: () => ['session'] as const,

  nfts: {
    all: () => ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    /** Only the NORMALIZED query (`normalizeNftListQuery`): a raw partial would split `{}` from `{ pageSize: 9 }`. */
    list: (query: NormalizedNftListQuery) => ['nfts', 'list', query] as const,
    details: () => ['nfts', 'detail'] as const,
    detail: (nftId: string) => tag<NftDetail>()(['nfts', 'detail', nftId]),
    featured: () => tag<FeaturedResponse>()(['nfts', 'featured']),
  },

  /** Every private key of every user (teardown target). */
  allPrivate: () => [PRIVATE_PREFIX] as const,
  allGuest: () => [GUEST_PREFIX] as const,

  user: (userId: string) => ({
    all: () => [PRIVATE_PREFIX, userId] as const,
    favorites: () => [PRIVATE_PREFIX, userId, 'favorites'] as const,
    orders: () => [PRIVATE_PREFIX, userId, 'orders'] as const,
    order: (orderId: string) => tag<Order>()([PRIVATE_PREFIX, userId, 'orders', 'detail', orderId]),
    orderList: (status?: OrderStatus) => [PRIVATE_PREFIX, userId, 'orders', 'list', status ?? 'all'] as const,
    profile: () => [PRIVATE_PREFIX, userId, 'profile'] as const,
    wallets: () => [PRIVATE_PREFIX, userId, 'wallets'] as const,
  }),

  owner: (owner: CartOwner) => ({
    cart: () => tag<Cart>()([...ownerRoot(owner), 'cart']),
    quotes: () => [...ownerRoot(owner), 'quote'] as const,
    quote: (network: Network) => [...ownerRoot(owner), 'quote', network] as const,
  }),
} as const

/** True for keys of the form `[u|guest, id, 'cart']`. */
export function isCartKey(key: readonly unknown[]): boolean {
  return (key[0] === PRIVATE_PREFIX || key[0] === GUEST_PREFIX) && key[2] === 'cart'
}

/** True for keys of the form `[u|guest, id, 'quote', ...]`. */
export function isQuoteKey(key: readonly unknown[]): boolean {
  return (key[0] === PRIVATE_PREFIX || key[0] === GUEST_PREFIX) && key[2] === 'quote'
}
