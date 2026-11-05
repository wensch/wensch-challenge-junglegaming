/**
 * @visual baselines em 768 px (§8) de início, detalhe, carrinho e pagamento. Só no projeto desktop
 * (viewport definido aqui). Dados determinísticos (seed + itens fixos); animações desligadas pelo config.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, test } from '../fixtures'
import { loginWithCart, pickEditions } from '../checkout-helpers'

test.use({ viewport: { width: 768, height: 1024 } })
// eslint-disable-next-line no-empty-pattern -- Playwright exige desestruturação no 1º argumento
test.beforeEach(({}, info) => test.skip(isMobileProject(info.project.name), 'tablet roda no projeto desktop'))

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
    await Promise.all([...document.images].map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener('load', r, { once: true }); setTimeout(r, 1500) }))))
  })
  await page.addStyleTag({ content: 'nav[aria-label="Navegação inferior"] { visibility: hidden !important; }' })
}

test.describe('@visual tablet 768', () => {
  test('início', async ({ page, boot }) => {
    await boot('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Destaques' }).getByRole('img').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio-768.png', { fullPage: true })
  })

  test('detalhe', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(page.getByRole('heading', { level: 1, name: 'Prisma Boreal' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'NFTs da mesma coleção' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe-768.png', { fullPage: true })
  })

  test('carrinho', async ({ page, boot }) => {
    await boot('/')
    const items = await pickEditions(page, 2)
    await loginWithCart(page, items.map((item) => ({ item, quantity: 1 })))
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByTestId('cart-total')).toBeVisible()
    await settle(page)
    await expect(page.getByTestId('cart-lines').locator('xpath=ancestor::section[1]')).toHaveScreenshot('carrinho-768.png', { mask: [page.locator('section[aria-labelledby="related-title"]')] })
  })

  test('pagamento', async ({ page, boot }) => {
    await boot('/')
    const items = await pickEditions(page, 2)
    await loginWithCart(page, items.map((item) => ({ item, quantity: 2 })))
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-total')).toBeVisible()
    await settle(page)
    await expect(page.getByTestId('checkout-form')).toHaveScreenshot('pagamento-768.png')
  })
})
