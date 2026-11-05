/**
 * @visual baselines de /criadores (sem quadro no Figma, ARCHITECTURE D45) em 1440 e 390:
 * lista, estado vazio e esqueleto. Protegem contra regressão; não são comparadas ao Figma.
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

test.describe('@visual criadores', () => {
  test('lista', async ({ page, boot }) => {
    await boot('/criadores')
    await expect(page.getByTestId('creators-grid')).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('criadores-lista.png')
  })

  test('estado vazio', async ({ page, boot }) => {
    await boot('/criadores?q=zzzz')
    await expect(page.getByRole('heading', { name: 'Nenhum criador encontrado' })).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('criadores-vazio.png')
  })

  test('esqueleto', async ({ page, boot }) => {
    await boot('/criadores', ['latency.slow'])
    await expect(page.getByTestId('creators-skeleton')).toBeVisible()
    await settle(page)
    // O brilho do esqueleto é desligado em `animations: disabled`; o bloco fica estático.
    await expect(page.getByRole('main')).toHaveScreenshot('criadores-esqueleto.png')
  })
})
