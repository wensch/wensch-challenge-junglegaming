/**
 * E2E-23 — geometria contra o Figma em 1440 px (detalhe: Product Images 128/2/444, imagem 404).
 * Medições com boundingBox; tolerância de 2 px.
 */
import { expect, test } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

test.describe('geometria desktop (1440)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, 'só desktop')

  test('detalhe: miniaturas 100 px, painel principal 444 px e imagem 404 px', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const thumbs = page.getByRole('list', { name: /Imagens de/ }).getByRole('button')
    const t0 = (await thumbs.first().boundingBox())!
    const main = page.getByTestId('gallery-main')
    const panel = (await main.boundingBox())!
    const img = (await main.locator('img').boundingBox())!
    expect(Math.abs(t0.width - 100)).toBeLessThanOrEqual(2)
    expect(Math.abs(panel.width - 444), `painel ${panel.width}`).toBeLessThanOrEqual(2)
    expect(Math.abs(panel.height - 444), `painel ${panel.height}`).toBeLessThanOrEqual(2)
    expect(Math.abs(img.width - 404), `imagem ${img.width}`).toBeLessThanOrEqual(2)
    expect(Math.abs(panel.x - t0.x - 128)).toBeLessThanOrEqual(2)
  })
})

test('confirmação: painel, cabeçalho, meta e faixa final contra o Figma', async ({ page, boot }, info) => {
  const desktop = info.project.name === 'desktop'
  await boot('/')
  const [a, b] = await pickEditions(page, 2)
  await loginWithCart(page, [{ item: a!, quantity: 2 }, { item: b!, quantity: 1 }])
  await page.goto('/checkout')
  await connectWallet(page)
  await sendOrder(page)
  const receipt = page.getByTestId('receipt')
  await expect(receipt).toBeVisible({ timeout: 15_000 })
  const box = (await receipt.boundingBox())!
  const head = (await receipt.locator('header').boundingBox())!
  const meta = (await receipt.locator('dl').first().boundingBox())!
  const bar = (await receipt.locator('div[aria-hidden="true"]').last().boundingBox())!
  const vw = page.viewportSize()!.width
  const h1 = await receipt.getByRole('heading', { level: 1 }).evaluate((n) => ({ fs: getComputedStyle(n).fontSize, fw: getComputedStyle(n).fontWeight }))
  console.log('RECEIPT', JSON.stringify({ vw, box, head, meta, bar, h1 }))
  if (desktop) {
    expect(Math.abs(box.width - 578)).toBeLessThanOrEqual(2)
    expect(Math.abs(head.height - 156), `cabeçalho ${head.height}`).toBeLessThanOrEqual(2)
    expect(Math.abs(meta.height - 65), `meta ${meta.height}`).toBeLessThanOrEqual(3)
    expect(Math.abs(bar.height - 10)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - 821), `painel ${box.height}`).toBeLessThanOrEqual(25)
    expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThanOrEqual(2)
  } else {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vw)
    expect(Math.abs(bar.height - 10)).toBeLessThanOrEqual(1)
  }
})
