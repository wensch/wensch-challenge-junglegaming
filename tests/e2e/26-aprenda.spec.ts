/**
 * Aprenda (`/aprenda` e `/aprenda/$slug`, ARCHITECTURE D45): trilhas, categorias na URL, estados vazio e
 * erro, detalhe do artigo com relacionados, 404 de artigo, menu, foco, a11y e overflow.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, test } from '../fixtures'
import { seriousViolations } from '../axe'

const articles = (page: Page) => page.getByTestId('articles-list').getByTestId('article-card')
const ready = async (page: Page) => {
  await expect(page.getByTestId('tracks-list')).toBeVisible()
  await expect(page.getByTestId('articles-list')).toBeVisible()
  await expect(page.getByTestId('articles-list')).not.toHaveAttribute('aria-busy', 'true')
}
const TRACKS = ['Como funciona a propriedade de NFTs', '10 artistas digitais para acompanhar', 'Raridade, atributos e procedência', 'Como proteger sua carteira']

test.describe('aprenda', () => {
  test('carrega hero, 4 trilhas e todos os artigos com h1 único', async ({ page, boot }) => {
    await boot('/aprenda')
    await ready(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Aprenda' })).toBeVisible()
    const tracks = page.getByTestId('tracks-list').getByTestId('article-card')
    await expect(tracks).toHaveCount(4)
    for (const [i, title] of TRACKS.entries()) await expect(tracks.nth(i)).toContainText(title)
    await expect(tracks.first()).toContainText('Trilha 1')
    await expect(tracks.first()).toContainText('6 min de leitura')
    await expect(articles(page)).toHaveCount(8)
  })

  test('chips de categoria filtram pela URL e voltam com o histórico', async ({ page, boot }) => {
    await boot('/aprenda')
    await ready(page)
    const chips = page.getByRole('navigation', { name: 'Categorias' })
    await expect(chips.getByRole('link', { name: 'Todos' })).toHaveAttribute('aria-current', 'page')
    await chips.getByRole('link', { name: 'Segurança' }).click()
    await expect(page).toHaveURL(/categoria=seguranca/)
    await expect(chips.getByRole('link', { name: 'Segurança' })).toHaveAttribute('aria-current', 'page')
    await expect(articles(page)).toHaveCount(2)
    await expect(articles(page).first()).toContainText('Segurança')
    // As trilhas não mudam com o filtro.
    await expect(page.getByTestId('tracks-list').getByTestId('article-card')).toHaveCount(4)
    await page.goBack()
    await expect(page).not.toHaveURL(/categoria=/)
    await expect(articles(page)).toHaveCount(8)
  })

  test('categoria inválida na URL cai em "Todos" (.catch)', async ({ page, boot }) => {
    await boot('/aprenda?categoria=nao-existe')
    await ready(page)
    await expect(articles(page)).toHaveCount(8)
  })

  test('estado vazio pelo cenário catalog.empty', async ({ page, boot }) => {
    await boot('/aprenda', ['catalog.empty'])
    await expect(page.getByRole('heading', { name: 'Nenhum artigo encontrado' }).first()).toBeVisible()
    await expect(page.getByTestId('article-card')).toHaveCount(0)
  })

  test('erro (http.503) mostra alerta e recupera com "Tentar novamente"', async ({ page, boot, mock }) => {
    test.slow()
    await boot('/aprenda', ['http.503'])
    const alerts = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os artigos' })
    await expect(alerts.first()).toBeVisible({ timeout: 15_000 })
    await mock.setScenarios(['default'])
    await alerts.first().getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('tracks-list')).toBeVisible()
  })

  test('skeleton com latência alta', async ({ page, boot }) => {
    await boot('/aprenda', ['latency.slow'])
    await expect(page.getByTestId('articles-skeleton').first()).toBeVisible()
    await ready(page)
  })

  test('detalhe: subtítulos, parágrafos e artigos relacionados; h1 recebe o foco', async ({ page, boot }) => {
    await boot('/aprenda')
    await ready(page)
    await page.getByTestId('tracks-list').getByRole('link', { name: 'Como proteger sua carteira' }).click()
    await expect(page).toHaveURL(/\/aprenda\/como-proteger-sua-carteira$/)
    const h1 = page.getByRole('heading', { level: 1, name: 'Como proteger sua carteira' })
    await expect(h1).toBeFocused()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const body = page.getByTestId('article')
    expect(await body.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(2)
    const paragraphs = await body.locator('section p').count()
    expect(paragraphs).toBeGreaterThanOrEqual(4)
    expect(paragraphs).toBeLessThanOrEqual(6)
    const related = page.getByRole('list', { name: 'Artigos relacionados' })
    await expect(related.getByTestId('article-card')).toHaveCount(3)
    await expect(related).not.toContainText('Como proteger sua carteira')
    await related.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/aprenda\/[a-z0-9-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await page.getByRole('link', { name: 'Aprenda', exact: true }).first().click()
    await expect(page).toHaveURL(/\/aprenda$/)
  })

  test('artigo inexistente: página 404 honesta', async ({ page, boot }) => {
    await boot('/aprenda/nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Artigo não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver todos os artigos' }).click()
    await expect(page).toHaveURL(/\/aprenda$/)
  })

  test('menu leva a /aprenda e marca o item ativo, inclusive no detalhe', async ({ page, boot }, info) => {
    await boot('/')
    if (isMobileProject(info.project.name)) {
      await page.getByRole('button', { name: 'Abrir menu' }).click()
      await page.getByRole('dialog').getByRole('link', { name: 'Aprenda' }).click()
      await expect(page).toHaveURL(/\/aprenda$/)
      return
    }
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await nav.getByRole('link', { name: 'Aprenda' }).click()
    await expect(page).toHaveURL(/\/aprenda$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Aprenda' })).toBeFocused()
    await expect(nav.getByRole('link', { name: 'Aprenda' })).toHaveAttribute('aria-current', 'page')
    await ready(page)
    await page.getByTestId('tracks-list').getByRole('link').first().click()
    await expect(nav.getByRole('link', { name: 'Aprenda' })).toHaveAttribute('aria-current', 'page')
  })

  test('/em-breve?secao=aprenda continua funcionando (compat)', async ({ page, boot }) => {
    await boot('/em-breve?secao=aprenda')
    await expect(page.getByRole('heading', { level: 1, name: 'Aprenda' })).toBeVisible()
  })

  test('sem rolagem horizontal em 390, 768 e 1440 (lista e detalhe)', async ({ page, boot }) => {
    await boot('/aprenda')
    for (const path of ['/aprenda', '/aprenda/raridade-atributos-e-procedencia']) {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByTestId('article-card').first()).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} @${width}`).toBe(true)
      }
    }
  })

  test('sem console.error nem violação de CSP', async ({ page, boot }) => {
    const bad: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy|Refused/i.test(m.text())) bad.push(m.text())
    })
    await boot('/aprenda')
    await ready(page)
    await page.goto('/aprenda/como-funciona-a-propriedade-de-nfts')
    await expect(page.getByTestId('article')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(bad).toEqual([])
  })
})

test.describe('@a11y aprenda', () => {
  test('sem violações críticas/sérias (lista, categoria, detalhe, vazio)', async ({ page, boot, mock }) => {
    await boot('/aprenda')
    await ready(page)
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/aprenda?categoria=arte')
    await ready(page)
    expect(await seriousViolations(page)).toEqual([])
    await page.goto('/aprenda/como-funciona-a-propriedade-de-nfts')
    await expect(page.getByTestId('article')).toBeVisible()
    await expect(page.getByTestId('article-card').first()).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await mock.setScenarios(['catalog.empty'])
    await page.goto('/aprenda')
    await expect(page.getByRole('heading', { name: 'Nenhum artigo encontrado' }).first()).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
