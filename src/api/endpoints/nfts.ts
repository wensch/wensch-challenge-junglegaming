/** NFT catalog endpoints (API-2). */
import { buildPath, endpoints, toNftListParams, type NftListQuery } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const listNfts = (query: Partial<NftListQuery>, opts: CallOptions = {}) =>
  send(endpoints.listNfts, { path: buildPath(endpoints.listNfts.path), query: toNftListParams(query), ...opts })

export const getFeatured = (opts: CallOptions = {}) => send(endpoints.getFeatured, { path: buildPath(endpoints.getFeatured.path), ...opts })

export const getNft = (nftId: string, opts: CallOptions = {}) =>
  send(endpoints.getNft, { path: buildPath(endpoints.getNft.path, { nftId }), ...opts })
