/**
 * E2E-24 (TEL-12) — estados vazio e de erro das telas novas seguem o padrão visual (bloco dentro da viewport,
 * sem rolagem horizontal, ação primária visível). Medição simples + captura anexada (sem baseline).
 */
import type { Locator, Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../fixtures'

async function expectStateBlock(page: Page, block: Locator, name: string, attach: (n: string, body: Buffer) => Promise<void>) {
  await expect(block).toBeVisible()
  const vw = page.viewportSize()!.width
  const box = (await block.boundingBox())!
  expect(box.x, `${name}: margem esquerda`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${name}: cabe na viewport`).toBeLessThanOrEqual(vw + 1)
  expect(box.height, `${name}: altura`).toBeGreaterThan(60)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${name}: sem rolagem horizontal`).toBeLessThanOrEqual(0)
  await expect(block.getByRole('link').or(block.getByRole('button')).first(), `${name}: ação`).toBeVisible()
  await attach(name, await page.screenshot())
}

test.describe('estados vazio e erro', () => {
  test('carrinho vazio, NFT inexistente, favoritos vazios e catálogo vazio', async ({ page, boot, mock }, info) => {
    const attach = (n: string, body: Buffer) => info.attach(n, { body, contentType: 'image/png' })
    await boot('/')
    await loginViaApi(page, USERS.bob)

    await page.goto('/cart')
    await expectStateBlock(page, page.getByTestId('cart-empty'), 'carrinho vazio', attach)

    await page.goto('/nft/nft_999')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await expectStateBlock(page, page.getByRole('main').locator('section').first(), 'NFT inexistente', attach)

    await page.goto('/favorites')
    await page.getByRole('button', { name: /Remover/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Sua lista de interesse está vazia' })).toBeVisible()
    await expectStateBlock(page, page.getByRole('main').locator('section').first(), 'favoritos vazios', attach)

    await mock.setScenarios(['catalog.empty'])
    await page.goto('/')
    await expect(page.getByText(/Nenhum NFT|nenhum resultado|Limpar filtros/i).first()).toBeVisible()
  })
})
