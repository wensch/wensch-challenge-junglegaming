/**
 * E2E-22 — mobile (390 px) geometry of cart and checkout against the Figma frames 16:360 / 16:748:
 * pill buttons (radius >= half the height), summary card with side margins, 50 px promo field.
 */
import type { Locator } from '@playwright/test'
import { expect, test } from '../fixtures'
import { loginWithCart, pickEditions } from '../checkout-helpers'

async function expectPill(el: Locator, label: string) {
  const { h, r } = await el.evaluate((n) => {
    const s = getComputedStyle(n)
    const h = n.getBoundingClientRect().height
    // rounded-full computes to a huge value (e.g. 3.35544e+07px): clamp to the height.
    const raw = s.borderTopLeftRadius
    return { h, r: raw.includes('e+') ? h : Math.min(h, Number.parseInt(raw, 10)) }
  })
  expect(r, `${label}: radius ${r} vs height ${h}`).toBeGreaterThanOrEqual(h / 2 - 0.5)
}

test('carrinho e pagamento em 390 px seguem os frames mobile', async ({ page, boot }) => {
  await boot('/')
  await page.setViewportSize({ width: 390, height: 900 })
  const [a] = await pickEditions(page, 1)
  await loginWithCart(page, [{ item: a!, quantity: 1 }])

  await page.goto('/cart')
  await expect(page.getByTestId('cart-total')).toBeVisible()
  const summary = await page.getByTestId('cart-summary').boundingBox()
  expect(summary!.x).toBeGreaterThanOrEqual(16)
  expect(390 - (summary!.x + summary!.width)).toBeGreaterThanOrEqual(16)
  const field = page.getByTestId('coupon').locator('form > div')
  expect((await field.boundingBox())!.height).toBeCloseTo(50, 0)
  await expectPill(field, 'campo de cupom')
  await expectPill(page.getByRole('button', { name: 'Aplicar' }), 'Aplicar')
  await expectPill(page.getByRole('link', { name: 'Conectar e finalizar' }), 'Conectar e finalizar')

  await page.goto('/checkout')
  await expect(page.getByTestId('checkout-total')).toBeVisible()
  await expectPill(page.getByRole('button', { name: 'Confirmar compra' }), 'Confirmar compra')
  await expectPill(page.getByRole('button', { name: 'Conectar carteira' }), 'Conectar carteira')
})
