/**
 * Quote query (ARCHITECTURE §6, §7): the ONLY source of subtotal, discount, fee and total shown in
 * the cart summary and the checkout. Same cart => same quote id; `version` bumps when anything
 * monetary or availability-related changes. Always stale (`staleTime: 0`) and short-lived (`gcTime`),
 * refetched when the cart page / review opens and after cart mutations or `nft.updated` events.
 */
import { queryOptions, skipToken, useQuery, type QueryKey } from '@tanstack/react-query'
import type { ApiError, Network, Quote } from '@/api/contracts'
import { quoteApi } from '@/api/endpoints'
import { STALE } from './client'
import { queryKeys } from './keys'
import { ownedQueryFn, ownerKey, type OwnerCredential } from './owner'
import { keepNewest } from './versioned'

export const QUOTE_GC_MS = 30_000
const NO_QUOTE_KEY = ['quote', 'none'] as const

export const quoteQueryKey = (owner: OwnerCredential, network: Network) => queryKeys.owner(ownerKey(owner)).quote(network)

const fetchQuote = (owner: OwnerCredential, network: Network) => ownedQueryFn(owner, (as, signal) => quoteApi.createQuote({ network }, { signal, as }))

export const quoteQueryOptions = (owner: OwnerCredential, network: Network) =>
  queryOptions({
    queryKey: quoteQueryKey(owner, network),
    queryFn: fetchQuote(owner, network),
    staleTime: STALE.quote,
    gcTime: QUOTE_GC_MS,
    structuralSharing: keepNewest,
  })

/** Quote of the current cart for `network`. Disabled (no request) without owner or with an empty cart. */
export function useQuote(owner: OwnerCredential | null, network: Network, enabled: boolean) {
  return useQuery<Quote, ApiError, Quote, QueryKey>({
    queryKey: owner ? quoteQueryKey(owner, network) : NO_QUOTE_KEY,
    queryFn: owner && enabled ? fetchQuote(owner, network) : skipToken,
    staleTime: STALE.quote,
    gcTime: QUOTE_GC_MS,
    structuralSharing: keepNewest,
  })
}
