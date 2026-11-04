/**
 * Seguranca, fundacao volta 2: DB do mock entre abas, sessao revogada, socket revogado, 401 UNAUTHENTICATED.
 * Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/seguranca-evidence/playwright.security.config.ts
 * O cache so e LIDO (fibra do QueryClientProvider). Eventos sempre por window.__mock.emit (socket.io-client).
 */
import type { Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

async function cacheKeys(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[] }[] } } } }
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

const orderEvent = (id: string, userId: string) => ({
  id,
  type: 'order.updated',
  resource: { kind: 'order', id: 'ord_0001' },
  version: 99,
  userId,
  occurredAt: new Date().toISOString(),
  data: { orderId: 'ord_0001', status: 'confirmed', transaction: null, declineReason: null, updatedAt: new Date().toISOString() },
})

const emitIn = (p: Page, evt: unknown, userId: string) =>
  p.evaluate(([e, u]) => window.__mock!.emit('order.updated', e, { userId: u as string }), [evt, userId] as const)

const sessionStatus = (p: Page, token: string) =>
  p.evaluate(async (t) => (await fetch('/api/session', { headers: { Authorization: `Bearer ${t}` } })).status, token)

const apiLogin = (p: Page, creds: { email: string; password: string }) =>
  p.evaluate(async (c) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
    return (await r.json()) as { token: string; user: { id: string } }
  }, creds)

/** Tab sharing storage with `page`, whose APP ignores `storage` events: isolates the simulated server's behavior. */
async function deafTab(page: Page) {
  const tab = await page.context().newPage()
  await tab.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true))
  await tab.goto('/')
  await tab.waitForFunction(() => !!window.__mock)
  return tab
}

test('logout na aba A: o servidor simulado da aba B nao aceita mais o token e nao entrega eventos ao socket revogado', async ({ page, boot }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const tabB = await deafTab(page)
  const probeB = tabB.getByTestId('realtime-probe')
  await expect(probeB).toHaveAttribute('data-user', alice.user.id)
  await expect(probeB).toHaveAttribute('data-status', 'connected')

  // Controle: antes da revogacao o evento privado chega ao socket da aba B.
  await emitIn(tabB, orderEvent('evt-b-pre', alice.user.id), alice.user.id)
  await expect(probeB).toHaveAttribute('data-last-event', 'evt-b-pre')

  // Revogacao pela aba A (POST /auth/logout com o token), sem tocar no storage.
  const st = await page.evaluate(async (t) => (await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })).status, alice.token)
  expect(st).toBe(204)

  await emitIn(tabB, orderEvent('evt-b-post', alice.user.id), alice.user.id)
  await tabB.waitForTimeout(1500)
  const after = await probeB.evaluate((el) => ({ user: el.getAttribute('data-user'), last: el.getAttribute('data-last-event'), status: el.getAttribute('data-status'), conns: el.getAttribute('data-connections') }))
  console.log('[sec] tab B socket after revoke in tab A:', JSON.stringify(after))
  expect(after.last).not.toBe('evt-b-post')
  console.log('[sec] tab B storage token after revoke:', await tabB.evaluate(() => localStorage.getItem('kurio.session')))
  expect(await sessionStatus(tabB, alice.token)).toBe(401)

  // Sessao revogada nao volta: a aba B escreve no DB (login de bob) e o token antigo continua 401 nas duas abas.
  await apiLogin(tabB, USERS.bob)
  expect(await sessionStatus(page, alice.token)).toBe(401)
  expect(await sessionStatus(tabB, alice.token)).toBe(401)
  // E a aba A escreve tambem (com estado em memoria possivelmente velho).
  await apiLogin(page, USERS.bob)
  expect(await sessionStatus(tabB, alice.token)).toBe(401)
  expect(await sessionStatus(page, alice.token)).toBe(401)
})

test('troca de senha em outra aba revoga as outras sessoes (inclusive a do app) e o socket revogado nao recebe eventos', async ({ page, boot }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice) // T1: sessao do app
  const probeA = page.getByTestId('realtime-probe')
  await expect(probeA).toHaveAttribute('data-status', 'connected')
  const tabB = await page.context().newPage()
  await tabB.goto('/')
  await tabB.waitForFunction(() => !!window.__mock)
  const t2 = (await apiLogin(tabB, USERS.alice)).token // T2: "outro dispositivo"
  const st = await tabB.evaluate(async (t) => {
    const r = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ currentPassword: 'Senha@123', newPassword: 'Nova@Senha789', confirmPassword: 'Nova@Senha789' }),
    })
    return r.status
  }, t2)
  expect(st).toBe(204)

  expect(await sessionStatus(page, alice.token)).toBe(401) // aba A (DB em memoria proprio) ve a revogacao
  expect(await sessionStatus(tabB, alice.token)).toBe(401)
  expect(await sessionStatus(page, t2)).toBe(200) // a sessao que trocou a senha continua
  await emitIn(page, orderEvent('evt-a-post-pw', alice.user.id), alice.user.id)
  await page.waitForTimeout(1500)
  await expect(probeA).not.toHaveAttribute('data-last-event', 'evt-a-post-pw')
  // Login com a senha antiga falha nas duas abas.
  const oldLogin = await page.evaluate(async (c) => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })).status, USERS.alice)
  expect(oldLogin).toBe(401)
})

test('401 UNAUTHENTICATED (reset do mock) com Bearer faz teardown: cache privado, socket e UI', async ({ page, boot, mock }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-user', alice.user.id)
  await expect.poll(async () => (await cacheKeys(page)).some((k) => k[0] === 'u')).toBe(true)

  await mock.reset() // o servidor esquece a sessao
  await mock.drop() // reconexao -> onReconnect invalida carrinho -> GET /cart com Bearer -> 401 UNAUTHENTICATED
  await expect(probe).toHaveAttribute('data-user', 'guest', { timeout: 10_000 })
  await expect.poll(async () => (await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  await expect(page.getByText(alice.user.displayName)).toHaveCount(0)
  await page.evaluate(() => {
    history.pushState({}, '', '/checkout')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL(/\/login\?/)
})
