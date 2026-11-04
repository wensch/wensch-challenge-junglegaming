/**
 * "Add to cart" (slice S1). Only adds an item; the rest of the cart mutations live in
 * `cart-mutations.ts` (S3). The owner (logged user or visitor id) is resolved when the mutation runs:
 * a visitor gets a guest id first (`ensureGuestId`), so the cart key exists before the request.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, ApiError, Cart } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { ensureGuestId, getToken } from '@/session/store'
import { queryKeys } from './keys'
import { credentialOf, isCurrentOwner, ownerKey, type OwnerCredential } from './owner'
import { cachedSession } from './session'

function resolveOwner(session: ReturnType<typeof cachedSession>): OwnerCredential {
  const token = getToken()
  if (token && session && session.token === token) return { kind: 'user', userId: session.user.id, token }
  return { kind: 'guest', guestId: ensureGuestId() }
}

export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation<{ cart: Cart; owner: OwnerCredential }, ApiError, AddCartItemRequest>({
    mutationKey: ['cart', 'add'],
    mutationFn: async (body) => {
      const owner = resolveOwner(cachedSession(queryClient))
      const cart = await cartApi.addCartItem(body, { as: credentialOf(owner) })
      return { cart, owner }
    },
    onSuccess: ({ cart, owner }) => {
      // The identity may have changed while the request was in flight: never write for somebody else.
      if (!isCurrentOwner(owner)) return
      const keys = queryKeys.owner(ownerKey(owner))
      queryClient.setQueryData(keys.cart(), cart)
      void queryClient.invalidateQueries({ queryKey: keys.quotes() })
    },
  })
}
