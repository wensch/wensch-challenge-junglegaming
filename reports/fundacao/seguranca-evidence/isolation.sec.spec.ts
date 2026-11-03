/**
 * Gate de seguranca da fundacao. Somente leitura do estado do app: o cache do TanStack Query e
 * inspecionado (nunca alterado) via a fibra React do QueryClientProvider; eventos vao pelo servidor
 * simulado (window.__mock.emit) -> socket.io-client.
 */
import type { Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

/** Snapshot (read-only) of the query cache: keys + serialized data. */
async function cacheDump(page: Page): Promise<{ keys: unknown[][]; blob: string }> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[]; state: { data: unknown } }[] } } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const qc = f.memoizedProps?.client
      if (qc?.getQueryCache) {
        const all = qc.getQueryCache().getAll()
        return { keys: all.map((q) => q.queryKey), blob: JSON.stringify(all.map((q) => [q.queryKey, q.state.data])) }
      }
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

async function openAccountMenuAndLogout(page: Page, displayName: string) {
  await page.getByRole('button', { name: displayName }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
}

test('logout na mesma aba: cache privado, rascunhos, token e socket da sessao anterior somem', async ({ page, boot, mock }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-user', alice.user.id)
  await expect(probe).toHaveAttribute('data-status', 'connected')
  await expect(page.getByRole('button', { name: alice.user.displayName })).toBeVisible()
  // Wait for the private cart query (['u', userId, 'cart']).
  await expect.poll(async () => (await cacheDump(page)).keys.some((k) => k[0] === 'u' && k[1] === alice.user.id)).toBe(true)
  // A per-user draft, as the checkout slice will write it.
  await page.evaluate((uid) => sessionStorage.setItem(`kurio.u.${uid}.checkout`, '{"x":1}'), alice.user.id)

  // Private event for alice arrives before logout (baseline).
  await mock.emit('order.updated', orderEvent('evt-pre', alice.user.id), { userId: alice.user.id })
  await expect(probe).toHaveAttribute('data-last-event', 'evt-pre')

  await openAccountMenuAndLogout(page, alice.user.displayName)
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  await expect(probe).toHaveAttribute('data-user', 'guest')

  const dump = await cacheDump(page)
  console.log('[sec] cache keys after logout:', JSON.stringify(dump.keys))
  expect(dump.keys.filter((k) => k[0] === 'u')).toEqual([])
  expect(dump.blob).not.toContain(alice.user.id)
  expect(dump.blob).not.toContain(alice.token)
  expect(dump.blob).not.toContain('alice@example.test')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio.u.')))).toEqual([])

  // Server-side: old token revoked.
  const status = await page.evaluate(async (t) => (await fetch('/api/session', { headers: { Authorization: `Bearer ${t}` } })).status, alice.token)
  expect(status).toBe(401)

  // Alice's private event must not reach the (now visitor) socket at all.
  await mock.emit('order.updated', orderEvent('evt-post', alice.user.id), { userId: alice.user.id })
  await page.waitForTimeout(500)
  await expect(probe).not.toHaveAttribute('data-last-event', 'evt-post')
})

test('troca de usuario (logout alice -> login bob): nada de alice no cache, socket ou UI', async ({ page, boot, mock }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  await expect(page.getByRole('button', { name: alice.user.displayName })).toBeVisible()
  await openAccountMenuAndLogout(page, alice.user.displayName)
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  const bob = await loginViaApi(page, USERS.bob)
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-user', bob.user.id)
  await expect(probe).toHaveAttribute('data-status', 'connected')
  await expect(page.getByRole('button', { name: bob.user.displayName })).toBeVisible()
  await expect(page.getByText(alice.user.displayName)).toHaveCount(0)
  await expect.poll(async () => (await cacheDump(page)).keys.some((k) => k[0] === 'u' && k[1] === bob.user.id)).toBe(true)
  const dump = await cacheDump(page)
  expect(dump.keys.filter((k) => k[0] === 'u' && k[1] !== bob.user.id)).toEqual([])
  expect(dump.blob).not.toContain(alice.user.id)

  // Server only delivers to owner: alice-targeted event never reaches bob's socket.
  await mock.emit('order.updated', orderEvent('evt-alice-only', alice.user.id), { userId: alice.user.id })
  await page.waitForTimeout(500)
  await expect(probe).not.toHaveAttribute('data-last-event', 'evt-alice-only')
  // Untargeted broadcast with alice's userId: client drops it (defense in depth).
  await mock.emit('order.updated', orderEvent('evt-alice-raw', alice.user.id))
  await expect(probe).toHaveAttribute('data-last-event', 'evt-alice-raw')
  await expect(probe).toHaveAttribute('data-last-outcome', 'foreign')
  await expect(probe).toHaveAttribute('data-applied', '0')
})

test('logout em outra aba: a aba remanescente deveria descartar os dados privados', async ({ context, page, boot }) => {
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  const tabB = await context.newPage()
  await tabB.goto('/')
  const probeB = tabB.getByTestId('realtime-probe')
  await expect(tabB.getByRole('button', { name: alice.user.displayName })).toBeVisible()
  await expect(probeB).toHaveAttribute('data-user', alice.user.id)

  await openAccountMenuAndLogout(page, alice.user.displayName)
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  await tabB.waitForTimeout(3000)

  const report = {
    tokenInStorage: await tabB.evaluate(() => localStorage.getItem('kurio.session')),
    nameStillVisible: await tabB.getByRole('button', { name: alice.user.displayName }).isVisible(),
    socketUser: await probeB.getAttribute('data-user'),
    socketStatus: await probeB.getAttribute('data-status'),
    privateKeys: (await cacheDump(tabB)).keys.filter((k) => k[0] === 'u'),
  }
  // Client-side navigation to a private route in tab B (guard reads the cached ['session']).
  await tabB.evaluate(() => {
    history.pushState({}, '', '/checkout')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await tabB.waitForTimeout(1000)
  const urlAfterNav = new URL(tabB.url()).pathname
  const checkoutVisible = await tabB.getByRole('heading', { name: 'Pagamento' }).isVisible()
  console.log('[sec] tab B after logout in tab A:', JSON.stringify({ ...report, urlAfterNav, checkoutVisible }))

  expect.soft(report.nameStillVisible, 'tab B still shows the logged-out user').toBe(false)
  expect.soft(report.socketUser, 'tab B socket still subscribed as the logged-out user').toBe('guest')
  expect.soft(report.privateKeys, 'tab B still holds private cache').toEqual([])
  expect.soft(urlAfterNav, 'tab B still enters private routes').toBe('/login')
})

test('rota privada sem sessao: redireciona sem flash do conteudo privado', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __flash: string[] }).__flash = []
    new MutationObserver(() => {
      const h = document.querySelector('h1')
      if (h && /Pagamento|Perfil|Carteiras|Favoritos|Pedido/.test(h.textContent ?? '')) (window as unknown as { __flash: string[] }).__flash.push(h.textContent ?? '')
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  for (const path of ['/checkout', '/profile', '/wallets', '/favorites', '/orders/ord_0001']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('required')
    expect(url.searchParams.get('redirect')).toBe(path)
    const flash = await page.evaluate(() => (window as unknown as { __flash: string[] }).__flash)
    expect(flash, `flash of private content on ${path}`).toEqual([])
  }
})

test('senha e token: nunca em storage, URL ou console', async ({ page, boot }) => {
  const urls: string[] = []
  const logs: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  page.on('console', (m) => logs.push(m.text()))
  await boot('/')
  const PASSWORD = 'Zq7-unique-Pw-90412'
  const reg = await page.evaluate(async (pw) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sec.audit@example.test', username: 'secaudit', password: pw, confirmPassword: pw }),
    })
    return { status: r.status, body: await r.text() }
  }, PASSWORD)
  expect(reg.status).toBe(201)
  expect(reg.body).not.toContain(PASSWORD)
  expect(reg.body).not.toMatch(/passwordHash|salt/)
  const token = (JSON.parse(reg.body) as { token: string }).token
  await page.evaluate((t) => localStorage.setItem('kurio.session', JSON.stringify({ token: t, expiresAt: new Date(Date.now() + 3600e3).toISOString() })), token)
  await page.reload()
  await expect(page.getByRole('button', { name: 'secaudit' })).toBeVisible()
  // Wrong login + change password with wrong current: errors must not echo the password.
  const errBodies = await page.evaluate(async ([pw, t]) => {
    const a = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sec.audit@example.test', password: pw + 'x' }) })
    const b = await fetch('/api/profile/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ currentPassword: pw + 'x', newPassword: 'Abc12345x', confirmPassword: 'Abc12345x' }) })
    return [a.status, await a.text(), b.status, await b.text()]
  }, [PASSWORD, token] as const)
  console.log('[sec] error responses:', JSON.stringify(errBodies))
  expect(String(errBodies[1])).not.toContain(PASSWORD)
  expect(String(errBodies[3])).not.toContain(PASSWORD)

  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storage).not.toContain(PASSWORD)
  const dbRaw = await page.evaluate(() => localStorage.getItem('mock:db:v1') ?? '')
  const db = JSON.parse(dbRaw) as { users: Record<string, unknown>[]; sessions: Record<string, unknown>[] }
  const me = db.users.find((u) => u.email === 'sec.audit@example.test')!
  console.log('[sec] stored user fields:', Object.keys(me).join(','), 'hashLen=', String(me.passwordHash).length)
  expect(Object.keys(me)).not.toContain('password')
  expect(String(me.passwordHash)).toMatch(/^[0-9a-f]{64}$/)
  expect(dbRaw).not.toContain(token) // only the SHA-256 of the token is stored
  expect(db.sessions.every((s) => !('token' in s))).toBe(true)

  expect(urls.filter((u) => u.includes(token) || u.includes(PASSWORD))).toEqual([])
  expect(logs.filter((l) => l.includes(token) || l.includes(PASSWORD))).toEqual([])
})
