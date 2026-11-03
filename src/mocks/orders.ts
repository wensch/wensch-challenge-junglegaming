/** Order domain: creation (stock reservation), settlement simulation and the order.updated stream. */
import type { CreateOrderRequest, Order, OrderUpdatedEvent, Quote, WalletType } from '@/api/contracts'
import { findNft, mutateNft } from './catalog'
import { getCart, touchCart } from './cart'
import { db, nextId, nowIso, persist, type OrderMeta, type UserRec } from './db'
import { broadcast } from './realtime'
import { createRng, hashString } from './rng'

export const SETTLE_DELAY_MS = 1500
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const findOrder = (id: string): Order | undefined => db().orders.find((o) => o.id === id)

export function orderEvent(o: Order): OrderUpdatedEvent {
  return {
    id: nextId('evt', 6),
    type: 'order.updated',
    version: o.version,
    occurredAt: nowIso(),
    resource: { kind: 'order', id: o.id },
    userId: o.userId,
    data: { orderId: o.id, status: o.status, transaction: o.transaction, declineReason: o.declineReason, updatedAt: o.updatedAt },
  }
}

function mutateOrder(o: Order, change: (o: Order) => void): void {
  change(o)
  o.version += 1
  o.updatedAt = nowIso()
  persist()
  broadcast(orderEvent(o))
}

function adjustStock(items: OrderMeta['reserved'], sign: 1 | -1): void {
  const byNft = new Map<string, OrderMeta['reserved']>()
  for (const it of items) byNft.set(it.nftId, [...(byNft.get(it.nftId) ?? []), it])
  for (const [nftId, group] of byNft) {
    mutateNft(nftId, (n) => {
      for (const it of group) {
        const ed = n.editions.find((e) => e.id === it.editionId)
        if (ed) ed.available = Math.max(0, ed.available + sign * it.quantity)
      }
    })
  }
}

export interface PlaceOrderInput {
  user: UserRec
  body: CreateOrderRequest
  quote: Quote
  ownerKey: string
  wallet: { id: string; label: string; address: string; type: WalletType }
  mode: OrderMeta['mode']
}

export function placeOrder({ user, body, quote, ownerKey, wallet, mode }: PlaceOrderInput): Order {
  const now = nowIso()
  const lines = quote.lines.map((l) => {
    const nft = findNft(l.nftId)!
    return {
      cartLineId: l.lineId,
      nftId: l.nftId,
      editionId: l.editionId,
      name: l.name,
      tokenId: l.tokenId,
      editionLabel: l.editionLabel,
      image: nft.image,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    }
  })
  const order: Order = {
    id: nextId('ord'),
    userId: user.id,
    status: 'pending',
    version: 1,
    quoteId: quote.id,
    quoteVersion: quote.version,
    receipt: {
      lines,
      subtotal: quote.subtotal,
      couponCode: quote.coupon?.code ?? null,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      network: body.network,
      wallet,
      collector: body.collector,
    },
    transaction: null,
    declineReason: null,
    createdAt: now,
    updatedAt: now,
  }
  const reserved = quote.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity }))
  db().orders.push(order)
  db().orderMeta[order.id] = { mode, ownerKey, reserved }
  persist()
  adjustStock(reserved, -1)
  broadcast(orderEvent(order))
  if (mode !== 'hold') scheduleSettle(order.id, SETTLE_DELAY_MS)
  return order
}

function scheduleSettle(orderId: string, ms: number): void {
  clearTimeout(timers.get(orderId))
  timers.set(
    orderId,
    setTimeout(() => {
      timers.delete(orderId)
      const mode = db().orderMeta[orderId]?.mode
      if (mode === 'confirmed' || mode === 'declined') settleOrder(orderId, mode)
    }, ms),
  )
}

/** pending -> confirmed | declined (terminal states are never overwritten). Emits order.updated. */
export function settleOrder(orderId: string, status: 'confirmed' | 'declined'): boolean {
  const order = findOrder(orderId)
  const meta = db().orderMeta[orderId]
  if (!order || order.status !== 'pending') return false
  clearTimeout(timers.get(orderId))
  timers.delete(orderId)

  if (status === 'confirmed') {
    mutateOrder(order, (o) => {
      const hash = `0x${createRng(hashString(o.id)).hex(64)}`
      o.status = 'confirmed'
      o.transaction = { hash, explorerUrl: `https://etherscan.io/tx/${hash}`, confirmedAt: nowIso() }
    })
    const cart = meta && getCart(meta.ownerKey)
    if (cart) {
      // Subtract what was bought: units added to the cart after checkout stay in it.
      const bought = new Map<string, number>()
      for (const l of order.receipt.lines) bought.set(l.cartLineId, (bought.get(l.cartLineId) ?? 0) + l.quantity)
      cart.lines = cart.lines.flatMap((l) => {
        const qty = l.quantity - (bought.get(l.id) ?? 0)
        return qty > 0 ? [{ ...l, quantity: qty }] : []
      })
      if (cart.lines.length === 0) cart.couponCode = null
      touchCart(cart)
    }
  } else {
    mutateOrder(order, (o) => {
      o.status = 'declined'
      o.declineReason = 'Pagamento recusado pela carteira (saldo insuficiente na simulação).'
    })
    if (meta) adjustStock(meta.reserved, 1)
  }
  return true
}

/** After a reload, pending orders keep progressing (unless held by `payment.hold`). */
export function resumePendingOrders(): void {
  for (const o of db().orders) {
    if (o.status !== 'pending') continue
    const mode = db().orderMeta[o.id]?.mode
    if (mode === 'hold' || !mode) continue
    scheduleSettle(o.id, Math.max(0, SETTLE_DELAY_MS - (Date.now() - Date.parse(o.createdAt))))
  }
}

export function clearOrderTimers(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}
