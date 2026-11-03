import { add, percentOf } from '@/lib/money'
import { cartView, getCart, getOrCreateCart, newLine, touchCart } from '../cart'
import { findEdition, findNft, patchNft } from '../catalog'
import { db, nowIso, persist, type CartRec } from '../db'
import { fail, ownerKeyOf, route, type AuthCtx } from '../http'
import { fireOnce, isActive } from '../scenario-state'
import { later } from '../timers'
import { refreshQuote } from '../quote'

const mine = (auth: AuthCtx): CartRec => getOrCreateCart(ownerKeyOf(auth))

function lookup(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  const edition = nft && findEdition(nft, editionId)
  if (!nft || !edition) fail({ code: 'NOT_FOUND', message: 'NFT ou edição não encontrado.', resource: { kind: 'edition', id: editionId } })
  return { nft, edition }
}

function conflict(nftId: string, editionId: string, requested: number, available: number): never {
  return fail({
    code: 'CONFLICT_AVAILABILITY',
    message: available === 0 ? 'Edição indisponível.' : `Só há ${available} unidade(s) disponíveis para compra.`,
    items: [{ nftId, editionId, requested, available }],
  })
}

export const cartHandlers = [
  route('getCart', ({ auth }) => cartView(mine(auth))),

  route('addCartItem', ({ auth, body }) => {
    const cart = mine(auth)
    const { edition } = lookup(body.nftId, body.editionId)
    const existing = cart.lines.find((l) => l.nftId === body.nftId && l.editionId === body.editionId)
    const total = (existing?.quantity ?? 0) + body.quantity
    if (total > Math.min(edition.available, edition.maxPerOrder)) conflict(body.nftId, body.editionId, total, edition.available)
    if (existing) existing.quantity = total
    else cart.lines.push(newLine(body.nftId, body.editionId, body.quantity, edition.price))
    touchCart(cart)
    return cartView(cart)
  }),

  route('updateCartItem', ({ auth, params, body }) => {
    const cart = mine(auth)
    const line = cart.lines.find((l) => l.id === params.lineId)
    if (!line) fail({ code: 'NOT_FOUND', message: 'Item não encontrado no carrinho.', resource: { kind: 'cartLine', id: params.lineId! } })
    const { edition } = lookup(line.nftId, line.editionId)
    if (body.quantity > Math.min(edition.available, edition.maxPerOrder)) conflict(line.nftId, line.editionId, body.quantity, edition.available)
    line.quantity = body.quantity
    line.addedUnitPrice = edition.price // acknowledges a price change
    touchCart(cart)
    return cartView(cart)
  }),

  route('removeCartItem', ({ auth, params }) => {
    const cart = mine(auth)
    if (!cart.lines.some((l) => l.id === params.lineId)) fail({ code: 'NOT_FOUND', message: 'Item não encontrado no carrinho.', resource: { kind: 'cartLine', id: params.lineId! } })
    cart.lines = cart.lines.filter((l) => l.id !== params.lineId)
    if (cart.lines.length === 0) cart.couponCode = null
    touchCart(cart)
    return cartView(cart)
  }),

  route('mergeCart', ({ auth, body }) => {
    const target = getOrCreateCart(`u:${auth.user!.id}`)
    const guest = getCart(`g:${body.guestId}`)
    const adjusted: { lineId: string; requested: number; applied: number }[] = []
    if (guest) {
      for (const g of guest.lines) {
        const ed = findNft(g.nftId) && findEdition(findNft(g.nftId)!, g.editionId)
        if (!ed) continue
        const max = Math.min(ed.available, ed.maxPerOrder)
        const existing = target.lines.find((l) => l.nftId === g.nftId && l.editionId === g.editionId)
        const wanted = (existing?.quantity ?? 0) + g.quantity
        const applied = Math.min(wanted, max)
        if (existing) existing.quantity = applied
        else if (applied > 0) target.lines.push({ ...g, quantity: applied })
        if (applied < wanted) adjusted.push({ lineId: existing?.id ?? g.id, requested: wanted, applied })
        if (existing && applied === 0) target.lines = target.lines.filter((l) => l !== existing)
      }
      target.couponCode ??= guest.couponCode
      Reflect.deleteProperty(db().carts, guest.ownerKey)
      Reflect.deleteProperty(db().quotes, guest.id)
      touchCart(target)
    }
    return { cart: cartView(target), adjusted }
  }),

  route('applyCoupon', ({ auth, body }) => {
    const cart = mine(auth)
    if (isActive('coupon.invalid')) fail({ code: 'COUPON_INVALID', message: 'Cupom inválido.', couponCode: body.code })
    if (isActive('coupon.expired')) fail({ code: 'COUPON_EXPIRED', message: 'Este cupom expirou.', couponCode: body.code, expiredAt: nowIso() })
    const coupon = db().coupons.find((c) => c.code === body.code)
    if (!coupon) fail({ code: 'COUPON_INVALID', message: 'Cupom inválido.', couponCode: body.code })
    if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= Date.now()) {
      fail({ code: 'COUPON_EXPIRED', message: 'Este cupom expirou.', couponCode: coupon.code, expiredAt: coupon.expiresAt })
    }
    cart.couponCode = coupon.code
    touchCart(cart)
    return cartView(cart)
  }),

  route('removeCoupon', ({ auth }) => {
    const cart = mine(auth)
    cart.couponCode = null
    touchCart(cart)
    return cartView(cart)
  }),

  route('createQuote', ({ auth, body }) => {
    const cart = mine(auth)
    const quote = refreshQuote(cart, body.network)
    // Checkout scenarios: the catalog changes right AFTER the client received this quote.
    const first = cart.lines[0]
    if (first && !quote.issues.length) {
      if (fireOnce('checkout.price-changed')) schedulePriceBump(first.nftId, first.editionId)
      else if (fireOnce('checkout.sold-out')) scheduleSoldOut(first.nftId, first.editionId)
    }
    persist()
    return quote
  }),
]

function schedulePriceBump(nftId: string, editionId: string) {
  later(() => {
    const nft = findNft(nftId)
    const ed = nft && findEdition(nft, editionId)
    if (ed) patchNft(nftId, { editions: [{ id: editionId, price: add(ed.price, percentOf(ed.price, '10')) }] })
  }, 400)
}

function scheduleSoldOut(nftId: string, editionId: string) {
  later(() => patchNft(nftId, { editions: [{ id: editionId, available: 0 }] }), 400)
}
