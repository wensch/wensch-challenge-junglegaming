/**
 * Natural session expiry by the local clock (ARCHITECTURE §4; challenge §3: "Trate expiração durante
 * a navegação e durante o checkout, preservando o contexto para retomada").
 * `page.clock` moves the page clock past `expiresAt` (mock TTL = 8 h). The app and the simulated
 * server (MSW handlers run in the page) share that clock. Nothing here touches the query cache: only
 * UI, URL, storage and the REST traffic.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

const PAST_TTL = '08:05:00'

async function loginWithDraft(page: Page) {
  const s = await loginViaApi(page, USERS.alice)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', s.user.id)
  const draftKey = `kurio.u.${s.user.id}.checkout`
  await page.evaluate((k) => sessionStorage.setItem(k, '{"step":"review"}'), draftKey)
  return { session: s, draftKey }
}

async function expectExpiredLogin(page: Page, redirect: string, draftKey: string) {
  await page.waitForURL(/\/login\?/)
  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('reason')).toBe('expired')
  expect(url.searchParams.get('redirect')).toBe(redirect)
  // Context kept for the same user (checkout draft); the token is gone and the socket is a visitor's.
  expect(await page.evaluate((k) => sessionStorage.getItem(k), draftKey)).toBe('{"step":"review"}')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
}

async function openWallets(page: Page, displayName: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('dialog', { name: 'KURIO' }).getByRole('link', { name: 'Carteiras' }).click()
    return
  }
  await page.getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('menuitem', { name: 'Carteiras' }).click()
}

test.describe('expiração natural da sessão (relógio local)', () => {
  test('navegação: aba aberta além do TTL e clique numa rota privada → reason=expired, redirect e rascunho preservados', async ({ page, boot }, info) => {
    await page.clock.install()
    await boot('/')
    const { session, draftKey } = await loginWithDraft(page)

    await page.clock.fastForward(PAST_TTL)
    // Public page: browsing is not interrupted; the next action that needs the session runs the flow.
    expect(new URL(page.url()).pathname).toBe('/')
    await openWallets(page, session.user.displayName, isMobileProject(info.project.name))
    await expectExpiredLogin(page, '/wallets', draftKey)
  })

  test('checkout aberto: o timer de expiresAt dispara o fluxo antes da próxima requisição', async ({ page, boot }) => {
    await page.clock.install()
    await boot('/')
    const { draftKey } = await loginWithDraft(page)
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeVisible()

    const ordersAfterExpiry: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/orders' && r.method() === 'POST') ordersAfterExpiry.push(r.url())
    })
    await page.clock.fastForward(PAST_TTL)
    await expectExpiredLogin(page, '/checkout', draftKey)
    expect(ordersAfterExpiry).toEqual([])
  })

  test('requisição privada depois do vencimento leva o token armazenado e o servidor responde SESSION_EXPIRED', async ({ page, boot }, info) => {
    await page.clock.install()
    await boot('/')
    const { session, draftKey } = await loginWithDraft(page)

    const expiredCalls: { auth: string | null; status: number; code: string | undefined }[] = []
    page.on('response', async (r) => {
      if (new URL(r.url()).pathname !== '/api/cart') return
      const body = (await r.json().catch(() => null)) as { error?: { code?: string } } | null
      expiredCalls.push({ auth: r.request().headers()['authorization'] ?? null, status: r.status(), code: body?.error?.code })
    })
    await page.clock.fastForward(PAST_TTL)
    // The user comes back to the tab: refetch-on-focus of the header cart (a private GET).
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })))
    await expect
      .poll(() => expiredCalls.find((c) => c.status === 401))
      .toEqual({ auth: `Bearer ${session.token}`, status: 401, code: 'SESSION_EXPIRED' })

    // A background read on a public page does not bounce the user; the next private action does.
    expect(new URL(page.url()).pathname).toBe('/')
    await openWallets(page, session.user.displayName, isMobileProject(info.project.name))
    await expectExpiredLogin(page, '/wallets', draftKey)
  })
})
