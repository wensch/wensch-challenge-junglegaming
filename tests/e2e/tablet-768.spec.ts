/**
 * @a11y Tablet 768 px (§8): axe (críticas/sérias = 0) em início, detalhe, carrinho com item, pagamento,
 * login, cadastro, perfil, carteiras e /favorites. Roda só no projeto desktop (viewport definido aqui).
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { loginAs } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'
import { loginWithCart, pickEditions } from '../checkout-helpers'
import { settleAnimations } from '../settle-animations'

test.use({ viewport: { width: 768, height: 1024 } })
// eslint-disable-next-line no-empty-pattern -- Playwright exige desestruturação no 1º argumento
test.beforeEach(({}, info) => test.skip(isMobileProject(info.project.name), 'tablet roda no projeto desktop'))

async function seriousViolations(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }))
}

test.describe('@a11y tablet 768', () => {
  test('início', async ({ page, boot }) => {
    await boot('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Destaques' }).getByRole('img').first()).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('detalhe', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'NFTs da mesma coleção' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('carrinho com item e pagamento', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 2 }])
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-total')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-total')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('login e cadastro', async ({ page, boot }) => {
    await boot('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('perfil, carteiras e lista de interesse', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await expect(page.getByRole('main').getByLabel('Nome de exibição')).toHaveValue('Alice Colecionadora')
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/wallets')
    await expect(page.getByRole('form', { name: 'Carteira principal' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/favorites')
    await expect(page.getByRole('heading', { level: 1, name: 'Lista de interesse' })).toBeVisible()
    await expect(page.getByTestId('favorite-item')).toHaveCount(3)
    expect(await seriousViolations(page)).toEqual([])
  })
})
