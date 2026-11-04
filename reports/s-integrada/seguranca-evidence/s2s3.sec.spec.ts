/**
 * Gate de seguranca S2+S3. Estado preparado pelos endpoints REST reais (MSW) e pela UI; cache do
 * TanStack Query apenas LIDO via fibra React; eventos pelo servidor simulado (window.__mock.emit).
 */
import type { Page } from '@playwright/test'
import { expect, test, USERS } from '../../../tests/fixtures'
import { cacheKeys, loginAs, logoutThroughUi } from '../../../tests/account-helpers'
import { addToCart, connectWallet, loginWithCart, pickEditions, sendOrder } from '../../../tests/s3-helpers'

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

const storageDump = (page: Page) =>
  page.evaluate(() => {
    const dump = (s: Storage) => Object.fromEntries(Array.from({ length: s.length }, (_, i) => s.key(i)!).map((k) => [k, s.getItem(k) ?? '']))
    return { local: dump(localStorage), session: dump(sessionStorage) }
  })

const domText = (page: Page) =>
  page.evaluate(() => document.body.innerText + '\n' + Array.from(document.querySelectorAll('input,textarea'), (e) => (e as HTMLInputElement).value).join('\n'))

async function api(page: Page, method: string, path: string, token: string, body?: unknown, extra: Record<string, string> = {}) {
  return page.evaluate(
    async ([m, p, t, b, x]) => {
      const r = await fetch(`/api${p}`, { method: m, headers: { Authorization: `Bearer ${t}`, ...(b !== undefined ? { 'Content-Type': 'application/json' } : {}), ...x }, body: b === undefined ? undefined : typeof b === 'string' ? b : JSON.stringify(b) })
      return { status: r.status, text: await r.text() }
    },
    [method, path, token, body, extra] as const,
  )
}

test('S2+S3: troca de usuario pela UI nao deixa dados de alice (cache, DOM, storage, socket); idempotencia; senha', async ({ page, boot, mock }, info) => {
  const mobile = info.project.name === 'mobile'
  const urls: string[] = []
  const consoleLines: string[] = []
  let orderReq: { headers: Record<string, string>; body: string } | null = null
  page.on('console', (m) => consoleLines.push(m.text()))
  page.on('request', (r) => {
    urls.push(r.url())
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') orderReq = { headers: r.headers(), body: r.postData() ?? '' }
  })

  await boot('/')
  const [a, b] = await pickEditions(page, 2)
  const alice = await loginWithCart(page, [{ item: a!, quantity: 1 }])
  const aliceId = alice.user.id

  // 1) Compra real pela UI com payload XSS na observacao do colecionador.
  await page.goto('/checkout')
  const XSS = 'NOTA_ALICE_SEGREDO <img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
  await page.getByLabel('Observação do colecionador (opcional)').fill(XSS)
  await connectWallet(page)
  await sendOrder(page)
  await page.waitForURL(/\/orders\/ord_/)
  await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 20_000 })
  const aliceOrderId = new URL(page.url()).pathname.split('/').pop()!
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

  // 2) Idempotencia: mesma chave + mesmo corpo -> mesmo pedido; mesma chave + corpo diferente -> 409.
  expect(orderReq).not.toBeNull()
  const req = orderReq as unknown as { headers: Record<string, string>; body: string }
  const key = req.headers['idempotency-key']!
  expect(key).toMatch(/^[0-9a-f-]{36}$/)
  expect(urls.some((u) => u.includes(key))).toBe(false)
  const same = await api(page, 'POST', '/orders', alice.token, req.body, { 'Idempotency-Key': key })
  expect(same.status).toBe(200)
  expect(JSON.parse(same.text).id).toBe(aliceOrderId)
  const changed = JSON.parse(req.body) as { collector: { note?: string } }
  changed.collector.note = 'outro corpo'
  const conflict = await api(page, 'POST', '/orders', alice.token, changed, { 'Idempotency-Key': key })
  expect(conflict.status).toBe(409)
  expect(conflict.text).toContain('IDEMPOTENCY_CONFLICT')

  // 3) Rascunho do colecionador com dados pessoais + perfil e carteiras no cache.
  await addToCart(page, { token: alice.token }, b!, 1)
  await page.goto('/checkout')
  await page.getByLabel('Observação do colecionador (opcional)').fill('RASCUNHO_ALICE_2')
  await connectWallet(page)
  await page.waitForFunction((id) => (sessionStorage.getItem(`kurio.u.${id}.checkout`) ?? '').includes('RASCUNHO_ALICE_2'), aliceId)
  const wallets = JSON.parse((await api(page, 'GET', '/wallets', alice.token)).text) as Record<string, unknown>
  const aliceWallet = JSON.stringify(wallets).match(/"id":"(wal_[^"]+)"/)![1]!
  const aliceAddress = JSON.stringify(wallets).match(/"address":"([^"]+)"/)![1]!
  await page.goto('/profile')
  await expect(page.getByRole('main').getByLabel('E-mail')).toHaveValue(USERS.alice.email)
  await page.goto('/wallets')
  await expect(page.getByRole('main')).toContainText(aliceAddress.slice(0, 6))

  // 4) Logout pela UI.
  await logoutThroughUi(page, alice.user.displayName, mobile)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
  expect((await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])
  const afterLogout = await storageDump(page)
  expect(Object.keys(afterLogout.session).filter((k) => k.startsWith('kurio.u.'))).toEqual([])
  expect(afterLogout.local['kurio.session']).toBeUndefined()

  // 5) Bob entra pela UI.
  await page.goto('/login')
  await loginAs(page, USERS.bob)
  const bobId = await page.getByTestId('realtime-probe').getAttribute('data-user')
  expect(bobId).not.toBe(aliceId)
  const bobToken = JSON.parse((await storageDump(page)).local['kurio.session']!).token as string

  const secrets = ['NOTA_ALICE_SEGREDO', 'RASCUNHO_ALICE_2', USERS.alice.email, aliceAddress, aliceOrderId, aliceWallet]
  for (const path of ['/checkout', '/profile', '/wallets', '/cart']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const text = await domText(page)
    for (const s of secrets) expect(text, `${path} DOM contem ${s}`).not.toContain(s)
  }
  const blob = await cacheBlob(page)
  for (const s of [...secrets, aliceId]) expect(blob, `cache contem ${s}`).not.toContain(s)
  const st = JSON.stringify((await storageDump(page)).session)
  for (const s of [...secrets, aliceId]) expect(st, `sessionStorage contem ${s}`).not.toContain(s)

  // 6) Pedido/carteira de alice com o token de bob: negado sem dados.
  await page.goto(`/orders/${aliceOrderId}`)
  await expect(page.getByRole('heading', { name: 'Pedido indisponível' })).toBeVisible()
  await expect(page.getByTestId('receipt')).toHaveCount(0)
  for (const s of secrets.slice(0, 4)) expect(await domText(page)).not.toContain(s)
  const probes = [
    await api(page, 'GET', `/orders/${aliceOrderId}`, bobToken),
    await api(page, 'PATCH', `/wallets/${aliceWallet}`, bobToken, { nickname: 'x', version: 1 }),
    await api(page, 'POST', `/wallets/${aliceWallet}/connect`, bobToken, { network: 'ethereum' }),
    await api(page, 'POST', '/orders', bobToken, req.body, { 'Idempotency-Key': key }),
  ]
  for (const p of probes) {
    expect([403, 404, 422]).toContain(p.status)
    for (const s of ['NOTA_ALICE_SEGREDO', aliceAddress, USERS.alice.email]) expect(p.text).not.toContain(s)
  }

  // 7) order.updated de alice difundido a todos: bob descarta.
  const ev = { id: 'evt_sec_s23', type: 'order.updated', resource: { kind: 'order', id: aliceOrderId }, version: 999, userId: aliceId, occurredAt: new Date().toISOString(), data: { orderId: aliceOrderId, status: 'declined', transaction: null, declineReason: 'x', updatedAt: new Date().toISOString() } }
  await mock.emit('order.updated', ev)
  await page.waitForTimeout(800)
  const probe = page.getByTestId('realtime-probe')
  const last = await probe.getAttribute('data-last-event')
  if (last === 'evt_sec_s23') await expect(probe).toHaveAttribute('data-last-outcome', 'foreign')
  expect(await cacheBlob(page)).not.toContain(aliceOrderId)

  // 8) Senhas nunca em claro (storage incl. DB do mock, URLs, console).
  const all = JSON.stringify(await storageDump(page))
  for (const pw of [USERS.alice.password, USERS.bob.password]) {
    expect(all).not.toContain(pw)
    expect(urls.join('\n')).not.toContain(encodeURIComponent(pw))
    expect(urls.join('\n')).not.toContain(pw)
    expect(consoleLines.join('\n')).not.toContain(pw)
  }
  expect(all).toContain('passwordHash')
  for (const t of [alice.token, bobToken]) expect(urls.join('\n')).not.toContain(t)
  test.info().annotations.push({ type: 'evidencia', description: JSON.stringify({ aliceOrderId, key, probes: probes.map((p) => p.status), conflict: conflict.status, last }) })
})

test('troca de senha revoga as outras sessoes; avatar recusa SVG e > 2 MB', async ({ page, boot }) => {
  await boot('/')
  const login = () =>
    page.evaluate(async (c) => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
      return ((await r.json()) as { token: string }).token
    }, USERS.alice)
  const t1 = await login()
  const t2 = await login()
  const NEW = 'NovaSenha@789'
  const ch = await api(page, 'POST', '/profile/password', t1, { currentPassword: USERS.alice.password, newPassword: NEW, confirmPassword: NEW })
  expect(ch.status).toBe(204)
  expect(ch.text).not.toContain(NEW)
  expect((await api(page, 'GET', '/profile', t2)).status).toBe(401)
  expect((await api(page, 'GET', '/profile', t1)).status).toBe(200)
  const dump = JSON.stringify(await storageDump(page))
  expect(dump).not.toContain(NEW)

  const upload = (type: string, size: number, name: string) =>
    page.evaluate(
      async ([t, ty, sz, n]) => {
        const fd = new FormData()
        fd.append('file', new File([new Uint8Array(sz)], n, { type: ty }))
        const r = await fetch('/api/profile/avatar', { method: 'PUT', headers: { Authorization: `Bearer ${t}` }, body: fd })
        return { status: r.status, text: await r.text() }
      },
      [t1, type, size, name] as const,
    )
  expect((await upload('image/svg+xml', 100, 'a.svg')).status).toBe(422)
  expect((await upload('text/html', 100, 'a.html')).status).toBe(422)
  expect((await upload('image/png', 2 * 1024 * 1024 + 1, 'big.png')).status).toBe(422)
  const ok = await upload('image/png', 64, 'ok.png')
  expect(ok.status).toBe(200)
  expect(JSON.parse(ok.text).avatarUrl).toMatch(/^data:image\/png;base64,/)
})
