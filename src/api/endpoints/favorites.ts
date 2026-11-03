/** Favorites endpoints (API-3). */
import { buildPath, endpoints } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const listFavorites = (opts: CallOptions = {}) => send(endpoints.listFavorites, { path: buildPath(endpoints.listFavorites.path), ...opts })

export const addFavorite = (nftId: string, opts: CallOptions = {}) =>
  send(endpoints.addFavorite, { path: buildPath(endpoints.addFavorite.path, { nftId }), ...opts })

export const removeFavorite = (nftId: string, opts: CallOptions = {}) =>
  send(endpoints.removeFavorite, { path: buildPath(endpoints.removeFavorite.path, { nftId }), ...opts })
