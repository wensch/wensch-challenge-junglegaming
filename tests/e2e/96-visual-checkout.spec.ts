/**
 * @visual baselines of the cart and the payment page (desktop 1440 and mobile 390). Data is deterministic
 * (seed + fixed items); the fidelity reviewer compares them with design/ref.
 */
import type { Page } from '@playwright/test'
import { settleFonts } from '../visual'
import { expect, test } from '../fixtures'
import { addToCart, loginWithCart, pickEditions } from '../checkout-helpers'

async function settle(page: Page) {
  await settleFonts(page, 'nav[aria-label="Navegação inferior"], [data-testid="related"], section[aria-labelledby="related-title"]')
}

test.describe('@visual checkout', () => {
  test('carrinho', async ({ page, boot }) => {
    await boot('/')
    const items = await pickEditions(page, 3)
    const session = await loginWithCart(page, [])
    for (const [i, item] of items.entries()) await addToCart(page, { token: session.token }, item, i + 1)
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(3)
    await expect(page.getByTestId('cart-total')).toBeVisible()
    await settle(page)
    await expect(page.getByTestId('cart-lines').locator('xpath=ancestor::section[1]')).toHaveScreenshot('cart.png', { mask: [page.locator('section[aria-labelledby="related-title"]')] })
  })

  test('pagamento', async ({ page, boot }) => {
    await boot('/')
    const items = await pickEditions(page, 2)
    await loginWithCart(page, items.map((item) => ({ item, quantity: 2 })))
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-total')).toBeVisible()
    await settle(page)
    await expect(page.getByTestId('checkout-form')).toHaveScreenshot('checkout.png')
  })
})
