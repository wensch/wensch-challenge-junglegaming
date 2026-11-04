/**
 * E2E-14 — reteste final de QA: favoritos de ponta a ponta pela UI, menu/rodapé, troca de usuário,
 * compra após timeout com outro pedido aberto, geometria em 768 px e boot frio.
 */
import type { Page } from '@playwright/test'
import { loginAs, logoutThroughUi } from '../account-helpers'
import { expect, loginViaApi, test, USERS } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../s3-helpers'

const items = (page: Page) => page.getByTestId('favorite-item')

test.describe('lista de interesse pela interface', () => {
  test('favoritar no catálogo e no detalhe aparece na lista; remover; alice -> bob isolado', async ({ page, boot }, info) => {
    const mobile = info.project.name === 'mobile'
    await boot('/')
    await loginViaApi(page, USERS.alice)
    if (mobile) {
      const heart = page.locator('[data-nft-id="nft_001"]').first().getByRole('button', { name: /^Favorit/ }).first()
      await expect(heart).toBeEnabled()
      const put = page.waitForResponse((r) => /\/api\/favorites\//.test(r.url()) && r.request().method() === 'PUT')
      await heart.click()
      await put
      await expect(heart).toHaveAttribute('aria-pressed', 'true')
    } else {
      await page.goto('/nft/nft_001')
      const h1 = page.getByRole('button', { name: /^Favorit/ }).first()
      await expect(h1).toBeEnabled()
      const put = page.waitForResponse((r) => /\/api\/favorites\//.test(r.url()) && r.request().method() === 'PUT')
      await h1.click()
      await put
      await expect(h1).toHaveAttribute('aria-pressed', 'true')
    }
    await page.goto('/nft/nft_003')
    const dh = page.getByRole('button', { name: /^Favorit/ }).first()
    await expect(dh).toBeEnabled()
    const put3 = page.waitForResponse((r) => /\/api\/favorites\//.test(r.url()) && r.request().method() === 'PUT')
    await dh.click()
    await put3
    await expect(dh).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('adicionado aos favoritos')

    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(5)
    await expect(page.locator('[data-nft-id="nft_001"]')).toHaveCount(1)
    await expect(page.locator('[data-nft-id="nft_003"]')).toHaveCount(1)
    await page.getByRole('button', { name: /^Remover .* da lista de interesse$/ }).first().click()
    await expect(items(page)).toHaveCount(4)

    await logoutThroughUi(page, 'Alice', mobile)
    await expect(page).not.toHaveURL(/\/favorites$/)
    await page.goto('/login')
    await loginAs(page, USERS.bob)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(1)
    await expect(page.locator('[data-nft-id="nft_004"]')).toHaveCount(1)
  })

  test('visitante: login e volta para /favorites', async ({ page, boot }) => {
    await boot('/favorites')
    await expect(page).toHaveURL(/\/login\?/)
    await page.getByRole('main').getByLabel('E-mail').fill(USERS.alice.email)
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill(USERS.alice.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(items(page)).toHaveCount(3)
  })

  test('erro da listagem e retry', async ({ page, boot, mock }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(3)
    await mock.setScenarios(['network.offline'])
    await page.reload()
    const retry = page.getByRole('button', { name: 'Tentar novamente' }).first()
    await expect(retry).toBeVisible({ timeout: 20_000 })
    await mock.setScenarios([])
    await retry.click()
    await expect(items(page)).toHaveCount(3)
  })

  test('menu e rodapé levam à página real', async ({ page, boot }, info) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Lista de interesse' })).toBeVisible()
    await page.goto('/')
    if (info.project.name === 'mobile') {
      await page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link', { name: 'Favoritos' }).click()
    } else {
      await page.getByRole('button', { name: /Alice/ }).click()
      await page.getByRole('menuitem', { name: 'Lista de interesse' }).click()
    }
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Lista de interesse' })).toBeVisible()
  })
})

test.describe('compra duplicada após timeout', () => {
  test('timeout, outro pedido terminal aberto, reenvio: um único pedido', async ({ page, boot }) => {
    test.setTimeout(90_000)
    await boot('/', ['order.timeout-after-create', 'payment.hold'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const first = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/orders' && r.method() === 'POST')
    await sendOrder(page)
    await first
    await page.goto('/orders/ord_0001')
    await expect.poll(() => page.locator('[data-status]').first().getAttribute('data-status')).not.toBe('pending')
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page).catch(() => undefined)
    await page.waitForURL(/\/orders\/ord_00(0[4-9]|[1-9]\d)/, { timeout: 40_000 })
    const orders = await page.evaluate(async (t) => {
      const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${t}` } })
      return ((await r.json()) as { items: { id: string }[] }).items.filter((o) => o.id > 'ord_0003')
    }, session.token)
    expect(orders).toHaveLength(1)
  })
})

test.describe('geometria e boot', () => {
  test('/favorites sem rolagem horizontal em 768 e 390', async ({ page, boot }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    for (const w of [768, 390]) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto('/favorites')
      await expect(items(page)).toHaveCount(3)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w)
    }
  })

  for (const path of ['/', '/nft/nft_002', '/favorites']) {
    test(`boot frio ${path}: reload duplo e navegação durante o boot`, async ({ browser, baseURL }) => {
      const ctx = await browser.newContext(baseURL ? { baseURL } : {})
      const page = await ctx.newPage()
      const bad: string[] = []
      page.on('response', (r) => {
        if (new URL(r.url()).pathname.startsWith('/api/') && r.status() === 404) bad.push(r.url())
      })
      let navs = 0
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) navs++
      })
      await page.goto(path)
      await page.reload()
      await page.reload()
      await page.waitForFunction(() => !!window.__mock)
      await page.goto('/')
      await page.goto(path, { waitUntil: 'commit' })
      await page.goto('/nft/nft_002', { waitUntil: 'commit' })
      await page.goto(path)
      await page.waitForFunction(() => !!window.__mock)
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByText(/algo deu errado|erro inesperado/i)).toHaveCount(0)
      const n = navs
      await expect.poll(() => navs).toBe(n)
      expect(bad).toEqual([])
      await ctx.close()
    })
  }
})
