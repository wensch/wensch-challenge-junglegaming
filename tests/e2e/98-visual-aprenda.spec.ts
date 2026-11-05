/**
 * @visual baselines de /aprenda e /aprenda/$slug (sem quadro no Figma, ARCHITECTURE D45) em 1440 e 390:
 * hub, hub filtrado, artigo e artigo inexistente.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { settleFonts } from '../visual'

async function settle(page: Page) {
  await settleFonts(page, 'nav[aria-label="Navegação inferior"]')
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('main img')] as HTMLImageElement[]
    imgs.forEach((i) => (i.loading = 'eager'))
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)))
  })
}

test.describe('@visual aprenda', () => {
  test('hub', async ({ page, boot }) => {
    await boot('/aprenda')
    await expect(page.getByTestId('articles-list')).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('aprenda-hub.png')
  })

  test('hub filtrado por categoria', async ({ page, boot }) => {
    await boot('/aprenda?categoria=seguranca')
    await expect(page.getByTestId('articles-list')).toBeVisible()
    await expect(page.getByTestId('articles-list').getByTestId('article-card')).toHaveCount(2)
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('aprenda-filtrado.png')
  })

  test('artigo', async ({ page, boot }) => {
    await boot('/aprenda/como-proteger-sua-carteira')
    await expect(page.getByTestId('article')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Artigos relacionados' })).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('aprenda-artigo.png')
  })

  test('artigo inexistente', async ({ page, boot }) => {
    await boot('/aprenda/nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Artigo não encontrado' })).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('aprenda-404.png')
  })
})
