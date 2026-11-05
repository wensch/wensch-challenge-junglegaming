/** Cart query (shared by the header badge and the cart screen). */
import { queryOptions, skipToken, useQuery, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { ApiError, Cart } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { useGuestId } from '@/session/useGuestId'
import { STALE } from './client'
import { queryKeys } from './keys'
import { ownedQueryFn, ownerKey, type OwnerCredential } from './owner'
import { useSession } from './session'
import { keepNewest } from './versioned'

/** Key used while there is no cart owner yet (visitor without guest id). Never fetched (`skipToken`). */
const NO_CART_KEY = ['cart', 'none'] as const

const fetchCartOf = (owner: OwnerCredential) => ownedQueryFn(owner, (as, signal) => cartApi.getCart({ signal, as }))

/** Cart of `owner`, fetched with the owner's own credential (Authorization or X-Guest-Id). */
const cartQueryOptions = (owner: OwnerCredential) =>
  queryOptions({
    queryKey: queryKeys.owner(ownerKey(owner)).cart(),
    queryFn: fetchCartOf(owner),
    staleTime: STALE.cart,
    // The cart is versioned; a late GET (or a merge written meanwhile) can never move it backwards.
    structuralSharing: keepNewest,
  })

/** Cart and quote are server-computed: after any cart mutation or event both must be re-read. */
export function invalidateCartAndQuote(queryClient: QueryClient, owner: OwnerCredential): Promise<unknown> {
  const keys = queryKeys.owner(ownerKey(owner))
  return Promise.all([queryClient.invalidateQueries({ queryKey: keys.cart() }), queryClient.invalidateQueries({ queryKey: keys.quotes() })])
}

/**
 * Owner of the current cart: the logged user (with its token), the existing visitor id, or `null`
 * when a visitor has never created a cart (no request is needed to know it is empty). Reactive to
 * the guest id (created by `ensureGuestId()` before the first visitor mutation).
 */
export function useCartOwner(): OwnerCredential | null {
  const session = useSession()
  const guestId = useGuestId()
  if (session.isPending) return null
  if (session.data) return { kind: 'user', userId: session.data.user.id, token: session.data.token }
  return guestId ? { kind: 'guest', guestId } : null
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery<Cart, ApiError, Cart, QueryKey>({
    queryKey: owner ? cartQueryOptions(owner).queryKey : NO_CART_KEY,
    queryFn: owner ? fetchCartOf(owner) : skipToken,
    staleTime: STALE.cart,
    structuralSharing: keepNewest,
  })
}
