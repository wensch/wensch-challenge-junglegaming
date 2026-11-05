/**
 * @visual baselines (E2E-14) de Início e Detalhe, desktop (1440) e mobile (390), com dados estáveis
 * (seed determinístico, cenário default). Comparadas ao Figma pelo revisor de fidelidade.
 */
import type { Page } from '@playwright/test'
import { settleFonts } from '../visual'
import { expect, test } from '../fixtures'

async function settle(page: Page, ready: () => Promise<void>) {
  await ready()
  await settleFonts(page)
  // Lazy images below the fold: walk the page once, then wait for every image to finish decoding.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
    // Hidden or horizontally off-screen lazy images may never load: cap the wait per image.
    await Promise.all(
      [...document.images].map((i) =>
        i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener('load', r, { once: true }); setTimeout(r, 1500) }),
      ),
    )
  })
  // Fixed bar and the sonner region would be repeated/overlapping in a full-page capture.
  await page.addStyleTag({ content: 'nav[aria-label="Navegação inferior"] { visibility: hidden !important; }' })
}

test.describe('@visual catálogo', () => {
  test('início', async ({ page, boot }) => {
    await boot('/')
    await settle(page, async () => {
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      await expect(page.getByRole('region', { name: 'Destaques' }).getByRole('img').first()).toBeVisible()
    })
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await settle(page, async () => {
      await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad' })).toBeVisible()
      await expect(page.getByRole('list', { name: 'NFTs da mesma coleção' })).toBeVisible()
    })
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })
})
