/**
 * Natural session expiry by the local clock (ARCHITECTURE §4; challenge §3: "Trate expiração durante
 * a navegação e durante o checkout, preservando o contexto para retomada").
 * `page.clock` moves the page clock past `expiresAt` (mock TTL = 8 h). The app and the simulated
 * server (MSW handlers run in the page) share that clock. Nothing here touches the query cache: only
 * UI, URL, storage and the REST traffic.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

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

/**
 * Silent `expired` teardown on a PUBLIC page: no redirect, header back to the visitor's, token gone,
 * socket reconnected as a visitor, the same user's draft kept, and a non-modal toast (inside the
 * `aria-live` notifications region) whose "Entrar" link resumes the current route.
 */
async function expectSilentExpiry(page: Page, displayName: string, draftKey: string, mobile: boolean) {
  const toast = page.getByTestId('session-expired-toast')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('Sua sessão expirou')
  await expect(page.locator('section[aria-live="polite"]').getByTestId('session-expired-toast')).toHaveCount(1)
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  expect(await page.evaluate((k) => sessionStorage.getItem(k), draftKey)).toBe('{"step":"review"}')
  if (!mobile) await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(displayName) })).toHaveCount(0)
}

test.describe('expiração natural da sessão (relógio local)', () => {
  test('página pública: o timer faz o teardown silencioso, mostra o aviso e "Entrar" retoma a rota atual', async ({ page, boot }, info) => {
    const mobile = isMobileProject(info.project.name)
    await page.clock.install()
    await boot('/')
    const { session, draftKey } = await loginWithDraft(page)

    await page.clock.fastForward(PAST_TTL)
    await expectSilentExpiry(page, session.user.displayName, draftKey, mobile)

    await page.getByTestId('session-expired-toast').getByRole('link', { name: 'Entrar' }).click()
    await page.waitForURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.searchParams.get('redirect')).toBe('/')
    expect(await page.evaluate((k) => sessionStorage.getItem(k), draftKey)).toBe('{"step":"review"}')
    await expect(page.getByTestId('session-expired-toast')).toHaveCount(0)
  })

  test('depois do teardown silencioso, a próxima rota privada responde reason=expired com redirect', async ({ page, boot }, info) => {
    await page.clock.install()
    await boot('/')
    const { session, draftKey } = await loginWithDraft(page)
    await page.clock.fastForward(PAST_TTL)
    await expectSilentExpiry(page, session.user.displayName, draftKey, isMobileProject(info.project.name))
    // Client-side navigation (footer link, present for visitors on every viewport).
    await page.getByRole('contentinfo').getByRole('link', { name: 'Meu perfil' }).click()
    await expectExpiredLogin(page, '/profile', draftKey)
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

  test('GET privado de fundo com o token vencido: o servidor responde SESSION_EXPIRED e a página pública faz o teardown silencioso', async ({ page, boot }, info) => {
    await page.clock.install()
    await boot('/')
    const { session, draftKey } = await loginWithDraft(page)

    const expiredCalls: { auth: string | null; status: number; code: string | undefined }[] = []
    page.on('response', async (r) => {
      if (new URL(r.url()).pathname !== '/api/cart') return
      const body = (await r.json().catch(() => null)) as { error?: { code?: string } } | null
      expiredCalls.push({ auth: r.request().headers()['authorization'] ?? null, status: r.status(), code: body?.error?.code })
    })
    // Only the wall clock jumps (machine asleep): no timer fires, so the first thing that notices the
    // expiry is the request itself.
    await page.clock.setSystemTime(Date.parse(session.expiresAt) + 5 * 60_000)
    // Refetch-on-focus of the header cart (a private GET). Dispatched on `window` (TanStack Query's
    // focus listener) and not on `document`, so the app's expiry-timer re-arm does not run first.
    // Two correct paths notice the expiry: the private GET (server answers 401 SESSION_EXPIRED) or the local
    // clock check (no request at all). Which one wins is a race, so the test pins the OUTCOME (silent
    // expiry, below) and, only when a request did go out after the jump, that it carried the stored token
    // and was rejected. The event is re-dispatched because a refetch is skipped while the first GET is in flight.
    const sessionEnded = () => page.evaluate(() => localStorage.getItem('kurio.session') === null)
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
          return (await sessionEnded()) || expiredCalls.some((c) => c.status === 401)
        },
        { intervals: [100, 250, 500, 1000], timeout: 15_000 },
      )
      .toBe(true)
    for (const c of expiredCalls.filter((x) => x.status !== 200)) {
      expect(c).toEqual({ auth: `Bearer ${session.token}`, status: 401, code: 'SESSION_EXPIRED' })
    }

    await expectSilentExpiry(page, session.user.displayName, draftKey, isMobileProject(info.project.name))
  })

  test('F5: POST /orders com a sessão vencida no servidor (session.expire-on-checkout) cria nenhum pedido e retoma o checkout', async ({ page, boot }) => {
    await boot('/', ['session.expire-on-checkout'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const posts: number[] = []
    page.on('response', (r) => {
      if (new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'POST') posts.push(r.status())
    })
    await sendOrder(page)
    await page.waitForURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.searchParams.get('redirect')).toBe('/checkout')
    expect(posts).toEqual([401])
    expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
    expect(await page.evaluate((id) => sessionStorage.getItem(`kurio.u.${id}.checkout`), session.user.id)).not.toBeNull()
  })
})
