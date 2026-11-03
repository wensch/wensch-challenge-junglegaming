/** Cart query (shared by the header badge and the cart slice). */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { cartApi } from '@/api/endpoints'
import { peekGuestId } from '@/session/store'
import { STALE } from './client'
import { queryKeys, type CartOwner } from './keys'
import { useSession } from './session'

export const cartQueryOptions = (owner: CartOwner) =>
  queryOptions({
    queryKey: queryKeys.owner(owner).cart(),
    // Credentials come from the session store (Authorization or X-Guest-Id), which matches `owner`.
    queryFn: ({ signal }) => cartApi.getCart({ signal }),
    staleTime: STALE.cart,
  })

/**
 * Owner of the current cart: the logged user, the existing visitor id, or `null` when a visitor has
 * never created a cart (no request is needed to know it is empty).
 */
export function useCartOwner(): CartOwner | null {
  const session = useSession()
  if (session.isPending) return null
  if (session.data) return { kind: 'user', userId: session.data.user.id }
  const guestId = peekGuestId()
  return guestId ? { kind: 'guest', guestId } : null
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({ ...cartQueryOptions(owner ?? { kind: 'guest', guestId: 'none' }), enabled: owner !== null })
}
