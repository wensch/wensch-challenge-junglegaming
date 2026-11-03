/**
 * Smoke tests of the simulated backend (src/mocks), independent of any screen.
 * Everything runs inside the page: fetch goes through the MSW service worker and the Socket.IO client
 * is the real socket.io-client (UMD build) talking to the MSW WebSocket binding.
 * Covers: all 24 scenarios, reset, persistence after reload, idempotency, per-user event isolation.
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import type { ApiErrorCode, QuoteChange } from '../../src/api/contracts'
import { SCENARIO_NAMES, type ScenarioName } from '../../src/api/contracts/scenarios'

const SOCKET_CLIENT_BUNDLE = join(dirname(createRequire(import.meta.url).resolve('socket.io-client')), '..', '..', 'dist', 'socket.io.min.js')
const SOCKET_URL = 'wss://realtime.nft-mock.local' // VITE_SOCKET_URL (.env)
const ALICE = { email: 'alice@example.test', password: 'Senha@123' }
const BOB = { email: 'bob@example.test', password: 'Senha@456' }
const NFT = { id: 'nft_004', edition: 'ed_004_1' } // open edition: plenty of stock, maxPerOrder 10
const COLLECTOR = { displayName: 'Alice Colecionadora', username: 'alice', profileName: 'alice', email: 'alice@example.test', ensName: 'alice.eth', referralCode: 'ALICE-2026' }

/**
 * Response body as seen by these smoke tests: the union of the fields they read, typed with the contracts
 * (declared as present for brevity: which ones exist depends on the endpoint, and each test asserts what it reads).
 */
interface Json {
  id: string
  type: string
  status: string
  version: number
  token: string
  price: string
  discount: string
  couponCode: string | null
  avatarUrl: string | null
  connectionId: string
  itemCount: number
  orderable: boolean
  displayName: string
  username: string
  email: string
  ensName: string
  walletAlias: string
  profileName: string
  referralCode: string
  label: string
  network: string
  address: string
  nftIds: string[]
  user: Json
  meta: Json
  total: number
  facets: Json
  categories: unknown[]
  data: Json
  resource: Json
  kind: string
  items: Json[]
  editions: Json[]
  lines: Json[]
  adjusted: unknown[]
  issues: unknown[]
  cart: Json
  owner: Json
  primary: Json
  receipt: Json
  unitPrice: string
  available: number
  currentVersion: number
  error: Json
  code: ApiErrorCode
  message: string
  fieldErrors: Record<string, string[]>
  quote: Json
  changes: QuoteChange[]
  transaction: Json | null
  declineReason: string | null
  soldOut: boolean
  name: string
  category: string
  isNew: boolean
  slot: string
  secondary: Json | null
  userId: string
  hash: string
}
interface Res<T = Json> {
  status: number
  body: T
  ms: number
  aborted: boolean
  failed: boolean
}
interface ReqOpts {
  token?: string
  guest?: string
  body?: unknown
  headers?: Record<string, string>
  abortMs?: number
}

async function boot(page: Page, url = '/') {
  await page.goto(url)
  await page.waitForFunction(() => !!window.__mock)
  await page.evaluate(() => window.__mock!.reset())
}

async function api<T = Json>(page: Page, method: string, path: string, opts: ReqOpts = {}): Promise<Res<T>> {
  return page.evaluate(
    async ({ method, path, opts }) => {
      const headers: Record<string, string> = { ...(opts.headers ?? {}) }
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`
      if (opts.guest) headers['X-Guest-Id'] = opts.guest
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
      const ac = new AbortController()
      const timer = opts.abortMs ? setTimeout(() => ac.abort(), opts.abortMs) : undefined
      const t0 = performance.now()
      try {
        const r = await fetch(`/api${path}`, { method, headers, body: opts.body === undefined ? null : JSON.stringify(opts.body), signal: ac.signal })
        const text = await r.text()
        return { status: r.status, body: text ? JSON.parse(text) : null, ms: performance.now() - t0, aborted: false, failed: false }
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        return { status: 0, body: null, ms: performance.now() - t0, aborted, failed: !aborted }
      } finally {
        clearTimeout(timer)
      }
    },
    { method, path, opts },
  ) as Promise<Res<T>>
}

const setScenarios = (page: Page, names: ScenarioName[]) => page.evaluate((n) => window.__mock!.setScenarios(n), names)

async function login(page: Page, who: { email: string; password: string }) {
  const r = await api(page, 'POST', '/auth/login', { body: who })
  expect(r.status, JSON.stringify(r.body)).toBe(200)
  return { token: r.body.token as string, userId: r.body.user.id as string }
}

async function openSocket(page: Page, name: string, token: string | null) {
  if (!(await page.evaluate(() => 'io' in window))) await page.addScriptTag({ path: SOCKET_CLIENT_BUNDLE })
  await page.evaluate(
    ({ name, token, url }) => {
      const w = window as unknown as { io: (u: string, o: unknown) => { on: (e: string, f: (p: unknown) => void) => void }; __probes?: Record<string, { status: string; events: Json[] }> }
      w.__probes ??= {}
      const probe: { status: string; events: Json[] } = { status: 'connecting', events: [] }
      w.__probes[name] = probe
      const s = w.io(url, { transports: ['websocket'], auth: { token }, reconnection: false })
      s.on('connect', () => (probe.status = 'connected'))
      s.on('disconnect', () => (probe.status = 'disconnected'))
      s.on('connect_error', () => (probe.status = 'error'))
      s.on('nft.updated', (p) => probe.events.push(p as Json))
      s.on('order.updated', (p) => probe.events.push(p as Json))
    },
    { name, token, url: SOCKET_URL },
  )
  await page.waitForFunction((n) => (window as unknown as { __probes: Record<string, { status: string }> }).__probes[n]?.status !== 'connecting', name, { timeout: 5000 }).catch(() => undefined)
}

const probeEvents = (page: Page, name: string) =>
  page.evaluate((n) => (window as unknown as { __probes: Record<string, { events: Json[] }> }).__probes[n]?.events ?? [], name)
const probeStatus = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __probes: Record<string, { status: string }> }).__probes[n]?.status, name)

async function waitEvent(page: Page, name: string, pred: (e: Json) => boolean, timeout = 6000) {
  await expect.poll(async () => (await probeEvents(page, name)).some(pred), { timeout }).toBe(true)
  return (await probeEvents(page, name)).filter(pred)
}

/** Alice with 2 x NFT in cart, a connected primary wallet and a quote (taken AFTER `scenarios` are set). */
async function checkout(page: Page, scenarios: ScenarioName[] = []) {
  const { token, userId } = await login(page, ALICE)
  await api(page, 'POST', '/cart/items', { token, body: { nftId: NFT.id, editionId: NFT.edition, quantity: 2 } })
  const wallets = await api(page, 'GET', '/wallets', { token })
  const walletId = wallets.body.primary.id as string
  const conn = await api(page, 'POST', `/wallets/${walletId}/connect`, { token, body: { network: 'ethereum' } })
  expect(conn.body.status).toBe('connected')
  if (scenarios.length) await setScenarios(page, scenarios)
  const quote = await api(page, 'POST', '/quotes', { token, body: { network: 'ethereum' } })
  expect(quote.status, JSON.stringify(quote.body)).toBe(200)
  const body = { quoteId: quote.body.id, quoteVersion: quote.body.version, walletId, connectionId: conn.body.connectionId, network: 'ethereum', collector: COLLECTOR }
  return { token, userId, walletId, quote: quote.body, body, key: randomUUID() }
}

const postOrder = (page: Page, c: { token: string; body: unknown; key: string }, abortMs?: number) =>
  api(page, 'POST', '/orders', { token: c.token, body: c.body, headers: { 'Idempotency-Key': c.key }, ...(abortMs ? { abortMs } : {}) })

// ---------------------------------------------------------------------------------------------------
// One smoke per scenario. Typed as a full record: adding a scenario to the contract breaks the build here.
// ---------------------------------------------------------------------------------------------------
const checks: Record<ScenarioName, (page: Page) => Promise<void>> = {
  default: async (page) => {
    const r = await api(page, 'GET', '/nfts')
    expect(r.status).toBe(200)
    expect(r.body.meta.total).toBe(60)
    expect(r.body.items).toHaveLength(9)
    expect(r.ms).toBeGreaterThan(130)
    expect(r.ms).toBeLessThan(1200)
    await login(page, ALICE)
  },
  'catalog.empty': async (page) => {
    await setScenarios(page, ['catalog.empty'])
    const r = await api(page, 'GET', '/nfts')
    expect(r.status).toBe(200)
    expect(r.body.items).toEqual([])
    expect(r.body.meta).toMatchObject({ total: 0, totalPages: 0 })
  },
  'latency.slow': async (page) => {
    await setScenarios(page, ['latency.slow'])
    const r = await api(page, 'GET', '/nfts/featured')
    expect(r.status).toBe(200)
    expect(r.ms).toBeGreaterThan(2400)
  },
  'latency.variable': async (page) => {
    const run = async () => {
      await setScenarios(page, ['latency.variable'])
      const out: number[] = []
      for (let i = 0; i < 4; i++) out.push((await api(page, 'GET', '/nfts/featured')).ms)
      return out
    }
    const a = await run()
    for (const ms of a) {
      expect(ms).toBeGreaterThan(90)
      expect(ms).toBeLessThan(2100)
    }
    expect(new Set(a.map((x) => Math.round(x / 50))).size).toBeGreaterThan(1)
    const b = await run() // fixed seed: same sequence after re-selecting the scenario
    a.forEach((ms, i) => expect(Math.abs(ms - b[i]!)).toBeLessThan(150))
  },
  'catalog.out-of-order': async (page) => {
    await setScenarios(page, ['catalog.out-of-order'])
    const order = await page.evaluate(async () => {
      const done: string[] = []
      const a = fetch('/api/nfts?page=1').then(() => done.push('first'))
      await new Promise((r) => setTimeout(r, 120))
      const b = fetch('/api/nfts?page=2').then(() => done.push('second'))
      await Promise.all([a, b])
      return done
    })
    expect(order).toEqual(['second', 'first'])
  },
  'network.offline': async (page) => {
    await setScenarios(page, ['network.offline'])
    const r = await api(page, 'GET', '/nfts')
    expect(r.failed).toBe(true)
    await openSocket(page, 'off', null)
    expect(await probeStatus(page, 'off')).not.toBe('connected')
    await setScenarios(page, ['default'])
    expect((await api(page, 'GET', '/nfts')).status).toBe(200)
  },
  'network.timeout': async (page) => {
    await setScenarios(page, ['network.timeout'])
    const r = await api(page, 'GET', '/nfts', { abortMs: 1500 })
    expect(r.aborted).toBe(true)
  },
  'http.500.once': async (page) => {
    await setScenarios(page, ['http.500.once'])
    const first = await api(page, 'GET', '/nfts')
    expect(first.status).toBe(500)
    expect(first.body.error).toMatchObject({ code: 'TRANSIENT', reason: 'server' })
    expect((await api(page, 'GET', '/nfts')).status).toBe(200)
  },
  'http.503': async (page) => {
    await setScenarios(page, ['http.503'])
    const list = await api(page, 'GET', '/nfts')
    expect(list.status).toBe(503)
    expect(list.body.error).toMatchObject({ code: 'TRANSIENT', retryAfterMs: 1000 })
    expect((await api(page, 'GET', '/nfts/nft_001')).status).toBe(503)
    expect((await api(page, 'GET', '/nfts/featured')).status).toBe(200)
  },
  'favorites.fail': async (page) => {
    const { token } = await login(page, ALICE)
    await setScenarios(page, ['favorites.fail'])
    const put = await api(page, 'PUT', '/favorites/nft_005', { token })
    expect(put.status).toBe(503)
    expect(put.body.error.code).toBe('TRANSIENT')
    expect((await api(page, 'DELETE', '/favorites/nft_002', { token })).status).toBe(503)
    await setScenarios(page, ['default'])
    expect((await api(page, 'PUT', '/favorites/nft_005', { token })).body).toEqual({ nftId: 'nft_005', favorited: true })
  },
  'session.expired': async (page) => {
    const { token } = await login(page, ALICE)
    expect((await api(page, 'GET', '/session', { token })).status).toBe(200)
    await setScenarios(page, ['session.expired'])
    const r = await api(page, 'GET', '/session', { token })
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('SESSION_EXPIRED')
    const fresh = await login(page, ALICE) // a new login after the expiry works
    expect((await api(page, 'GET', '/session', { token: fresh.token })).status).toBe(200)
  },
  'session.expire-on-checkout': async (page) => {
    const c = await checkout(page, ['session.expire-on-checkout'])
    const r = await postOrder(page, c)
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('SESSION_EXPIRED')
    const again = await login(page, ALICE)
    const orders = await api(page, 'GET', '/orders', { token: again.token })
    expect(orders.body.items).toHaveLength(2) // only the seeded history: nothing was created
    const retry = await postOrder(page, { ...c, token: again.token })
    expect(retry.status).toBe(201) // one-shot: disarmed; cart and quote were preserved
  },
  'auth.forbidden': async (page) => {
    const { token } = await login(page, ALICE)
    expect((await api(page, 'GET', '/orders/ord_0003', { token })).body.error.code).toBe('FORBIDDEN') // always on for other users
    expect((await api(page, 'GET', '/orders/ord_0001', { token })).status).toBe(200)
    await setScenarios(page, ['auth.forbidden'])
    const own = await api(page, 'GET', '/orders/ord_0001', { token })
    expect(own.status).toBe(403)
    expect(own.body.error.code).toBe('FORBIDDEN')
    const w = (await api(page, 'GET', '/wallets', { token })).body.primary as Json
    const patch = { displayName: w.displayName, label: w.label, profileName: w.profileName, network: w.network, address: w.address, type: w.type, referralCode: w.referralCode, email: w.email, ensName: w.ensName, version: w.version }
    expect((await api(page, 'PATCH', '/wallets/wal_003', { token, body: patch })).status).toBe(403)
  },
  'register.email-taken': async (page) => {
    const body = { username: 'carol', email: 'carol@example.test', password: 'Senha@789', confirmPassword: 'Senha@789' }
    await setScenarios(page, ['register.email-taken'])
    const r = await api(page, 'POST', '/auth/register', { body })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('EMAIL_TAKEN')
    expect(r.body.error.fieldErrors.email).toBeTruthy()
    await setScenarios(page, ['default'])
    expect((await api(page, 'POST', '/auth/register', { body })).status).toBe(201)
    expect((await api(page, 'POST', '/auth/register', { body: { ...body, username: 'carol2' } })).status).toBe(409) // existing e-mail conflicts anyway
  },
  'forms.server-validation': async (page) => {
    const { token } = await login(page, ALICE)
    const profile = (await api(page, 'GET', '/profile', { token })).body
    await setScenarios(page, ['forms.server-validation'])
    const upd = await api(page, 'PATCH', '/profile', {
      token,
      body: { displayName: profile.displayName, username: profile.username, email: profile.email, ensName: profile.ensName, walletAlias: profile.walletAlias, version: profile.version },
    })
    expect(upd.status).toBe(422)
    expect(upd.body.error.code).toBe('VALIDATION')
    expect(upd.body.error.fieldErrors.username).toBeTruthy()
    const pwd = await api(page, 'POST', '/profile/password', { token, body: { currentPassword: ALICE.password, newPassword: 'Nova@12345', confirmPassword: 'Nova@12345' } })
    expect(pwd.status).toBe(422)
    expect(pwd.body.error.fieldErrors.newPassword).toBeTruthy()
  },
  'coupon.invalid': async (page) => {
    const guest = randomUUID()
    await setScenarios(page, ['coupon.invalid'])
    const r = await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'welcome10' } })
    expect(r.status).toBe(422)
    expect(r.body.error).toMatchObject({ code: 'COUPON_INVALID', couponCode: 'WELCOME10' })
  },
  'coupon.expired': async (page) => {
    const guest = randomUUID()
    await api(page, 'POST', '/cart/items', { guest, body: { nftId: NFT.id, editionId: NFT.edition, quantity: 1 } })
    expect((await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'WELCOME10' } })).status).toBe(200)
    await setScenarios(page, ['coupon.expired'])
    const r = await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'WELCOME10' } })
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('COUPON_EXPIRED')
    const q = await api(page, 'POST', '/quotes', { guest, body: { network: 'ethereum' } })
    expect(q.body.issues).toContainEqual({ kind: 'coupon_expired', code: 'WELCOME10' })
    expect(q.body.orderable).toBe(false)
    expect(q.body.discount).toBe('0')
  },
  'checkout.price-changed': async (page) => {
    const c = await checkout(page, ['checkout.price-changed'])
    await openSocket(page, 'p', c.token)
    const [ev] = await waitEvent(page, 'p', (e) => e.type === 'nft.updated' && e.resource.id === NFT.id)
    const before = c.quote.lines[0]!.unitPrice as string
    expect(ev!.data.editions[0]!.price).not.toBe(before)
    const r = await postOrder(page, c)
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('QUOTE_STALE')
    expect(r.body.error.quote.version).toBeGreaterThan(c.quote.version)
    expect(r.body.error.changes).toContainEqual(expect.objectContaining({ kind: 'price', from: before }))
    // Confirming the fresh quote works.
    const fresh = { ...c, body: { ...c.body, quoteVersion: r.body.error.quote.version }, key: randomUUID() }
    expect((await postOrder(page, fresh)).status).toBe(201)
  },
  'checkout.sold-out': async (page) => {
    const c = await checkout(page, ['checkout.sold-out'])
    await openSocket(page, 'p', c.token)
    const [ev] = await waitEvent(page, 'p', (e) => e.type === 'nft.updated' && e.resource.id === NFT.id)
    expect(ev!.data).toMatchObject({ soldOut: true, available: 0 })
    const r = await postOrder(page, c)
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('CONFLICT_AVAILABILITY')
    expect(r.body.error.items[0]).toMatchObject({ nftId: NFT.id, editionId: NFT.edition, available: 0 })
    const cart = await api(page, 'GET', '/cart', { token: c.token })
    expect(cart.body.lines[0]!.status).toBe('sold_out') // items preserved
  },
  'order.timeout-after-create': async (page) => {
    const c = await checkout(page, ['order.timeout-after-create'])
    const first = await postOrder(page, c, 1500)
    expect(first.aborted).toBe(true) // created on the server, never answered
    const list = await api(page, 'GET', '/orders', { token: c.token })
    expect(list.body.items).toHaveLength(3)
    const replay = await postOrder(page, c)
    expect(replay.status).toBe(200)
    expect(list.body.items.map((o: Json) => o.id)).toContain(replay.body.id)
    expect((await api(page, 'GET', '/orders', { token: c.token })).body.items).toHaveLength(3) // no duplicate
  },
  'payment.confirmed': async (page) => {
    const c = await checkout(page, ['payment.confirmed'])
    await openSocket(page, 'p', c.token)
    const stockBefore = ((await api(page, 'GET', `/nfts/${NFT.id}`)).body.editions[0]!.available as number)
    const r = await postOrder(page, c)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('pending')
    const [ev] = await waitEvent(page, 'p', (e) => e.type === 'order.updated' && e.data.status === 'confirmed')
    expect(ev!.data.transaction!.hash).toMatch(/^0x[a-f0-9]{64}$/)
    const order = await api(page, 'GET', `/orders/${r.body.id}`, { token: c.token })
    expect(order.body).toMatchObject({ status: 'confirmed', version: 2 })
    expect((await api(page, 'GET', '/cart', { token: c.token })).body.lines).toHaveLength(0)
    expect((await api(page, 'GET', `/nfts/${NFT.id}`)).body.editions[0]!.available).toBe(stockBefore - 2)
  },
  'payment.declined': async (page) => {
    const c = await checkout(page, ['payment.declined'])
    await openSocket(page, 'p', c.token)
    const stockBefore = ((await api(page, 'GET', `/nfts/${NFT.id}`)).body.editions[0]!.available as number)
    const r = await postOrder(page, c)
    const [ev] = await waitEvent(page, 'p', (e) => e.type === 'order.updated' && e.data.status === 'declined')
    expect(ev!.data.declineReason).toBeTruthy()
    expect((await api(page, 'GET', `/orders/${r.body.id}`, { token: c.token })).body.status).toBe('declined')
    expect((await api(page, 'GET', '/cart', { token: c.token })).body.lines).toHaveLength(1) // cart preserved
    await expect.poll(async () => (await api(page, 'GET', `/nfts/${NFT.id}`)).body.editions[0]!.available).toBe(stockBefore) // stock released
  },
  'payment.hold': async (page) => {
    const c = await checkout(page, ['payment.hold'])
    await openSocket(page, 'p', c.token)
    const r = await postOrder(page, c)
    await page.waitForTimeout(2500)
    expect((await api(page, 'GET', `/orders/${r.body.id}`, { token: c.token })).body.status).toBe('pending')
    expect((await api(page, 'GET', '/orders?status=pending', { token: c.token })).body.items).toHaveLength(1)
    await page.evaluate((id) => window.__mock!.settleOrder(id, 'confirmed'), r.body.id as string)
    await waitEvent(page, 'p', (e) => e.type === 'order.updated' && e.data.status === 'confirmed')
    expect((await api(page, 'GET', `/orders/${r.body.id}`, { token: c.token })).body.status).toBe('confirmed')
  },
  'wallet.reject': async (page) => {
    const { token } = await login(page, ALICE)
    await setScenarios(page, ['wallet.reject'])
    const r = await api(page, 'POST', '/wallets/wal_001/connect', { token, body: { network: 'ethereum' } })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ status: 'rejected', walletId: 'wal_001' })
  },
}

test.describe('scenarios', () => {
  for (const name of SCENARIO_NAMES) {
    test(`scenario ${name}`, async ({ page }) => {
      test.setTimeout(45_000)
      await boot(page)
      await checks[name](page)
    })
  }

  test('every scenario of the contract is exercised', () => {
    expect(Object.keys(checks).sort()).toEqual([...SCENARIO_NAMES].sort())
    expect(SCENARIO_NAMES).toHaveLength(24)
  })
})

test.describe('state and lifecycle', () => {
  test('seed is deterministic and rich; passwords are only stored hashed', async ({ page }) => {
    await boot(page)
    const all = await api(page, 'GET', '/nfts?pageSize=60')
    expect(all.body.items).toHaveLength(60)
    expect(all.body.items.filter((n: Json) => n.soldOut).length).toBeGreaterThanOrEqual(5)
    const detail = await Promise.all(all.body.items.slice(0, 12).map((n: Json) => api(page, 'GET', `/nfts/${n.id}`)))
    const kinds = new Set(detail.flatMap((d) => d.body.editions.map((e: Json) => e.kind)))
    expect([...kinds].sort()).toEqual(['1/1', '1/10', '1/50', 'open'])
    const snapshot = JSON.stringify(all.body.items.map((n: Json) => [n.id, n.name, n.price]))
    await page.evaluate(() => window.__mock!.reset())
    const again = await api(page, 'GET', '/nfts?pageSize=60')
    expect(JSON.stringify(again.body.items.map((n: Json) => [n.id, n.name, n.price]))).toBe(snapshot)

    const raw = await page.evaluate(() => localStorage.getItem('mock:db:v1') ?? '')
    expect(raw).not.toContain('Senha@123')
    expect(raw).not.toContain('Senha@456')
    expect(raw).toMatch(/"passwordHash":"[a-f0-9]{64}"/)
  })

  test('catalog filters, sort, search and facets', async ({ page }) => {
    await boot(page)
    const cat = await api(page, 'GET', '/nfts?categories=musica,fotografia&sort=price_asc&pageSize=60')
    expect(cat.body.items.every((n: Json) => ['musica', 'fotografia'].includes(n.category))).toBe(true)
    const prices = cat.body.items.map((n: Json) => Number(n.price))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(cat.body.facets.categories).toHaveLength(9)
    const tab = await api(page, 'GET', '/nfts?tab=new&pageSize=60')
    expect(tab.body.items.every((n: Json) => n.isNew)).toBe(true)
    const q = await api(page, 'GET', '/nfts?q=zzzz-nothing')
    expect(q.body.items).toEqual([])
    const bad = await api(page, 'GET', '/nfts?pageSize=500')
    expect(bad.status).toBe(422)
    expect(bad.body.error.code).toBe('VALIDATION')
    expect((await api(page, 'GET', '/nfts/nft_999')).body.error.code).toBe('NOT_FOUND')
  })

  test('auth: validation, 401s and logout', async ({ page }) => {
    await boot(page)
    expect((await api(page, 'GET', '/favorites')).body.error.code).toBe('UNAUTHENTICATED')
    expect((await api(page, 'GET', '/favorites', { token: 'tok_nope' })).body.error.code).toBe('UNAUTHENTICATED')
    const bad = await api(page, 'POST', '/auth/register', { body: { username: 'x', email: 'nope', password: '1', confirmPassword: '2' } })
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.body.error.fieldErrors)).toEqual(expect.arrayContaining(['username', 'email', 'password']))
    expect((await api(page, 'POST', '/auth/login', { body: { email: ALICE.email, password: 'wrong-pass1' } })).body.error.code).toBe('UNAUTHENTICATED')
    const { token } = await login(page, ALICE)
    expect((await api(page, 'POST', '/auth/logout', { token })).status).toBe(204)
    expect((await api(page, 'GET', '/session', { token })).status).toBe(401)
  })

  test('reset restores the seed, scenarios and drops created data', async ({ page }) => {
    await boot(page)
    const body = { username: 'dave', email: 'dave@example.test', password: 'Senha@789', confirmPassword: 'Senha@789' }
    expect((await api(page, 'POST', '/auth/register', { body })).status).toBe(201)
    await setScenarios(page, ['latency.slow', 'payment.hold'])
    await page.evaluate(() => window.__mock!.updateNft('nft_001', { price: '99.5' }))
    expect((await api(page, 'GET', '/nfts/nft_001')).body.price).toBe('99.5')

    await page.evaluate(() => window.__mock!.reset())
    expect(await page.evaluate(() => window.__mock!.getScenarios())).toEqual(['default'])
    const r = await api(page, 'POST', '/auth/login', { body: { email: body.email, password: body.password } })
    expect(r.status).toBe(401)
    const nft = await api(page, 'GET', '/nfts/nft_001')
    expect(nft.body.price).not.toBe('99.5')
    expect(nft.body.version).toBe(1)
    expect(nft.ms).toBeLessThan(1000)
  })

  test('state and scenarios persist across reload; ?scenario= selects scenarios', async ({ page }) => {
    await boot(page)
    const reg = await api(page, 'POST', '/auth/register', { body: { username: 'erin', email: 'erin@example.test', password: 'Senha@789', confirmPassword: 'Senha@789' } })
    const token = reg.body.token as string
    await api(page, 'PUT', '/favorites/nft_007', { token })
    await setScenarios(page, ['latency.variable', 'coupon.invalid'])

    await page.reload()
    await page.waitForFunction(() => !!window.__mock)
    expect(await page.evaluate(() => window.__mock!.getScenarios())).toEqual(['latency.variable', 'coupon.invalid'])
    const favs = await api(page, 'GET', '/favorites', { token }) // same opaque token still valid after reload
    expect(favs.status).toBe(200)
    expect(favs.body.nftIds).toEqual(['nft_007'])

    await page.goto('/?scenario=catalog.empty,latency.slow')
    await page.waitForFunction(() => !!window.__mock)
    expect(await page.evaluate(() => window.__mock!.getScenarios())).toEqual(['catalog.empty', 'latency.slow'])
    const empty = await api(page, 'GET', '/nfts')
    expect(empty.body.meta.total).toBe(0)
    expect(empty.ms).toBeGreaterThan(2400)
    await page.goto('/')
    await page.waitForFunction(() => !!window.__mock)
    expect(await page.evaluate(() => window.__mock!.getScenarios())).toEqual(['catalog.empty', 'latency.slow']) // persisted in localStorage
  })

  test('guest cart, merge on login (idempotent) and coupons', async ({ page }) => {
    await boot(page)
    const guest = randomUUID()
    expect((await api(page, 'GET', '/cart')).status).toBe(422) // neither token nor X-Guest-Id
    const add = await api(page, 'POST', '/cart/items', { guest, body: { nftId: NFT.id, editionId: NFT.edition, quantity: 3 } })
    expect(add.body.owner).toEqual({ kind: 'guest', guestId: guest })
    expect(add.body.itemCount).toBe(3)
    const over = await api(page, 'POST', '/cart/items', { guest, body: { nftId: NFT.id, editionId: NFT.edition, quantity: 50 } })
    expect(over.status).toBe(409)
    expect(over.body.error.code).toBe('CONFLICT_AVAILABILITY')
    expect((await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'NOPE' } })).body.error.code).toBe('COUPON_INVALID')
    expect((await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'BLACK2024' } })).body.error.code).toBe('COUPON_EXPIRED')
    const withCoupon = await api(page, 'PUT', '/cart/coupon', { guest, body: { code: 'welcome10' } })
    expect(withCoupon.body.couponCode).toBe('WELCOME10')
    const q = await api(page, 'POST', '/quotes', { guest, body: { network: 'polygon' } })
    expect(q.body).toMatchObject({ orderable: true, network: 'polygon', networkFee: '0.0003' })
    expect(q.body.discount).not.toBe('0')

    const { token } = await login(page, ALICE)
    const merged = await api(page, 'POST', '/cart/merge', { token, body: { guestId: guest } })
    expect(merged.body.cart.owner.kind).toBe('user')
    expect(merged.body.cart.itemCount).toBe(3)
    const again = await api(page, 'POST', '/cart/merge', { token, body: { guestId: guest } })
    expect(again.body.cart.itemCount).toBe(3) // no-op
    expect(again.body.adjusted).toEqual([])
    expect((await api(page, 'GET', '/cart', { guest })).body.itemCount).toBe(0) // guest cart is gone

    const line = merged.body.cart.lines[0]!
    const upd = await api(page, 'PATCH', `/cart/items/${line.id}`, { token, body: { quantity: 1 } })
    expect(upd.body.lines[0]!).toMatchObject({ quantity: 1, status: 'ok' })
    expect((await api(page, 'DELETE', `/cart/items/${line.id}`, { token })).body.lines).toEqual([])
    expect((await api(page, 'DELETE', `/cart/items/${line.id}`, { token })).status).toBe(404)
  })

  test('profile, avatar, password and wallets', async ({ page }) => {
    await boot(page)
    const { token } = await login(page, ALICE)
    const profile = (await api(page, 'GET', '/profile', { token })).body
    const patch = { displayName: 'Alice Nova', username: 'alice', email: ALICE.email, ensName: 'alice.eth', walletAlias: 'Minha carteira', version: profile.version }
    const ok = await api(page, 'PATCH', '/profile', { token, body: patch })
    expect(ok.body).toMatchObject({ displayName: 'Alice Nova', version: profile.version + 1 })
    const stale = await api(page, 'PATCH', '/profile', { token, body: patch })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toMatchObject({ code: 'CONFLICT_VERSION', resource: { kind: 'profile' }, currentVersion: ok.body.version })
    expect((await api(page, 'PATCH', '/profile', { token, body: { ...patch, version: ok.body.version, email: BOB.email } })).body.error.code).toBe('EMAIL_TAKEN')

    const avatar = await page.evaluate(async (t) => {
      const fd = new FormData()
      fd.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' }))
      const r = await fetch('/api/profile/avatar', { method: 'PUT', headers: { Authorization: `Bearer ${t}` }, body: fd })
      const bad = new FormData()
      bad.append('file', new File(['x'], 'a.gif', { type: 'image/gif' }))
      const r2 = await fetch('/api/profile/avatar', { method: 'PUT', headers: { Authorization: `Bearer ${t}` }, body: bad })
      return { status: r.status, url: ((await r.json()) as Json).avatarUrl as string, badStatus: r2.status }
    }, token)
    expect(avatar.status).toBe(200)
    expect(avatar.url).toMatch(/^data:image\/png;base64,/)
    expect(avatar.badStatus).toBe(422)
    expect((await api(page, 'DELETE', '/profile/avatar', { token })).body.avatarUrl).toBeNull()

    const pw = { currentPassword: ALICE.password, newPassword: 'Nova@12345', confirmPassword: 'Nova@12345' }
    expect((await api(page, 'POST', '/profile/password', { token, body: { ...pw, currentPassword: 'errada123' } })).body.error.fieldErrors.currentPassword).toBeTruthy()
    expect((await api(page, 'POST', '/profile/password', { token, body: pw })).status).toBe(204)
    expect((await api(page, 'POST', '/auth/login', { body: { email: ALICE.email, password: 'Nova@12345' } })).status).toBe(200)

    const wallets = (await api(page, 'GET', '/wallets', { token })).body
    expect(wallets.primary.slot).toBe('primary')
    expect(wallets.secondary!.slot).toBe('secondary')
    const newWallet = { slot: 'primary', displayName: 'Alice', label: 'Outra', profileName: 'alice', network: 'solana', address: '7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK', type: 'coinbase', referralCode: 'ALICE-2026', email: ALICE.email, ensName: 'alice.eth' }
    expect((await api(page, 'POST', '/wallets', { token, body: newWallet })).body.error.fieldErrors.slot).toBeTruthy() // slot taken
    expect((await api(page, 'POST', '/wallets', { token, body: { ...newWallet, address: '0x123' } })).status).toBe(422)
    const conn = await api(page, 'POST', `/wallets/${wallets.primary.id}/connect`, { token, body: { network: 'solana' } })
    expect(conn.body.status).toBe('rejected') // EVM address cannot connect on Solana
    expect((await api(page, 'DELETE', `/wallets/${wallets.primary.id}/connection`, { token })).status).toBe(204)
    expect((await api(page, 'DELETE', '/wallets/wal_003/connection', { token })).status).toBe(404)
  })

  test('orders are idempotent by Idempotency-Key', async ({ page }) => {
    await boot(page)
    const c = await checkout(page, ['payment.hold'])
    const noKey = await api(page, 'POST', '/orders', { token: c.token, body: c.body })
    expect(noKey.status).toBe(422)
    expect(noKey.body.error.fieldErrors['Idempotency-Key']).toBeTruthy()
    const first = await postOrder(page, c)
    expect(first.status).toBe(201)
    const replay = await postOrder(page, c)
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(first.body.id)
    const other = await postOrder(page, { ...c, body: { ...c.body, collector: { ...COLLECTOR, note: 'outro corpo' } } })
    expect(other.status).toBe(409)
    expect(other.body.error).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', orderId: first.body.id })
    expect((await api(page, 'GET', '/orders', { token: c.token })).body.items).toHaveLength(3)
    // Receipt is an immutable snapshot even if the catalog changes afterwards.
    await page.evaluate(() => window.__mock!.updateNft('nft_004', { price: '50' }))
    const order = await api(page, 'GET', `/orders/${first.body.id}`, { token: c.token })
    expect(order.body.receipt.lines[0]!.unitPrice).toBe(c.quote.lines[0]!.unitPrice)
    // A wallet that belongs to somebody else is rejected.
    const bob = await login(page, BOB)
    expect((await postOrder(page, { token: bob.token, body: { ...c.body, walletId: 'wal_001' }, key: randomUUID() })).body.error.code).toBe('FORBIDDEN')
  })

  test('realtime: events are scoped to the owner; catalog events are public; every DB change emits', async ({ page }) => {
    await boot(page)
    const c = await checkout(page, ['payment.confirmed'])
    const bob = await login(page, BOB)
    await openSocket(page, 'alice', c.token)
    await openSocket(page, 'bob', bob.token)
    await openSocket(page, 'anon', null)
    expect(await probeStatus(page, 'alice')).toBe('connected')

    const order = await postOrder(page, c)
    await waitEvent(page, 'alice', (e) => e.type === 'order.updated' && e.data.status === 'confirmed')
    // Stock reservation emitted nft.updated to everybody (public) with a higher version.
    for (const who of ['alice', 'bob', 'anon']) {
      const evs = await waitEvent(page, who, (e) => e.type === 'nft.updated' && e.resource.id === NFT.id)
      expect(evs[0]!.version).toBeGreaterThan(1)
      expect(evs[0]!.id).toMatch(/^evt_/)
    }
    const aliceOrderEvents = (await probeEvents(page, 'alice')).filter((e) => e.type === 'order.updated')
    expect(aliceOrderEvents.map((e) => e.data.status)).toEqual(['pending', 'confirmed'])
    expect(aliceOrderEvents.every((e) => e.userId === c.userId && e.resource.id === order.body.id)).toBe(true)
    await page.waitForTimeout(300)
    for (const who of ['bob', 'anon']) expect((await probeEvents(page, who)).filter((e) => e.type === 'order.updated')).toEqual([])

    // Test-driven emit targeted at one user.
    await page.evaluate((u) => window.__mock!.emit('order.updated', { id: 'evt_manual', type: 'order.updated', userId: u }, { userId: u }), bob.userId)
    await waitEvent(page, 'bob', (e) => e.id === 'evt_manual')
    expect((await probeEvents(page, 'alice')).some((e) => e.id === 'evt_manual')).toBe(false)

    // updateNft keeps REST and events consistent.
    await page.evaluate(() => window.__mock!.updateNft('nft_001', { price: '9.99' }))
    const [pub] = await waitEvent(page, 'anon', (e) => e.type === 'nft.updated' && e.resource.id === 'nft_001')
    expect(pub!.data.price).toBe('9.99')
    const rest = await api(page, 'GET', '/nfts/nft_001')
    expect(rest.body.price).toBe('9.99')
    expect(rest.body.version).toBe(pub!.version)

    // Server-side drop closes the sockets.
    await page.evaluate(() => window.__mock!.drop())
    await expect.poll(() => probeStatus(page, 'alice')).toBe('disconnected')
  })

  test('two tabs share one DB: no last-write-wins, no id collisions, revoked sessions close their sockets', async ({ page, context }) => {
    await boot(page)
    const { token } = await login(page, ALICE)
    await openSocket(page, 'alice', token)
    expect(await probeStatus(page, 'alice')).toBe('connected')

    const tabB = await context.newPage() // same context: shares localStorage
    await tabB.goto('/')
    await tabB.waitForFunction(() => !!window.__mock)

    // Ids generated concurrently in two tabs do not collide.
    const regA = await api(page, 'POST', '/auth/register', { body: { email: 'tab-a@example.test', username: 'taba', password: 'Senha@123', confirmPassword: 'Senha@123' } })
    const regB = await api(tabB, 'POST', '/auth/register', { body: { email: 'tab-b@example.test', username: 'tabb', password: 'Senha@123', confirmPassword: 'Senha@123' } })
    expect([regA.status, regB.status]).toEqual([201, 201])
    expect(regA.body.user.id).not.toBe(regB.body.user.id)
    // Both registrations survive (A sees B's user and vice-versa).
    expect((await api(page, 'POST', '/auth/login', { body: { email: 'tab-b@example.test', password: 'Senha@123' } })).status).toBe(200)
    expect((await api(tabB, 'POST', '/auth/login', { body: { email: 'tab-a@example.test', password: 'Senha@123' } })).status).toBe(200)

    // Logout in A is visible in B; B's later writes do not resurrect the session in A.
    expect((await api(page, 'POST', '/auth/logout', { token })).status).toBe(204)
    expect((await api(tabB, 'GET', '/session', { token })).status).toBe(401)
    expect((await api(tabB, 'POST', '/auth/login', { body: BOB })).status).toBe(200) // any persist() from B
    await page.reload()
    await page.waitForFunction(() => !!window.__mock)
    expect((await api(page, 'GET', '/session', { token })).status).toBe(401)
    await tabB.close()
  })

  test('revoked and expired sessions lose their sockets and stop receiving events', async ({ page }) => {
    await boot(page)
    const alice = await login(page, ALICE)
    const alice2 = await login(page, ALICE)
    await openSocket(page, 'logout', alice.token)
    await openSocket(page, 'expire', alice2.token)
    expect(await probeStatus(page, 'logout')).toBe('connected')
    expect(await probeStatus(page, 'expire')).toBe('connected')

    await api(page, 'POST', '/auth/logout', { token: alice.token })
    await expect.poll(() => probeStatus(page, 'logout')).toBe('disconnected')

    await setScenarios(page, ['session.expired'])
    await page.evaluate(() => window.__mock!.emit('order.updated', { id: 'evt_after_expiry', type: 'order.updated' }))
    await expect.poll(() => probeStatus(page, 'expire')).toBe('disconnected')
    expect((await probeEvents(page, 'expire')).some((e) => e.id === 'evt_after_expiry')).toBe(false)
  })

  test('password change revokes the other sessions of the user', async ({ page }) => {
    await boot(page)
    const current = await login(page, ALICE)
    const other = await login(page, ALICE)
    const bob = await login(page, BOB)
    const pw = { currentPassword: ALICE.password, newPassword: 'Nova@12345', confirmPassword: 'Nova@12345' }
    expect((await api(page, 'POST', '/profile/password', { token: current.token, body: pw })).status).toBe(204)
    expect((await api(page, 'GET', '/session', { token: current.token })).status).toBe(200)
    expect((await api(page, 'GET', '/session', { token: other.token })).status).toBe(401)
    expect((await api(page, 'GET', '/session', { token: bob.token })).status).toBe(200)
  })

  test('wallet update with a stale version answers 409 CONFLICT_VERSION', async ({ page }) => {
    await boot(page)
    const { token } = await login(page, ALICE)
    const w = (await api(page, 'GET', '/wallets', { token })).body.primary
    const { id, version, ...rest } = w
    const patch = { displayName: rest.displayName, label: 'Renomeada', profileName: rest.profileName, network: rest.network, address: rest.address, type: rest.type, referralCode: rest.referralCode, email: rest.email, ensName: rest.ensName, version }
    expect((await api(page, 'PATCH', `/wallets/${id}`, { token, body: patch })).status).toBe(200)
    const stale = await api(page, 'PATCH', `/wallets/${id}`, { token, body: patch })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toMatchObject({ code: 'CONFLICT_VERSION', resource: { kind: 'wallet', id }, currentVersion: version + 1 })
  })

  test('confirming an order subtracts the receipt quantities from the cart (later additions stay)', async ({ page }) => {
    await boot(page)
    const c = await checkout(page, ['payment.hold'])
    const order = await postOrder(page, c)
    expect(order.status).toBe(201)
    await api(page, 'POST', '/cart/items', { token: c.token, body: { nftId: NFT.id, editionId: NFT.edition, quantity: 1 } }) // after checkout
    await page.evaluate((id) => window.__mock!.settleOrder(id, 'confirmed'), order.body.id)
    const cart = await api(page, 'GET', '/cart', { token: c.token })
    expect(cart.body.lines).toHaveLength(1)
    expect(cart.body.lines[0]!).toMatchObject({ nftId: NFT.id, quantity: 1 })
  })

  test('a corrupted or wrong-version persisted DB is discarded and reseeded', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => localStorage.setItem('mock:db:v1', '{"schema":1,"users":"nope"}'))
    await page.reload()
    await page.waitForFunction(() => !!window.__mock)
    expect((await api(page, 'GET', '/nfts')).body.meta.total).toBe(60)
    await login(page, ALICE)
    await page.evaluate(() => localStorage.setItem('mock:db:v1', JSON.stringify({ schema: 99 })))
    await page.reload()
    await page.waitForFunction(() => !!window.__mock)
    await login(page, ALICE)
  })
})
