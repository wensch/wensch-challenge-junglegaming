/**
 * Cart mutations (ARCHITECTURE §5, §7).
 * - Quantity and removal are OPTIMISTIC: `onMutate` snapshots the cart, writes the expected state and
 *   `onError` rolls back. All mutations of one cart share a `scope`, so they run one at a time (no
 *   out-of-order PATCHes) while the UI already shows the expected value.
 * - Stale owner: every write after an `await` first checks `isCurrentOwner(owner)`. A mutation that finishes
 *   after a teardown (logout, expiry, user switch) must not write into the cache of an owner that
 *   is no longer current.
 * - Server state wins: after the LAST pending mutation of the cart settles, cart and quote are
 *   invalidated (the quote total is computed by the server, never by the client).
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Cart, CartLine } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { mulQty, sum } from '@/lib/money'
import { invalidateCartAndQuote, useCartOwner } from './cart'
import { queryKeys } from './keys'
import { credentialOf, isCurrentOwner, ownerChangedError, ownerKey, type OwnerCredential } from './owner'

type Ctx = { owner: OwnerCredential; previous: Cart | undefined }

const ownerId = (owner: OwnerCredential | null) => (owner ? (owner.kind === 'user' ? owner.userId : owner.guestId) : 'none')
const scopeOf = (owner: OwnerCredential | null) => ({ id: `cart:${ownerId(owner)}` })
const mutationKeyOf = (owner: OwnerCredential | null) => ['cart-mutation', ownerId(owner)] as const

function requireOwner(owner: OwnerCredential | null): OwnerCredential {
  if (!owner) throw ownerChangedError()
  return owner
}

const cartKeyOf = (owner: OwnerCredential) => queryKeys.owner(ownerKey(owner)).cart()

/** Recomputes derived display fields of the optimistic cart (the server answer replaces it right after). */
function withLines(cart: Cart, lines: CartLine[]): Cart {
  return { ...cart, lines, itemCount: lines.reduce((n, l) => n + l.quantity, 0), subtotal: sum(lines.map((l) => l.lineTotal)) }
}

const pendingCartMutations = (qc: QueryClient, owner: OwnerCredential) => qc.isMutating({ mutationKey: mutationKeyOf(owner) })

function optimistic(qc: QueryClient, owner: OwnerCredential, change: (cart: Cart) => Cart): Ctx {
  const key = cartKeyOf(owner)
  const previous = qc.getQueryData(key)
  if (previous) qc.setQueryData(key, change(previous))
  return { owner, previous }
}

/** Shared lifecycle: rollback (only if it is the last mutation and the owner is current), invalidate at the end. */
function lifecycle(qc: QueryClient) {
  return {
    onError: (_e: unknown, _v: unknown, ctx: Ctx | undefined) => {
      if (!ctx || !isCurrentOwner(ctx.owner)) return
      if (ctx.previous && pendingCartMutations(qc, ctx.owner) <= 1) qc.setQueryData(cartKeyOf(ctx.owner), ctx.previous)
    },
    onSuccess: (cart: Cart, _v: unknown, ctx: Ctx | undefined) => {
      if (!ctx || !isCurrentOwner(ctx.owner)) return
      if (pendingCartMutations(qc, ctx.owner) <= 1) qc.setQueryData(cartKeyOf(ctx.owner), cart)
    },
    onSettled: (_d: unknown, _e: unknown, _v: unknown, ctx: Ctx | undefined) => {
      if (!ctx || !isCurrentOwner(ctx.owner)) return
      if (pendingCartMutations(qc, ctx.owner) <= 1) void invalidateCartAndQuote(qc, ctx.owner)
    },
  }
}

/** Sets the ABSOLUTE quantity of a line (also acknowledges a price change, per the contract). */
export function useUpdateQuantity() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation<Cart, Error, { lineId: string; quantity: number }, Ctx>({
    mutationKey: mutationKeyOf(owner),
    scope: scopeOf(owner),
    mutationFn: ({ lineId, quantity }) => cartApi.updateCartItem(lineId, { quantity }, { as: credentialOf(requireOwner(owner)) }),
    onMutate: async ({ lineId, quantity }) => {
      const o = requireOwner(owner)
      await qc.cancelQueries({ queryKey: cartKeyOf(o) })
      return optimistic(qc, o, (cart) =>
        withLines(
          cart,
          cart.lines.map((l) =>
            l.id === lineId ? { ...l, quantity, lineTotal: mulQty(l.unitPrice, quantity), addedUnitPrice: l.unitPrice, status: l.status === 'price_changed' ? 'ok' : l.status } : l,
          ),
        ),
      )
    },
    ...lifecycle(qc),
  })
}

export function useRemoveLine() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation<Cart, Error, { lineId: string }, Ctx>({
    mutationKey: mutationKeyOf(owner),
    scope: scopeOf(owner),
    mutationFn: ({ lineId }) => cartApi.removeCartItem(lineId, { as: credentialOf(requireOwner(owner)) }),
    onMutate: async ({ lineId }) => {
      const o = requireOwner(owner)
      await qc.cancelQueries({ queryKey: cartKeyOf(o) })
      return optimistic(qc, o, (cart) => withLines(cart, cart.lines.filter((l) => l.id !== lineId)))
    },
    ...lifecycle(qc),
  })
}

/** Not optimistic: validity and discount are decided by the server (quote). Errors surface to the form. */
export function useApplyCoupon() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation<Cart, Error, { code: string }, Ctx>({
    mutationKey: mutationKeyOf(owner),
    scope: scopeOf(owner),
    mutationFn: ({ code }) => cartApi.applyCoupon({ code }, { as: credentialOf(requireOwner(owner)) }),
    onMutate: () => ({ owner: requireOwner(owner), previous: undefined }),
    ...lifecycle(qc),
  })
}

export function useRemoveCoupon() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation<Cart, Error, undefined, Ctx>({
    mutationKey: mutationKeyOf(owner),
    scope: scopeOf(owner),
    mutationFn: () => cartApi.removeCoupon({ as: credentialOf(requireOwner(owner)) }),
    onMutate: () => ({ owner: requireOwner(owner), previous: undefined }),
    ...lifecycle(qc),
  })
}
