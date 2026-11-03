// Reproduces REST-vs-event races in src/realtime/reconcile.ts (no build, no browser).
// Loads the real modules through Vite's SSR loader (alias @/ resolved by vite.config.ts).
// Usage (repo root): node reports/fundacao/revisor-evidence/reconcile-race.mjs
import { createServer } from 'vite'

const root = process.cwd()
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { createReconciler } = await server.ssrLoadModule('/src/realtime/reconcile.ts')
  const { queryKeys } = await server.ssrLoadModule('/src/queries/keys.ts')
  const { QueryClient } = await server.ssrLoadModule('@tanstack/react-query')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const iso = () => new Date().toISOString()

  // ---- Case 1: order confirmed by event while a REST refetch (snapshot taken before) is in flight ----
  {
    const qc = new QueryClient()
    const rec = createReconciler({ queryClient: qc, getUserId: () => 'usr_001' })
    const key = queryKeys.user('usr_001').order('ord_0001')
    const pendingV1 = { id: 'ord_0001', userId: 'usr_001', status: 'pending', version: 1, transaction: null, declineReason: null, updatedAt: iso() }
    qc.setQueryData(key, pendingV1)
    const inflight = qc.fetchQuery({ queryKey: key, staleTime: 0, queryFn: async () => { await sleep(50); return { ...pendingV1 } } })
    const ev = { id: 'evt_000001', type: 'order.updated', resource: { kind: 'order', id: 'ord_0001' }, version: 2, userId: 'usr_001', occurredAt: iso(),
      data: { orderId: 'ord_0001', status: 'confirmed', transaction: { hash: '0x' + 'a'.repeat(64), explorerUrl: 'https://etherscan.io/tx/0x', confirmedAt: iso() }, declineReason: null, updatedAt: iso() } }
    const r1 = rec.handle(ev)
    const afterEvent = qc.getQueryData(key).status
    await inflight
    const afterFetch = qc.getQueryData(key)
    console.log(JSON.stringify({ case: 'order-regression', eventOutcome: r1.outcome, afterEvent, afterInflightFetch: { status: afterFetch.status, version: afterFetch.version }, replaySameEvent: rec.handle(ev).outcome, sameVersionNewId: rec.handle({ ...ev, id: 'evt_000002' }).outcome }))
  }

  // ---- Case 2: nft.updated arrives while the first GET /nfts/:id is in flight (nothing cached yet) ----
  {
    const qc = new QueryClient()
    const rec = createReconciler({ queryClient: qc, getUserId: () => null })
    const key = queryKeys.nfts.detail('nft_001')
    const inflight = qc.fetchQuery({ queryKey: key, queryFn: async () => { await sleep(50); return { id: 'nft_001', price: '1.0', version: 1, editions: [] } } })
    const ev = { id: 'evt_100001', type: 'nft.updated', resource: { kind: 'nft', id: 'nft_001' }, version: 2, occurredAt: iso(),
      data: { nftId: 'nft_001', price: '2.0', compareAtPrice: null, available: 3, soldOut: false, editions: [] } }
    const r = rec.handle(ev)
    await inflight
    const d = qc.getQueryData(key)
    console.log(JSON.stringify({ case: 'nft-inflight', eventOutcome: r.outcome, cachedAfterFetch: { price: d.price, version: d.version }, knownVersion: rec.knownVersion('nft:nft_001'), sameVersionNewId: rec.handle({ ...ev, id: 'evt_100002' }).outcome }))
  }
} finally {
  await server.close()
}
