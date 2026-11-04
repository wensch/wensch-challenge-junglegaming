/**
 * E2E-12 (UI-3, CAT-4, DET-1): skeletons com shimmer durante carregamento lento (mesmas caixas do
 * conteúdo, sem CLS, parados sob reduced-motion), feedback de falha e recuperação por nova tentativa.
 */
import { expect, test } from '../fixtures'
import { cards, gridReady } from './catalog-helpers'

test.describe('skeletons e recuperação', () => {
  test('catálogo lento: skeleton com shimmer, mesma geometria do conteúdo e sem CLS', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number }
      w.__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/?scenario=latency.slow')
    await page.waitForFunction(() => !!window.__mock)
    await page.evaluate(() => window.__mock!.setScenarios(['latency.slow']))
    await page.reload()
    const skeleton = page.getByTestId('catalog-skeleton')
    await expect(skeleton).toBeVisible()
    await expect(skeleton).toHaveAttribute('aria-busy', 'true')
    const animation = await skeleton.locator('[data-slot="skeleton"]').first().evaluate((el) => getComputedStyle(el).animationName)
    expect(animation).not.toBe('none')
    const before = await skeleton.locator('li').first().boundingBox()
    await gridReady(page)
    await expect(cards(page)).toHaveCount(9)
    const after = await cards(page).first().locator('xpath=..').boundingBox()
    expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1)
    await page.waitForTimeout(300)
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls).toBeLessThan(0.05)
  })

  test('reduced-motion: o shimmer fica parado', async ({ page, boot }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await boot('/', ['latency.slow'])
    const block = page.getByTestId('catalog-skeleton').locator('[data-slot="skeleton"]').first()
    await expect(block).toBeVisible()
    expect(await block.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('detalhe lento mostra skeleton e depois o conteúdo', async ({ page, boot }) => {
    await boot('/nft/nft_002', ['latency.slow'])
    await expect(page.getByRole('status', { name: 'Carregando detalhes do NFT' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Prisma Boreal' })).toBeVisible({ timeout: 15_000 })
  })

  test('detalhe: falha 5xx mostra erro com retry e recupera', async ({ page, boot, mock }) => {
    await boot('/nft/nft_002', ['http.503'])
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o NFT' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('alert')).toBeVisible()
    await mock.setScenarios(['default'])
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Prisma Boreal' })).toBeVisible()
  })

  test('catálogo: queda de rede mostra erro e a nova tentativa recupera', async ({ page, boot, mock }) => {
    await boot('/', ['network.offline'])
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
    await mock.setScenarios(['default'])
    await page.getByRole('alert').filter({ hasText: 'carregar o catálogo' }).getByRole('button', { name: 'Tentar novamente' }).click()
    await gridReady(page)
  })
})
