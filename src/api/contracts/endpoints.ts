/**
 * Single endpoint table shared by Axios endpoint functions (`src/api/endpoints/*`) and MSW
 * handlers (`src/mocks/handlers/*`). Paths are relative to the API base (`VITE_API_URL`, `/api`)
 * and use `:param` placeholders (MSW syntax); `buildPath` fills them on the client.
 *
 * `auth`:
 *  - public:  no credentials;
 *  - guest:   `Authorization` if logged in, otherwise `X-Guest-Id` (cart/quote);
 *  - session: requires `Authorization: Bearer` (401 UNAUTHENTICATED | SESSION_EXPIRED).
 * Every endpoint may also fail with TRANSIENT (5xx, offline, timeout).
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import type { z } from 'zod'
import { loginRequestSchema, registerRequestSchema, sessionSchema } from './auth'
import { addCartItemRequestSchema, applyCouponRequestSchema, cartSchema, mergeCartRequestSchema, mergeCartResponseSchema, updateCartItemRequestSchema } from './cart'
import { HEADERS } from './common'
import type { ApiErrorCode } from './errors'
import { favoritesResponseSchema, favoriteToggleResponseSchema } from './favorites'
import { featuredResponseSchema, nftDetailSchema, nftListQuerySchema, nftListResponseSchema } from './nfts'
import { createOrderRequestSchema, orderListQuerySchema, orderListResponseSchema, orderSchema } from './orders'
import { changePasswordRequestSchema, profileSchema, updateProfileRequestSchema } from './profile'
import { createQuoteRequestSchema, quoteSchema } from './quote'
import { connectWalletRequestSchema, createWalletRequestSchema, updateWalletRequestSchema, walletConnectionSchema, walletSchema, walletsResponseSchema } from './wallets'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type EndpointAuth = 'public' | 'guest' | 'session'

export interface EndpointDef {
  method: HttpMethod
  path: `/${string}`
  auth: EndpointAuth
  /** Query string schema (parsed from URLSearchParams by MSW). */
  query?: z.ZodType
  /** JSON body schema; `'multipart'` for FormData uploads. */
  body?: z.ZodType | 'multipart'
  /** Success body schema; `null` = 204 No Content. */
  response: z.ZodType | null
  /** Success status (201 for creations; POST /orders replays answer 200). */
  status: 200 | 201 | 204
  /** Domain errors this endpoint may return (TRANSIENT and auth errors are implied by `auth`). */
  errors: readonly ApiErrorCode[]
  /** Required headers besides auth. */
  headers?: readonly string[]
}

const SESSION_ERRORS = ['UNAUTHENTICATED', 'SESSION_EXPIRED'] as const satisfies readonly ApiErrorCode[]

export const endpoints = {
  // --- Session & account (API-1) ---
  register: { method: 'POST', path: '/auth/register', auth: 'public', body: registerRequestSchema, response: sessionSchema, status: 201, errors: ['VALIDATION', 'EMAIL_TAKEN'] },
  login: { method: 'POST', path: '/auth/login', auth: 'public', body: loginRequestSchema, response: sessionSchema, status: 200, errors: ['VALIDATION', 'UNAUTHENTICATED'] },
  getSession: { method: 'GET', path: '/session', auth: 'session', response: sessionSchema, status: 200, errors: [] },
  logout: { method: 'POST', path: '/auth/logout', auth: 'session', response: null, status: 204, errors: [] },

  // --- NFTs (API-2) ---
  listNfts: { method: 'GET', path: '/nfts', auth: 'public', query: nftListQuerySchema, response: nftListResponseSchema, status: 200, errors: ['VALIDATION'] },
  getFeatured: { method: 'GET', path: '/nfts/featured', auth: 'public', response: featuredResponseSchema, status: 200, errors: [] },
  getNft: { method: 'GET', path: '/nfts/:nftId', auth: 'public', response: nftDetailSchema, status: 200, errors: ['NOT_FOUND'] },

  // --- Favorites (API-3) ---
  listFavorites: { method: 'GET', path: '/favorites', auth: 'session', response: favoritesResponseSchema, status: 200, errors: [] },
  addFavorite: { method: 'PUT', path: '/favorites/:nftId', auth: 'session', response: favoriteToggleResponseSchema, status: 200, errors: ['NOT_FOUND'] },
  removeFavorite: { method: 'DELETE', path: '/favorites/:nftId', auth: 'session', response: favoriteToggleResponseSchema, status: 200, errors: [] },

  // --- Cart (API-4) ---
  getCart: { method: 'GET', path: '/cart', auth: 'guest', response: cartSchema, status: 200, errors: [] },
  addCartItem: { method: 'POST', path: '/cart/items', auth: 'guest', body: addCartItemRequestSchema, response: cartSchema, status: 200, errors: ['VALIDATION', 'NOT_FOUND', 'CONFLICT_AVAILABILITY'] },
  updateCartItem: { method: 'PATCH', path: '/cart/items/:lineId', auth: 'guest', body: updateCartItemRequestSchema, response: cartSchema, status: 200, errors: ['VALIDATION', 'NOT_FOUND', 'CONFLICT_AVAILABILITY'] },
  removeCartItem: { method: 'DELETE', path: '/cart/items/:lineId', auth: 'guest', response: cartSchema, status: 200, errors: ['NOT_FOUND'] },
  mergeCart: { method: 'POST', path: '/cart/merge', auth: 'session', body: mergeCartRequestSchema, response: mergeCartResponseSchema, status: 200, errors: ['VALIDATION'] },
  applyCoupon: { method: 'PUT', path: '/cart/coupon', auth: 'guest', body: applyCouponRequestSchema, response: cartSchema, status: 200, errors: ['VALIDATION', 'COUPON_INVALID', 'COUPON_EXPIRED'] },
  removeCoupon: { method: 'DELETE', path: '/cart/coupon', auth: 'guest', response: cartSchema, status: 200, errors: [] },

  // --- Quote (API-5) ---
  createQuote: { method: 'POST', path: '/quotes', auth: 'guest', body: createQuoteRequestSchema, response: quoteSchema, status: 200, errors: ['VALIDATION'] },

  // --- Orders (API-6, API-10) ---
  createOrder: {
    method: 'POST',
    path: '/orders',
    auth: 'session',
    body: createOrderRequestSchema,
    response: orderSchema,
    status: 201,
    errors: ['VALIDATION', 'FORBIDDEN', 'QUOTE_STALE', 'CONFLICT_AVAILABILITY', 'IDEMPOTENCY_CONFLICT'],
    headers: [HEADERS.idempotencyKey],
  },
  getOrder: { method: 'GET', path: '/orders/:orderId', auth: 'session', response: orderSchema, status: 200, errors: ['NOT_FOUND', 'FORBIDDEN'] },
  listOrders: { method: 'GET', path: '/orders', auth: 'session', query: orderListQuerySchema, response: orderListResponseSchema, status: 200, errors: [] },

  // --- Profile (API-7) ---
  getProfile: { method: 'GET', path: '/profile', auth: 'session', response: profileSchema, status: 200, errors: [] },
  updateProfile: { method: 'PATCH', path: '/profile', auth: 'session', body: updateProfileRequestSchema, response: profileSchema, status: 200, errors: ['VALIDATION', 'EMAIL_TAKEN'] },
  uploadAvatar: { method: 'PUT', path: '/profile/avatar', auth: 'session', body: 'multipart', response: profileSchema, status: 200, errors: ['VALIDATION'] },
  removeAvatar: { method: 'DELETE', path: '/profile/avatar', auth: 'session', response: profileSchema, status: 200, errors: [] },
  changePassword: { method: 'POST', path: '/profile/password', auth: 'session', body: changePasswordRequestSchema, response: null, status: 204, errors: ['VALIDATION'] },

  // --- Wallets (API-8) ---
  listWallets: { method: 'GET', path: '/wallets', auth: 'session', response: walletsResponseSchema, status: 200, errors: [] },
  createWallet: { method: 'POST', path: '/wallets', auth: 'session', body: createWalletRequestSchema, response: walletSchema, status: 201, errors: ['VALIDATION'] },
  updateWallet: { method: 'PATCH', path: '/wallets/:walletId', auth: 'session', body: updateWalletRequestSchema, response: walletSchema, status: 200, errors: ['VALIDATION', 'NOT_FOUND', 'FORBIDDEN'] },
  connectWallet: { method: 'POST', path: '/wallets/:walletId/connect', auth: 'session', body: connectWalletRequestSchema, response: walletConnectionSchema, status: 200, errors: ['NOT_FOUND', 'FORBIDDEN'] },
  disconnectWallet: { method: 'DELETE', path: '/wallets/:walletId/connection', auth: 'session', response: null, status: 204, errors: ['NOT_FOUND'] },
} as const satisfies Record<string, EndpointDef>

export type EndpointName = keyof typeof endpoints
export type Endpoint<N extends EndpointName> = (typeof endpoints)[N]

/** `'/orders/:orderId/x/:y'` -> `'orderId' | 'y'` */
export type PathParams<P extends string> = P extends `${string}:${infer K}/${infer Rest}`
  ? K | PathParams<`/${Rest}`>
  : P extends `${string}:${infer K}`
    ? K
    : never

type ParamsArg<P extends string> = [PathParams<P>] extends [never] ? [] : [params: Record<PathParams<P>, string>]

/** Fills `:param` placeholders with URI-encoded values. */
export function buildPath<P extends string>(path: P, ...[params]: ParamsArg<P>): string {
  if (!params) return path
  const values = params as Record<string, string>
  return path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const v = values[key]
    if (v === undefined) throw new Error(`Missing path param "${key}" for ${path}`)
    return encodeURIComponent(v)
  })
}

/** Errors a caller must be prepared for (domain + auth + TRANSIENT). */
export function possibleErrors(name: EndpointName): readonly ApiErrorCode[] {
  const e: EndpointDef = endpoints[name]
  return [...e.errors, ...(e.auth === 'session' ? SESSION_ERRORS : []), 'TRANSIENT']
}
