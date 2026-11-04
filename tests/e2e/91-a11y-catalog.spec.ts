/** @a11y axe nas telas do catálogo e do detalhe, incluindo estados (vazio, 404, filtros abertos). */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, isMobileProject, test } from '../fixtures'
import { gridReady } from './catalog-helpers'

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }))
}

test.describe('@a11y catálogo e detalhe', () => {
  test('início', async ({ page, boot }) => {
    await boot('/')
    await gridReady(page)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('início vazio', async ({ page, boot }) => {
    await boot('/', ['catalog.empty'])
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('filtros abertos (mobile)', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'sheet de filtros só existe abaixo de lg')
    await boot('/')
    await gridReady(page)
    await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('detalhe', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(page.getByRole('heading', { level: 1, name: 'Prisma Boreal' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'NFTs da mesma coleção' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('detalhe esgotado e inexistente', async ({ page, boot }) => {
    await boot('/nft/nft_005')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/nft/nft_999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
