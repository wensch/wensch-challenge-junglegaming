/**
 * Local diff between the quote the user accepted and the current one. The API sends its own `changes[]`
 * with `409 QUOTE_STALE`; this covers the case where the quote moved WITHOUT a rejected submit (an
 * `nft.updated` event while the checkout is open): the same list is shown and the same explicit
 * confirmation is required (challenge §7 scenario, step 4).
 */
import type { Quote, QuoteChange } from '@/api/contracts'
import { eq } from '@/lib/money'

export function diffQuotes(from: Quote, to: Quote): QuoteChange[] {
  const changes: QuoteChange[] = []
  for (const line of to.lines) {
    const before = from.lines.find((l) => l.lineId === line.lineId)
    if (!before) continue
    if (!eq(before.unitPrice, line.unitPrice)) changes.push({ kind: 'price', lineId: line.lineId, from: before.unitPrice, to: line.unitPrice })
    if (before.available !== line.available) changes.push({ kind: 'availability', lineId: line.lineId, from: before.available, to: line.available })
  }
  const couponIssue = to.issues.find((i) => i.kind === 'coupon_expired' || i.kind === 'coupon_invalid')
  if (couponIssue && 'code' in couponIssue) {
    changes.push({ kind: 'coupon', code: couponIssue.code, reason: couponIssue.kind === 'coupon_expired' ? 'expired' : 'invalid' })
  } else if (from.coupon?.code !== to.coupon?.code || !eq(from.discount, to.discount)) {
    changes.push({ kind: 'coupon', code: to.coupon?.code ?? from.coupon?.code ?? '', reason: 'changed' })
  }
  if (!eq(from.networkFee, to.networkFee)) changes.push({ kind: 'fee', from: from.networkFee, to: to.networkFee })
  if (!eq(from.total, to.total)) changes.push({ kind: 'total', from: from.total, to: to.total })
  return changes
}
