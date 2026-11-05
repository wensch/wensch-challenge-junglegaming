/**
 * Criadores (`/criadores`, ARCHITECTURE D45): carrega, busca/ordenação/página na URL, estados vazio e
 * erro, navegação pelo menu, foco no h1, a11y (axe) e ausência de overflow/erros de console.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, test } from '../fixtures'
import { seriousViolations } from '../axe'

const cards = (page: Page) => page.getByTestId('creator-card')
const names = async (page: Page) => (await cards(page).locator('h3 > span.truncate').allTextContents()).map((t) => t.trim())
const ready = async (page: Page) => {
  await expect(page.getByTestId('creators-grid')).toBeVisible()
  await expect(page.getByTestId('creators-grid')).not.toHaveAttribute('aria-busy', 'true')
}

test.describe('criadores', () => {
  test('carrega a grade com h1 único, landmarks e paginação', async ({ page, boot }) => {
    await boot('/criadores')
    await ready(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Criadores' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('search', { name: 'Buscar criadores' })).toBeVisible()
    await expect(cards(page)).toHaveCount(9)
    const first = cards(page).first()
    await expect(first.getByText('@')).toBeVisible()
    await expect(first.getByRole('link', { name: /^Ver coleção/ })).toBeVisible()
    // Mais NFTs primeiro (padrão): a primeira linha tem o criador com 156 NFTs.
    await expect(first).toContainText('Tarsila Nogueira')
    await expect(first.getByText('(criador verificado)')).toBeAttached()
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(cards(page)).toHaveCount(3)
  })

  test('ordena por mais seguidos pela URL e restaura ao voltar', async ({ page, boot }) => {
    await boot('/criadores')
    await ready(page)
    const byNfts = await names(page)
    await page.getByRole('combobox', { name: 'Ordenar criadores por' }).click()
    await page.getByRole('option', { name: 'Mais seguidos' }).click()
    await expect(page).toHaveURL(/ordem=followers/)
    await expect.poll(async () => (await names(page))[0]).toBe('Tarsila Nogueira')
    await expect.poll(async () => (await names(page))[1]).toBe('Luna Prado')
    expect(await names(page)).not.toEqual(byNfts)
    await page.goBack()
    await expect(page).not.toHaveURL(/ordem=/)
    await expect.poll(() => names(page)).toEqual(byNfts)
  })

  test('busca por nome na URL e "Ver coleção" abre o catálogo filtrado', async ({ page, boot }) => {
    await boot('/criadores')
    await ready(page)
    await page.getByRole('searchbox', { name: 'Buscar criadores' }).fill('luna')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page).toHaveURL(/q=luna/)
    await expect(cards(page)).toHaveCount(1)
    await cards(page).first().getByRole('link', { name: 'Ver coleção Aurora Digital' }).click()
    await expect(page).toHaveURL(/\/\?.*q=Aurora/)
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toContainText(/.+/)
  })

  test('URL inválida cai nos padrões (.catch)', async ({ page, boot }) => {
    await boot('/criadores?ordem=xx&page=abc')
    await ready(page)
    await expect(cards(page)).toHaveCount(9)
    await expect(page).not.toHaveURL(/ordem=xx/)
  })

  test('estado vazio: busca sem resultado e cenário catalog.empty', async ({ page, boot, mock }) => {
    await boot('/criadores?q=zzzz')
    await expect(page.getByRole('heading', { name: 'Nenhum criador encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await ready(page)
    await mock.setScenarios(['catalog.empty'])
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Nenhum criador encontrado' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0)
  })

  test('erro (http.503) mostra alerta e recupera com "Tentar novamente"', async ({ page, boot, mock }) => {
    test.slow()
    await boot('/criadores', ['http.503'])
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os criadores' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await mock.setScenarios(['default'])
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await ready(page)
    await expect(cards(page)).toHaveCount(9)
  })

  test('skeleton com latência alta mantém a mesma estrutura', async ({ page, boot }) => {
    await boot('/criadores', ['latency.slow'])
    await expect(page.getByTestId('creators-skeleton')).toBeVisible()
    await expect(page.getByTestId('creators-skeleton').locator('li')).toHaveCount(9)
    await ready(page)
  })

  test('menu leva a /criadores, marca o item ativo e o h1 recebe o foco', async ({ page, boot }, info) => {
    await boot('/')
    if (isMobileProject(info.project.name)) {
      await page.getByRole('button', { name: 'Abrir menu' }).click()
      await page.getByRole('dialog').getByRole('link', { name: 'Criadores' }).click()
    } else {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Criadores' }).click()
    }
    await expect(page).toHaveURL(/\/criadores$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Criadores' })).toBeVisible()
    if (!isMobileProject(info.project.name)) {
      // No mobile o Sheet devolve o foco ao botão do menu ao fechar (D1); no desktop o h1 recebe o foco.
      await expect(page.getByRole('heading', { level: 1, name: 'Criadores' })).toBeFocused()
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Criadores' })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('sem rolagem horizontal em 390, 768 e 1440', async ({ page, boot }) => {
    await boot('/criadores')
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await ready(page)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `@${width}`).toBe(true)
    }
  })

  test('sem console.error nem violação de CSP', async ({ page, boot }) => {
    const bad: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy|Refused/i.test(m.text())) bad.push(m.text())
    })
    await boot('/criadores')
    await ready(page)
    await page.waitForLoadState('networkidle')
    expect(bad).toEqual([])
  })
})

test.describe('@a11y criadores', () => {
  test('sem violações críticas/sérias (lista, vazio e erro)', async ({ page, boot, mock }) => {
    await boot('/criadores')
    await ready(page)
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(cards(page)).toHaveCount(3)
    expect(await seriousViolations(page)).toEqual([])
    await mock.setScenarios(['catalog.empty'])
    await page.goto('/criadores')
    await expect(page.getByRole('heading', { name: 'Nenhum criador encontrado' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
