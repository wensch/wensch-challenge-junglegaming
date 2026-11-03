/** Quote engine: server-computed totals with a version that bumps whenever anything monetary/availability changes. */
import type { Network, Quote, QuoteChange, QuoteIssue } from '@/api/contracts'
import { add, lt, mulQty, percentOf, subClamped, sum } from '@/lib/money'
import { findEdition, findNft } from './catalog'
import { db, nowIso, persist, type CartRec, type QuoteRec } from './db'
import { isActive } from './scenario-state'
import { NETWORK_FEES } from './seed'

const QUOTE_TTL_MS = 15 * 60_000

export function quoteIdFor(cart: CartRec): string {
  return `q_${cart.id}`
}

type Draft = Omit<Quote, 'id' | 'version' | 'issuedAt' | 'expiresAt'>

function draftQuote(cart: CartRec, network: Network): Draft {
  const issues: QuoteIssue[] = []
  const lines = cart.lines.flatMap((l) => {
    const nft = findNft(l.nftId)
    const ed = nft && findEdition(nft, l.editionId)
    if (!nft || !ed) return []
    if (ed.available === 0) issues.push({ kind: 'sold_out', lineId: l.id })
    else if (ed.available < l.quantity) issues.push({ kind: 'insufficient', lineId: l.id, requested: l.quantity, available: ed.available })
    return [
      {
        lineId: l.id,
        nftId: nft.id,
        editionId: ed.id,
        name: nft.name,
        tokenId: nft.tokenId,
        editionLabel: ed.label,
        quantity: l.quantity,
        available: ed.available,
        unitPrice: ed.price,
        lineTotal: mulQty(ed.price, l.quantity),
      },
    ]
  })
  if (lines.length === 0) issues.push({ kind: 'empty_cart' })

  const subtotal = sum(lines.map((l) => l.lineTotal))
  let coupon: Quote['coupon'] = null
  let discount = '0'
  if (cart.couponCode) {
    const found = db().coupons.find((c) => c.code === cart.couponCode)
    const expired = isActive('coupon.expired') || (found?.expiresAt != null && Date.parse(found.expiresAt) <= Date.now())
    if (!found) issues.push({ kind: 'coupon_invalid', code: cart.couponCode })
    else if (expired) issues.push({ kind: 'coupon_expired', code: found.code })
    else {
      coupon = found
      const raw = found.kind === 'percent' ? percentOf(subtotal, found.value) : found.value
      discount = lt(subtotal, raw) ? subtotal : raw
    }
  }
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  return {
    cartVersion: cart.version,
    network,
    currency: 'ETH',
    lines,
    subtotal,
    coupon,
    discount,
    networkFee,
    networkFeeEstimated: true,
    total: add(subClamped(subtotal, discount), networkFee),
    issues,
    orderable: issues.length === 0,
  }
}

const fingerprintOf = (d: Draft) =>
  JSON.stringify({
    n: d.network,
    l: d.lines.map((l) => [l.lineId, l.editionId, l.quantity, l.unitPrice, l.available]),
    c: d.coupon && [d.coupon.code, d.coupon.kind, d.coupon.value],
    d: d.discount,
    f: d.networkFee,
    i: d.issues,
  })

/** Recomputes the quote for the cart; same id, version bumps only when the fingerprint changed. */
export function refreshQuote(cart: CartRec, network: Network): Quote {
  const draft = draftQuote(cart, network)
  const fp = fingerprintOf(draft)
  const store = db().quotes
  const prev: QuoteRec | undefined = store[cart.id]
  const now = Date.now()
  const timing = { issuedAt: nowIso(), expiresAt: new Date(now + QUOTE_TTL_MS).toISOString() }
  if (prev && prev.fingerprint === fp) {
    prev.current = { ...prev.current, cartVersion: cart.version, ...timing }
    persist()
    return prev.current
  }
  const version = prev ? prev.current.version + 1 : 1
  const quote: Quote = { ...draft, id: quoteIdFor(cart), version, ...timing }
  store[cart.id] = { id: quote.id, cartId: cart.id, fingerprint: fp, current: quote, history: { ...(prev?.history ?? {}), [version]: quote } }
  persist()
  return quote
}

export function quoteSnapshot(cartId: string, version: number): Quote | undefined {
  return db().quotes[cartId]?.history[version]
}

/** What changed between the quote the client saw and the fresh one. */
export function diffQuotes(from: Quote | undefined, to: Quote): QuoteChange[] {
  const changes: QuoteChange[] = []
  if (!from) return [{ kind: 'total', from: to.total, to: to.total }]
  for (const line of to.lines) {
    const old = from.lines.find((l) => l.lineId === line.lineId)
    if (!old) continue
    if (old.unitPrice !== line.unitPrice) changes.push({ kind: 'price', lineId: line.lineId, from: old.unitPrice, to: line.unitPrice })
    if (old.available !== line.available) changes.push({ kind: 'availability', lineId: line.lineId, from: old.available, to: line.available })
  }
  const couponIssue = to.issues.find((i) => i.kind === 'coupon_expired' || i.kind === 'coupon_invalid')
  if (couponIssue && 'code' in couponIssue) {
    changes.push({ kind: 'coupon', code: couponIssue.code, reason: couponIssue.kind === 'coupon_expired' ? 'expired' : 'invalid' })
  } else if (from.coupon?.code !== to.coupon?.code || from.discount !== to.discount) {
    changes.push({ kind: 'coupon', code: to.coupon?.code ?? from.coupon?.code ?? '', reason: 'changed' })
  }
  if (from.networkFee !== to.networkFee) changes.push({ kind: 'fee', from: from.networkFee, to: to.networkFee })
  if (from.total !== to.total) changes.push({ kind: 'total', from: from.total, to: to.total })
  return changes
}
