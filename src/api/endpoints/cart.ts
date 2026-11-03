/** Cart endpoints (API-4). Credentials: Authorization when logged in, otherwise X-Guest-Id (client.ts). */
import { buildPath, endpoints, type AddCartItemRequest, type ApplyCouponRequest, type MergeCartRequest, type UpdateCartItemRequest } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const getCart = (opts: CallOptions = {}) => send(endpoints.getCart, { path: buildPath(endpoints.getCart.path), ...opts })

export const addCartItem = (body: AddCartItemRequest, opts: CallOptions = {}) =>
  send(endpoints.addCartItem, { path: buildPath(endpoints.addCartItem.path), body, ...opts })

export const updateCartItem = (lineId: string, body: UpdateCartItemRequest, opts: CallOptions = {}) =>
  send(endpoints.updateCartItem, { path: buildPath(endpoints.updateCartItem.path, { lineId }), body, ...opts })

export const removeCartItem = (lineId: string, opts: CallOptions = {}) =>
  send(endpoints.removeCartItem, { path: buildPath(endpoints.removeCartItem.path, { lineId }), ...opts })

export const mergeCart = (body: MergeCartRequest, opts: CallOptions = {}) =>
  send(endpoints.mergeCart, { path: buildPath(endpoints.mergeCart.path), body, ...opts })

export const applyCoupon = (body: ApplyCouponRequest, opts: CallOptions = {}) =>
  send(endpoints.applyCoupon, { path: buildPath(endpoints.applyCoupon.path), body, ...opts })

export const removeCoupon = (opts: CallOptions = {}) => send(endpoints.removeCoupon, { path: buildPath(endpoints.removeCoupon.path), ...opts })
