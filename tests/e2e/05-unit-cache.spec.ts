/**
 * Node-level checks of pure modules (no browser): REST x event races in the reconciler, the
 * monotonic `keepNewest` guard, and the open-redirect / URL schemas of the contracts.
 * Runs once (desktop project); the browser suites cover the same rules end to end.
 */
import { QueryClient } from '@tanstack/react-query'
import { test, expect } from '@playwright/test'
import { avatarUrlSchema, httpsUrlSchema, safeRedirectSchema, transactionSchema } from '../../src/api/contracts'
import { queryKeys } from '../../src/queries/keys'
import { keepNewest } from '../../src/queries/versioned'
import { createReconciler } from '../../src/realtime/reconcile'

// Pure Node checks: run once (the mobile project would only repeat them).
test.skip(({ isMobile }) => isMobile, 'pure Node checks run on the desktop project only')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const iso = () => new Date().toISOString()
const HASH = `0x${'a'.repeat(64)}`

function orderEvent(id: string, version: number, status: 'confirmed' | 'declined' | 'pending') {
  return {
    id,
    type: 'order.updated',
    resource: { kind: 'order', id: 'ord_0001' },
    version,
    userId: 'usr_001',
    occurredAt: iso(),
    data: {
      orderId: 'ord_0001',
      status,
      transaction: status === 'confirmed' ? { hash: HASH, explorerUrl: `https://etherscan.io/tx/${HASH}`, confirmedAt: iso() } : null,
      declineReason: null,
      updatedAt: iso(),
    },
  }
}

function nftEvent(id: string, version: number, price: string) {
  return {
    id,
    type: 'nft.updated',
    resource: { kind: 'nft', id: 'nft_001' },
    version,
    occurredAt: iso(),
    data: { nftId: 'nft_001', price, compareAtPrice: null, available: 3, soldOut: false, editions: [] },
  }
}

test.describe('reconciler: REST em voo x evento', () => {
  test('refetch antigo não regride pedido confirmado por evento', async () => {
    const qc = new QueryClient()
    const rec = createReconciler({ queryClient: qc, getUserId: () => 'usr_001' })
    const key = queryKeys.user('usr_001').order('ord_0001')
    const pendingV1 = { id: 'ord_0001', userId: 'usr_001', status: 'pending', version: 1, transaction: null, declineReason: null, updatedAt: iso() }
    qc.setQueryData(key, pendingV1 as never)
    const inflight = qc.fetchQuery({ queryKey: key, staleTime: 0, queryFn: async () => (await sleep(50), { ...pendingV1 }) as never })
    expect(rec.handle(orderEvent('evt_1', 2, 'confirmed')).outcome).toBe('applied')
    expect(qc.getQueryData(key)?.status).toBe('confirmed')
    await inflight
    expect(qc.getQueryData(key)).toMatchObject({ status: 'confirmed', version: 2 })
    // A second stale refetch is also corrected; replays are no-ops.
    await qc.fetchQuery({ queryKey: key, staleTime: 0, queryFn: async () => ({ ...pendingV1 }) as never })
    expect(qc.getQueryData(key)?.status).toBe('confirmed')
    expect(rec.handle(orderEvent('evt_1', 2, 'confirmed')).outcome).toBe('duplicate')
    expect(rec.handle(orderEvent('evt_2', 2, 'confirmed')).outcome).toBe('stale')
    rec.dispose()
  })

  test('evento durante o primeiro GET do NFT sobrevive à resposta', async () => {
    const qc = new QueryClient()
    const rec = createReconciler({ queryClient: qc, getUserId: () => null })
    const key = queryKeys.nfts.detail('nft_001')
    const inflight = qc.fetchQuery({ queryKey: key, queryFn: async () => (await sleep(50), { id: 'nft_001', price: '1.0', version: 1, editions: [] }) as never })
    expect(rec.handle(nftEvent('evt_n1', 2, '2.0')).outcome).toBe('applied')
    await inflight
    expect(qc.getQueryData(key)).toMatchObject({ price: '2.0', version: 2 })
    expect(rec.knownVersion('nft:nft_001')).toBe(2)
    expect(rec.handle(nftEvent('evt_n2', 2, '9.0')).outcome).toBe('stale')
    rec.dispose()
  })

  test('cards de lista em voo também recebem o evento', async () => {
    const qc = new QueryClient()
    const rec = createReconciler({ queryClient: qc, getUserId: () => null })
    const key = queryKeys.nfts.list({ page: 1 })
    const card = { id: 'nft_001', price: '1.0', compareAtPrice: null, available: 5, soldOut: false, version: 1 }
    const inflight = qc.fetchQuery({ queryKey: key, queryFn: async () => (await sleep(30), { items: [card], meta: {}, facets: {} }) as never })
    rec.handle(nftEvent('evt_l1', 3, '3.5'))
    await inflight
    expect((qc.getQueryData(key) as { items: { price: string; version: number }[] }).items[0]).toMatchObject({ price: '3.5', version: 3 })
    rec.dispose()
  })
})

test.describe('keepNewest (structuralSharing)', () => {
  test('não regride versão nem pedido terminal; listas por item', () => {
    expect(keepNewest({ id: 'a', version: 3, price: '2' }, { id: 'a', version: 2, price: '1' })).toMatchObject({ version: 3, price: '2' })
    expect(keepNewest({ id: 'a', version: 2 }, { id: 'a', version: 3 })).toMatchObject({ version: 3 })
    expect(keepNewest({ id: 'o', version: 2, status: 'confirmed' }, { id: 'o', version: 9, status: 'pending' })).toMatchObject({ status: 'confirmed' })
    const merged = keepNewest(
      { items: [{ id: 'a', version: 5, price: '5' }, { id: 'b', version: 1, price: '1' }] },
      { items: [{ id: 'a', version: 4, price: '4' }, { id: 'b', version: 2, price: '2' }, { id: 'c', version: 1, price: '9' }] },
    ) as { items: { id: string; price: string }[] }
    expect(merged.items.map((i) => i.price)).toEqual(['5', '2', '9'])
    // Different resource under the same key: the new one wins.
    expect(keepNewest({ id: 'a', version: 9 }, { id: 'b', version: 1 })).toMatchObject({ id: 'b' })
  })
})

test.describe('contratos v1.2.0: redirect e URLs', () => {
  const BS = String.fromCharCode(92)
  test('safeRedirectSchema rejeita tudo que muda de origem e normaliza o aceito', () => {
    const bad = ['//evil.com', 'https://evil.com', `/${BS}evil.com`, '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', `/\t${BS}evil.com`, '///evil.com', 'javascript:alert(1)', 'evil.com', `${BS}/evil.com`, '/\u0000/x', '/\u007f/x']
    for (const v of bad) expect(safeRedirectSchema.safeParse(v).success, JSON.stringify(v)).toBe(false)
    expect(safeRedirectSchema.parse('/wallets?x=1#a')).toBe('/wallets?x=1#a')
    expect(safeRedirectSchema.parse('/a/../checkout')).toBe('/checkout')
    for (const v of ['/%2F%2Fevil.com', '/%5Cevil.com', '/ /evil.com', '/.//evil.com']) {
      const out = safeRedirectSchema.safeParse(v)
      if (out.success) expect(new URL(out.data, 'https://app.example').origin, v).toBe('https://app.example')
    }
  })

  test('explorerUrl só https; avatar só https, caminho local ou data:image raster', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://etherscan.io/tx/1', 'vbscript:x']) {
      expect(httpsUrlSchema.safeParse(v).success, v).toBe(false)
    }
    expect(transactionSchema.safeParse({ hash: HASH, explorerUrl: `https://etherscan.io/tx/${HASH}`, confirmedAt: iso() }).success).toBe(true)
    for (const v of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', '//evil.com/a.png', 'blob:https://x/1']) {
      expect(avatarUrlSchema.safeParse(v).success, v).toBe(false)
    }
    for (const v of ['https://cdn.example.com/a.webp', '/avatars/a.webp', 'data:image/png;base64,iVBORw0KGgo=']) {
      expect(avatarUrlSchema.safeParse(v).success, v).toBe(true)
    }
  })
})
