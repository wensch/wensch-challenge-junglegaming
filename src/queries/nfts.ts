/**
 * Typed queryOptions for the catalog (ARCHITECTURE §7). Slices and the reconciler use these, so the
 * cache shape of each key is declared once (`DataTag`) and every write goes through `keepNewest`.
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { nftListQuerySchema, type NftListQuery } from '@/api/contracts'
import { nftsApi } from '@/api/endpoints'
import { STALE } from './client'
import { queryKeys } from './keys'
import { keepNewest } from './versioned'

export type NftListQueryInput = Partial<NftListQuery>

/** Canonical list query: defaults applied, lists sorted/unique, so `{}` and `{ pageSize: 9 }` share one key. */
export function normalizeNftListQuery(query: NftListQueryInput): NftListQuery {
  return nftListQuerySchema.parse(query)
}

export const nftQueries = {
  list: (query: NftListQueryInput) => {
    const normalized = normalizeNftListQuery(query)
    return queryOptions({
      queryKey: queryKeys.nfts.list(normalized),
      queryFn: ({ signal }) => nftsApi.listNfts(normalized, { signal }),
      staleTime: STALE.catalog,
      placeholderData: keepPreviousData,
      structuralSharing: keepNewest,
    })
  },
  featured: () =>
    queryOptions({
      queryKey: queryKeys.nfts.featured(),
      queryFn: ({ signal }) => nftsApi.getFeatured({ signal }),
      staleTime: STALE.featured,
      structuralSharing: keepNewest,
    }),
  detail: (nftId: string) =>
    queryOptions({
      queryKey: queryKeys.nfts.detail(nftId),
      queryFn: ({ signal }) => nftsApi.getNft(nftId, { signal }),
      staleTime: STALE.catalog,
      structuralSharing: keepNewest,
    }),
}
