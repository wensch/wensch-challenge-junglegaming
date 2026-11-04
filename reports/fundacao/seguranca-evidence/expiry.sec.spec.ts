/**
 * Seguranca, fundacao volta 3: expiracao natural pelo relogio (N1) e contador de revisao do DB do mock.
 * Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/seguranca-evidence/playwright.security.config.ts expiry
 * O cache so e LIDO (fibra do QueryClientProvider). Eventos sempre por window.__mock.emit (socket.io-client).
 */
import type { Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

const PAST_TTL = '08:05:00'

async function cacheKeys(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[]; state: { data: unknown } }[] } } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const qc = f.memoizedProps?.client
      if (qc?.getQueryCache) return qc.getQueryCache().getAll().map((q) => q.queryKey)
      stack.push(f.child, f.sibling)
    }
    throw new Error('QueryClient not found')
  })
}

/** Serializa todo o cache (keys + data) para procurar ids/tokens/e-mails de outro usuario. */
async function cacheBlob(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[]; state: { data: unknown } }[] } } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const qc = f.memoizedProps?.client
      if (qc?.getQueryCache) return JSON.stringify(qc.getQueryCache().getAll().map((q) => [q.queryKey, q.state.data]))
      stack.push(f.child, f.sibling)
    }
    throw new Error('QueryClient not found')
  })
}

const orderEvent = (id: string, userId: string) => ({
  id,
  type: 'order.updated',
  resource: { kind: 'order', id: 'ord_0001' },
  version: 99,
  userId,
  occurredAt: new Date().toISOString(),
  data: { orderId: 'ord_0001', status: 'confirmed', transaction: null, declineReason: null, updatedAt: new Date().toISOString() },
})

const call = (p: Page, path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
  p.evaluate(
    async ([u, t, i]) => {
      const r = await fetch(u, {
        method: i.method ?? 'GET',
        headers: { Authorization: `Bearer ${t}`, ...(i.body ? { 'Content-Type': 'application/json' } : {}), ...(i.headers ?? {}) },
        body: i.body ? JSON.stringify(i.body) : undefined,
      })
      const b = (await r.json().catch(() => null)) as { error?: { code?: string } } | null
      return { status: r.status, code: b?.error?.code ?? null }
    },
    [path, token, init] as const,
  )

const apiLogin = (p: Page, creds: { email: string; password: string }) =>
  p.evaluate(async (c) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
    return (await r.json()) as { token: string; user: { id: string } }
  }, creds)

function recordLeaks(page: Page, needles: () => string[]) {
  const hits: string[] = []
  page.on('request', (r) => {
    for (const n of needles()) if (n && r.url().includes(n)) hits.push(`url:${r.url()}`)
  })
  page.on('console', (m) => {
    for (const n of needles()) if (n && m.text().includes(n)) hits.push(`console:${m.text().slice(0, 120)}`)
  })
  page.on('framenavigated', (f) => {
    for (const n of needles()) if (n && f.url().includes(n)) hits.push(`nav:${f.url()}`)
  })
  return hits
}

test('token vencido: o servidor rejeita REST e socket; o token nao vaza em URL, console ou redirect', async ({ page, boot }) => {
  let token = ''
  const leaks = recordLeaks(page, () => [token])
  const otherOrigin: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== 'http://localhost:4173' && !r.url().startsWith('data:')) otherOrigin.push(r.url())
  })
  await page.clock.install()
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  token = alice.token
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-user', alice.user.id)

  await page.clock.fastForward(PAST_TTL)
  // REST: GET e mutacao com o token vencido -> 401 SESSION_EXPIRED, nunca 200.
  const results = {
    session: await call(page, '/api/session', alice.token),
    cart: await call(page, '/api/cart', alice.token),
    profile: await call(page, '/api/profile', alice.token),
    orders: await call(page, '/api/orders', alice.token),
    patchProfile: await call(page, '/api/profile', alice.token, { method: 'PATCH', body: { displayName: 'x', version: 1 } }),
  }
  console.log('[sec] expired token REST:', JSON.stringify(results))
  for (const r of Object.values(results)) expect(r.status).toBe(401)
  expect(results.session.code).toBe('SESSION_EXPIRED')
  expect(results.cart.code).toBe('SESSION_EXPIRED')

  // Socket: evento privado de alice emitido depois do vencimento nao chega (stillAuthorised checa expiracao).
  await page.evaluate(([e, u]) => window.__mock!.emit('order.updated', e, { userId: u as string }), [orderEvent('evt-after-expiry', alice.user.id), alice.user.id] as const)
  await page.waitForTimeout(800)
  await expect(probe).not.toHaveAttribute('data-last-event', 'evt-after-expiry')

  // Fluxo completo: rota privada -> /login?reason=expired; o redirect leva so o path.
  await page.evaluate(() => {
    history.pushState({}, '', '/wallets')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.waitForURL(/\/login\?/)
  const u = new URL(page.url())
  console.log('[sec] login url after expiry:', u.pathname + u.search)
  expect(u.searchParams.get('redirect')).toBe('/wallets')
  expect(page.url()).not.toContain(alice.token)
  await expect(probe).toHaveAttribute('data-user', 'guest')
  // Reconexao do socket como visitante: o CONNECT nao pode mais carregar o token vencido como dono.
  await page.evaluate(([e, u2]) => window.__mock!.emit('order.updated', e, { userId: u2 as string }), [orderEvent('evt-after-teardown', alice.user.id), alice.user.id] as const)
  await page.waitForTimeout(800)
  await expect(probe).not.toHaveAttribute('data-last-event', 'evt-after-teardown')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  expect((await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])
  const storageDump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  expect(storageDump.includes(alice.token)).toBe(false)
  console.log('[sec] token leaks:', JSON.stringify(leaks), 'other-origin requests:', JSON.stringify(otherOrigin))
  expect(leaks).toEqual([])
})

test('timer em rota privada: depois do vencimento nenhum dado privado fica na tela nem no cache', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeVisible()
  // Algum dado privado de alice visivel antes (nome no header/menu ou cache privado).
  await expect.poll(async () => (await cacheKeys(page)).some((k) => k[0] === 'u')).toBe(true)

  await page.clock.fastForward(PAST_TTL)
  await page.waitForURL(/\/login\?/, { timeout: 5000 })
  const after = {
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    nameVisible: await page.getByText(alice.user.displayName).count(),
    emailInDom: (await page.content()).includes(USERS.alice.email),
    idInDom: (await page.content()).includes(alice.user.id),
    privateKeys: (await cacheKeys(page)).filter((k) => k[0] === 'u'),
    cacheHasAlice: (await cacheBlob(page)).includes(alice.user.id),
    socketUser: await page.getByTestId('realtime-probe').getAttribute('data-user'),
  }
  console.log('[sec] after timer on /checkout:', JSON.stringify(after))
  expect(after.nameVisible).toBe(0)
  expect(after.emailInDom).toBe(false)
  expect(after.privateKeys).toEqual([])
  expect(after.cacheHasAlice).toBe(false)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
})

test('maquina dormiu (timer nao disparou): ao voltar a aba visivel numa rota privada, o fluxo roda e os dados somem', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  await page.goto('/orders/ord_0001').catch(() => undefined)
  await page.goto('/wallets')
  await expect(page).toHaveURL(/\/wallets$/)
  // Muda so o relogio de parede (timers nao disparam), como num sleep do SO.
  const exp = Date.parse((await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.session')!) as { expiresAt: string })).expiresAt)
  await page.clock.setSystemTime(exp + 60_000)
  await page.waitForTimeout(300)
  const stillOnWallets = new URL(page.url()).pathname
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForURL(/\/login\?/, { timeout: 5000 })
  console.log('[sec] sleep: path before visibilitychange =', stillOnWallets, '-> after =', new URL(page.url()).pathname + new URL(page.url()).search)
  expect((await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])
  await expect(page.getByText(alice.user.displayName)).toHaveCount(0)
})

test('expiracao na aba 1 com rascunho; aba 2 ve o logout; bob entra na aba 2: nada de alice no cache/UI de nenhuma aba', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const draftA = `kurio.u.${alice.user.id}.checkout`
  await page.evaluate((k) => sessionStorage.setItem(k, '{"secret":"rascunho-de-alice"}'), draftA)
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeVisible()

  const tab2 = await page.context().newPage()
  await tab2.goto('/')
  await expect(tab2.getByTestId('realtime-probe')).toHaveAttribute('data-user', alice.user.id)
  const tab2Draft = await tab2.evaluate((k) => sessionStorage.getItem(k), draftA)
  console.log('[sec] tab2 sees tab1 draft (sessionStorage is per tab):', tab2Draft)
  expect(tab2Draft).toBeNull()

  // Vence (o relogio e do contexto; registra se a aba 2 tambem avancou).
  await page.clock.fastForward(PAST_TTL)
  await page.waitForURL(/\/login\?/)
  expect(await page.evaluate((k) => sessionStorage.getItem(k), draftA)).toBe('{"secret":"rascunho-de-alice"}') // contexto preservado p/ alice
  await expect(tab2.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest', { timeout: 10_000 })
  await expect.poll(async () => (await cacheKeys(tab2)).filter((k) => k[0] === 'u')).toEqual([])
  console.log('[sec] tab2 now:', await tab2.evaluate(() => Date.now()), 'tab1 now:', await page.evaluate(() => Date.now()))

  // Bob entra na aba 2 (escreve kurio.session; a aba 1 recebe o evento storage).
  const bob = await loginViaApi(tab2, USERS.bob)
  await expect(tab2.getByTestId('realtime-probe')).toHaveAttribute('data-user', bob.user.id)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', bob.user.id, { timeout: 10_000 })
  const tab1 = {
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    cacheHasAlice: (await cacheBlob(page)).includes(alice.user.id),
    aliceNameVisible: await page.getByText(alice.user.displayName).count(),
    aliceDraftStillInTab1: await page.evaluate((k) => sessionStorage.getItem(k), draftA),
    draftKeys: await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio.u.'))),
  }
  const tab2State = {
    cacheHasAlice: (await cacheBlob(tab2)).includes(alice.user.id),
    draftKeys: await tab2.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio.u.'))),
  }
  console.log('[sec] tab1 after bob login in tab2:', JSON.stringify(tab1))
  console.log('[sec] tab2 after bob login:', JSON.stringify(tab2State))
  expect(tab1.cacheHasAlice).toBe(false)
  expect(tab1.aliceNameVisible).toBe(0)
  expect(tab2State.cacheHasAlice).toBe(false)
  expect(tab2State.draftKeys).toEqual([])
  // Nenhum codigo de bob le chaves de outro usuario (prefixo por userId); o rascunho de alice que sobra
  // na aba 1 e registrado no relatorio (nao aparece na UI de bob).
  await tab2.close()
})

test('contador de revisao: sessao expirada/revogada nao ressuscita por escrita de aba com estado velho', async ({ page, boot }) => {
  await boot('/')
  const alice = await apiLogin(page, USERS.alice)
  const tabB = await page.context().newPage()
  await tabB.goto('/')
  await tabB.waitForFunction(() => !!window.__mock)
  expect((await call(tabB, '/api/session', alice.token)).status).toBe(200) // aba B adotou o DB com a sessao viva
  const revBefore = await page.evaluate(() => localStorage.getItem('mock:db:v1:rev'))

  // Aba A: expiracao simulada no checkout (expireSession grava expiresAt no passado).
  await page.evaluate(() => window.__mock!.setScenarios(['session.expire-on-checkout']))
  const order = await call(page, '/api/orders', alice.token, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: { quoteId: 'q_0001', quoteVersion: 1, walletId: 'wal_0001', connectionId: 'con_0001', network: 'ethereum', collector: { displayName: 'Alice Teste', username: 'alice_t', profileName: 'alice_t', email: 'alice@example.test', ensName: 'alice.eth', referralCode: 'ABCD' } },
  })
  const revAfter = await page.evaluate(() => localStorage.getItem('mock:db:v1:rev'))
  console.log('[sec] expire-on-checkout:', JSON.stringify(order), 'rev', revBefore, '->', revAfter)
  expect(order).toEqual({ status: 401, code: 'SESSION_EXPIRED' })
  expect(revAfter).not.toBe(revBefore)

  // Aba B escreve (login de bob) e a aba A escreve de novo; a sessao de alice segue expirada nas duas.
  await apiLogin(tabB, USERS.bob)
  await apiLogin(page, USERS.bob)
  const s = { a: await call(page, '/api/session', alice.token), b: await call(tabB, '/api/session', alice.token) }
  console.log('[sec] alice token after stale-tab writes:', JSON.stringify(s))
  expect(s.a.status).toBe(401)
  expect(s.b.status).toBe(401)

  // Revogacao (logout) da sessao de bob na aba B; aba A, que ja tinha o rev anterior, enxerga.
  const bob = await apiLogin(page, USERS.bob)
  expect((await call(tabB, '/api/session', bob.token)).status).toBe(200)
  expect((await call(tabB, '/api/auth/logout', bob.token, { method: 'POST' })).status).toBe(204)
  await call(page, '/api/auth/login', '', { method: 'POST', body: USERS.alice }).catch(() => undefined) // escrita da aba A
  const r = { a: await call(page, '/api/session', bob.token), b: await call(tabB, '/api/session', bob.token) }
  console.log('[sec] revoked bob token after A write:', JSON.stringify(r))
  expect(r.a.status).toBe(401)
  expect(r.b.status).toBe(401)
  // Revisoes por aba sao distintas (tabId aleatorio): nao colidem.
  const revs = await page.evaluate(() => localStorage.getItem('mock:db:v1:rev'))
  console.log('[sec] final rev:', revs)
  await tabB.close()
})

test('pagina publica depois do vencimento (residual documentado): o que fica na tela e no cache, e o servidor nao entrega nada novo', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-user', alice.user.id)
  await page.clock.fastForward(PAST_TTL)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(1500)
  await page.evaluate(([e, u]) => window.__mock!.emit('order.updated', e, { userId: u as string }), [orderEvent('evt-public-after', alice.user.id), alice.user.id] as const)
  await page.waitForTimeout(800)
  const state = {
    path: new URL(page.url()).pathname,
    tokenInStorage: (await page.evaluate(() => localStorage.getItem('kurio.session'))) !== null,
    privateKeys: (await cacheKeys(page)).filter((k) => k[0] === 'u'),
    nameVisible: await page.getByText(alice.user.displayName).count(),
    socketUser: await probe.getAttribute('data-user'),
    lastEvent: await probe.getAttribute('data-last-event'),
  }
  console.log('[sec] public page after expiry:', JSON.stringify(state))
  expect(state.lastEvent).not.toBe('evt-public-after')
})
