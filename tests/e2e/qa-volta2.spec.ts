/**
 * QA fundacao volta 2: reteste de BUGS.md (QA-001..006) e exploratorio do que mudou.
 */
import type { Page } from '@playwright/test'
import { avatarUrlSchema, httpsUrlSchema, safeRedirectSchema } from '../../src/api/contracts'
import { endpoints } from '../../src/api/contracts/endpoints'
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

type Form = { name: string; type: string; data: string }
const call = async (page: Page, method: string, path: string, o: { token?: string; body?: unknown; form?: Form } = {}) => {
  await page.waitForFunction(() => !!window.__mock)
  return page.evaluate(
    async ({ method, path, o }) => {
      const headers: Record<string, string> = {}
      if (o.token) headers.Authorization = `Bearer ${o.token}`
      let body: BodyInit | null = null
      if (o.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(o.body)
      }
      if (o.form) {
        const f = new FormData()
        f.append('file', new File([Uint8Array.from(atob(o.form.data), (c) => c.charCodeAt(0))], o.form.name, { type: o.form.type }))
        body = f
      }
      const r = await fetch(`/api${path}`, { method, headers, body })
      const t = await r.text()
      return { status: r.status, body: t ? JSON.parse(t) : null }
    },
    { method, path, o },
  )
}

const E = endpoints as unknown as Record<string, { errors: readonly string[] }>

test.describe('reteste QA-001 redirect (node + browser)', () => {
  const bad = ['//evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/.//evil.com', '/./\t/evil.com', '/..//evil.com', '/a/..//evil.com', '/%2e//evil.com', '/\\evil.com', 'https://evil.com', '/\u0000/evil.com', '/\u007f/x']
  test('safeRedirectSchema: nada que mude de origem', () => {
    for (const v of bad) {
      const r = safeRedirectSchema.safeParse(v)
      const out = r.success ? r.data : null
      if (out !== null) expect(new URL(out, 'http://x').origin, JSON.stringify(v)).toBe('http://x')
      console.log(JSON.stringify(v), '->', JSON.stringify(out))
    }
  })
  for (const v of ['/.//evil.com', '/\t/evil.com', '/..//evil.com', '/%2e//evil.com']) {
    test(`browser login redirect=${JSON.stringify(v)}`, async ({ page, boot }) => {
      await boot('/')
      await page.goto(`/login?redirect=${encodeURIComponent(v)}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
      const u = new URL(page.url())
      const r = u.searchParams.get('redirect')
      console.log('browser', JSON.stringify(v), '->', JSON.stringify(r))
      if (r) expect(new URL(r, u.origin).origin).toBe(u.origin)
    })
  }
  test('controle: destinos validos permanecem', () => {
    expect(safeRedirectSchema.parse('/checkout?x=1')).toBe('/checkout?x=1')
    expect(safeRedirectSchema.parse('/nft/nft_004#a')).toBe('/nft/nft_004#a')
  })
})

test('QA-002/006: primeiro Tab apos carga completa cai no skip link (varias rotas)', async ({ page, boot }) => {
  for (const path of ['/', '/login', '/register', '/cart', '/em-breve', '/nft/nft_004']) {
    await boot(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /Pular para o conteúdo/ }), path).toBeFocused()
  }
})

test('QA-006: navegacao client-side para /em-breve foca o h1', async ({ page, boot }) => {
  await boot('/')
  const link = page.locator('footer a[href^="/em-breve"]').first()
  await link.scrollIntoViewIfNeeded()
  await link.click()
  await expect(page).toHaveURL(/em-breve/)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test('QA-003: CONFLICT_VERSION 409 em profile e wallets (+ corpo)', async ({ page, boot }) => {
  await boot('/')
  const s = await loginViaApi(page, USERS.alice)
  const prof = (await call(page, 'GET', '/profile', { token: s.token })).body
  const patch = { displayName: prof.displayName, username: prof.username, email: prof.email, ensName: prof.ensName, walletAlias: prof.walletAlias, version: prof.version }
  expect((await call(page, 'PATCH', '/profile', { token: s.token, body: { ...patch, displayName: 'Nova' } })).status).toBe(200)
  const stale = await call(page, 'PATCH', '/profile', { token: s.token, body: { ...patch, displayName: 'Outra' } })
  expect(stale.status).toBe(409)
  expect(stale.body.error).toMatchObject({ code: 'CONFLICT_VERSION', resource: { kind: 'profile' }, currentVersion: prof.version + 1 })
  const w = (await call(page, 'GET', '/wallets', { token: s.token })).body.primary
  const { id, version, ...rest } = w
  const wp = { displayName: rest.displayName, label: 'Renomeada', profileName: rest.profileName, network: rest.network, address: rest.address, type: rest.type, referralCode: rest.referralCode, email: rest.email, ensName: rest.ensName, version }
  expect((await call(page, 'PATCH', `/wallets/${id}`, { token: s.token, body: wp })).status).toBe(200)
  const ws = await call(page, 'PATCH', `/wallets/${id}`, { token: s.token, body: wp })
  expect(ws.status).toBe(409)
  expect(ws.body.error.code).toBe('CONFLICT_VERSION')
})

test('QA-004/005: erros declarados em endpoints.ts v1.2.0', () => {
  expect(E.createOrder!.errors).toContain('NOT_FOUND')
  for (const k of ['getCart', 'removeCartItem', 'removeCoupon']) expect(E[k]!.errors, k).toContain('VALIDATION')
  expect(E.updateProfile!.errors).toContain('CONFLICT_VERSION')
  expect(E.updateWallet!.errors).toContain('CONFLICT_VERSION')
})

test('QA-004/005 runtime: respostas reais casam com o declarado', async ({ page, boot }) => {
  await boot('/')
  const s = await loginViaApi(page, USERS.alice)
  const o = await call(page, 'POST', '/orders', { token: s.token, body: { walletId: 'wal_inexistente', quoteId: 'q', items: [] } })
  console.log('createOrder carteira invalida ->', o.status, JSON.stringify(o.body?.error?.code))
  expect(E.createOrder!.errors).toContain(o.body.error.code)
  const c = await call(page, 'GET', '/cart')
  console.log('getCart sem guest ->', c.status, JSON.stringify(c.body?.error?.code))
  expect(E.getCart!.errors).toContain(c.body.error.code)
})

test('contrato x mock: avatar/explorer https-only; seeds sem http: nem SVG', async ({ page, boot }) => {
  expect(httpsUrlSchema.safeParse('http://x.com/a').success).toBe(false)
  expect(httpsUrlSchema.safeParse('https://etherscan.io/tx/0x1').success).toBe(true)
  for (const v of ['http://a.com/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)', 'data:text/html;base64,AAAA', '//evil.com/x.png', 'blob:https://a.com/1']) {
    expect(avatarUrlSchema.safeParse(v).success, v).toBe(false)
  }
  for (const v of ['https://a.com/x.png', '/avatars/x.webp', 'data:image/png;base64,iVBORw0KGgo=']) expect(avatarUrlSchema.safeParse(v).success, v).toBe(true)

  await boot('/')
  const dump = await page.evaluate(async () => {
    const out: string[] = []
    const get = async (p: string, t?: string) => (await fetch(`/api${p}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })).text()
    let pg = 1
    for (;;) {
      const r = JSON.parse(await get(`/nfts?page=${pg}&pageSize=60`))
      out.push(JSON.stringify(r.data))
      if (pg >= r.meta.totalPages) break
      pg++
    }
    for (const c of [{ email: 'alice@example.test', password: 'Senha@123' }, { email: 'bob@example.test', password: 'Senha@456' }]) {
      const s = JSON.parse(await (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })).text())
      out.push(JSON.stringify(s.user))
      for (const p of ['/profile', '/orders?pageSize=60', '/wallets', '/favorites']) out.push(await get(p, s.token))
    }
    return out.join('\n')
  })
  expect(dump.length).toBeGreaterThan(1000)
  expect(dump).not.toMatch(/"http:\/\//)
  expect(dump).not.toMatch(/\.svg|image\/svg/i)
  const urls = [...dump.matchAll(/"(?:explorerUrl|avatarUrl)":"([^"]*)"/g)].map((m) => m[1]!)
  console.log('explorer/avatar urls no seed:', urls.length)
  for (const u of urls) expect(u.startsWith('https://') || u.startsWith('/')).toBe(true)

  const s = await loginViaApi(page, USERS.alice)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const ok = await call(page, 'PUT', '/profile/avatar', { token: s.token, form: { name: 'a.png', type: 'image/png', data: png } })
  console.log('upload png ->', ok.status, String(ok.body?.avatarUrl).slice(0, 30))
  expect(ok.status).toBe(200)
  expect(avatarUrlSchema.safeParse(ok.body.avatarUrl).success).toBe(true)
  expect(ok.body.avatarUrl).toMatch(/^data:image\/png;base64,/)
  for (const t of ['image/svg+xml', 'image/gif', 'text/html']) {
    const r = await call(page, 'PUT', '/profile/avatar', { token: s.token, form: { name: 'a.x', type: t, data: png } })
    expect(r.status, t).toBe(422)
  }
})

const CSP_ROUTES = ['/', '/cart', '/login', '/register', '/nft/nft_004', '/em-breve', '/checkout', '/favorites', '/profile', '/wallets', '/orders/ord_0001', '/rota-inexistente']

// One test per audience: each one boots once and loads 12 full documents (8 workers on Windows push a
// single combined test past 30 s). `test.slow()` keeps headroom under load.
for (const logged of [false, true]) {
  const audience = logged ? 'logado' : 'visitante'
  test(`CSP: sem violacao nem erro de console em todas as rotas (${audience})`, async ({ page, boot }) => {
    test.slow()
    const bad: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy|Refused/i.test(m.text())) bad.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`))
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] }
      w.__csp = []
      document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
    })
    const viol: string[] = []
    await boot('/')
    const user = logged ? (await loginViaApi(page, USERS.alice)).user.id : 'guest'
    for (const p of CSP_ROUTES) {
      await page.goto(p)
      await page.waitForFunction(() => !!window.__mock)
      await expect(page.getByRole('heading').first()).toBeVisible()
      // Wait for the session to settle before leaving the page: a GET /session still in flight when
      // the document unloads loses its MSW client and falls through to the preview server (404).
      await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', user)
      viol.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).map((v) => `${audience} ${p}: ${v}`))
    }
    expect(viol).toEqual([])
    expect(bad).toEqual([])
  })
}

test('lazy: AccountDropdown / Sheet so carregam sob demanda, sem perder o foco', async ({ page, boot }, info) => {
  const mobile = isMobileProject(info.project.name)
  const chunks: string[] = []
  page.on('request', (r) => {
    if (/AccountDropdown|MobileMenuSheet/.test(r.url())) chunks.push(r.url().split('/').pop()!)
  })
  await boot('/')
  await loginViaApi(page, USERS.alice)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-status', 'connected')
  const trigger = mobile ? page.getByRole('button', { name: 'Abrir menu' }) : page.getByRole('button', { name: /Alice/ })
  await expect(trigger).toBeVisible()
  console.log('chunks antes do clique:', chunks)
  await trigger.click()
  if (mobile) {
    const dlg = page.getByRole('dialog', { name: 'KURIO' })
    await expect(dlg).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(trigger).toBeFocused()
  } else {
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=menu]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeHidden()
    await expect(trigger).toBeFocused()
  }
  console.log('chunks depois:', chunks)
})

test('cancelamento: logout com requisicao privada em voo + refresh nao deixa dados nem ressuscita sessao', async ({ page, boot }, info) => {
  const mobile = isMobileProject(info.project.name)
  await boot('/')
  const alice = await loginViaApi(page, USERS.alice)
  await page.goto('/favorites')
  await page.waitForFunction(() => !!window.__mock)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.evaluate(() => window.__mock!.setScenarios(['latency.slow']))
  await page.reload()
  await page.waitForFunction(() => !!window.__mock)
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('dialog', { name: 'KURIO' }).getByRole('button', { name: 'Sair' }).click()
  } else {
    await page.getByRole('button', { name: new RegExp(alice.user.displayName) }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  }
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  await expect(page.getByText(alice.user.displayName)).toHaveCount(0)
  await page.reload()
  await page.waitForFunction(() => !!window.__mock)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
})
