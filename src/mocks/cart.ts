/** Server-side cart: guest (X-Guest-Id) and user carts, computed against the live catalog. */
import type { Cart, CartLine, CartLineStatus } from '@/api/contracts'
import { eq, mulQty, sum } from '@/lib/money'
import { findEdition, findNft } from './catalog'
import { db, nextId, nowIso, persist, type CartLineRec, type CartRec } from './db'

export function cartIdFor(ownerKey: string): string {
  return `cart_${ownerKey.replace(':', '_')}`
}

export function getCart(ownerKey: string): CartRec | undefined {
  return db().carts[ownerKey]
}

export function getOrCreateCart(ownerKey: string): CartRec {
  const existing = db().carts[ownerKey]
  if (existing) return existing
  const created: CartRec = { id: cartIdFor(ownerKey), ownerKey, lines: [], couponCode: null, version: 1, updatedAt: nowIso() }
  db().carts[ownerKey] = created
  persist()
  return created
}

export function touchCart(cart: CartRec): void {
  cart.version += 1
  cart.updatedAt = nowIso()
  persist()
}

/** Max units the stepper allows for a (nft, edition): min(available, maxPerOrder). */
export function maxQuantityFor(nftId: string, editionId: string): number {
  const ed = findNft(nftId) && findEdition(findNft(nftId)!, editionId)
  return ed ? Math.min(ed.available, ed.maxPerOrder) : 0
}

function lineView(l: CartLineRec): CartLine | null {
  const nft = findNft(l.nftId)
  const ed = nft && findEdition(nft, l.editionId)
  if (!nft || !ed) return null
  const status: CartLineStatus =
    ed.available === 0 ? 'sold_out' : ed.available < l.quantity ? 'insufficient' : eq(ed.price, l.addedUnitPrice) ? 'ok' : 'price_changed'
  return {
    id: l.id,
    nftId: nft.id,
    editionId: ed.id,
    quantity: l.quantity,
    name: nft.name,
    tokenId: nft.tokenId,
    editionLabel: ed.label,
    image: nft.image,
    unitPrice: ed.price,
    addedUnitPrice: l.addedUnitPrice,
    lineTotal: mulQty(ed.price, l.quantity),
    available: ed.available,
    maxQuantity: Math.min(ed.available, ed.maxPerOrder),
    status,
    nftVersion: nft.version,
  }
}

export function cartView(c: CartRec): Cart {
  const lines = c.lines.map(lineView).filter((l): l is CartLine => l !== null)
  const [kind, id] = [c.ownerKey.slice(0, 1), c.ownerKey.slice(2)]
  return {
    id: c.id,
    owner: kind === 'u' ? { kind: 'user', userId: id } : { kind: 'guest', guestId: id },
    lines,
    couponCode: c.couponCode,
    itemCount: lines.reduce((acc, l) => acc + l.quantity, 0),
    subtotal: sum(lines.map((l) => l.lineTotal)),
    version: c.version,
    updatedAt: c.updatedAt,
  }
}

export function newLine(nftId: string, editionId: string, quantity: number, unitPrice: string): CartLineRec {
  return { id: nextId('ln'), nftId, editionId, quantity, addedUnitPrice: unitPrice }
}
