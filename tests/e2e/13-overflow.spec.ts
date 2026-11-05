/**
 * E2E-13 — no horizontal overflow on any real screen at 390, 768 and 1440 px (fidelity gate, round 2).
 * Geometric check: `scrollWidth` of the document must not exceed the viewport. The failing node is
 * reported (first element whose right edge passes the viewport) so a regression is easy to locate.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

const WIDTHS = [390, 768, 1440] as const

async function overflowOf(page: Page, width: number): Promise<string | null> {
  return page.evaluate((w) => {
    const doc = document.documentElement
    if (doc.scrollWidth <= w) return null
    const culprit = [...document.body.querySelectorAll('*')].find((el) => el.getBoundingClientRect().right > w + 1)
    return `scrollWidth ${doc.scrollWidth} > ${w}; first culprit: <${culprit?.tagName.toLowerCase()} class="${culprit?.getAttribute('class')}">`
  }, width)
}

async function expectNoOverflow(page: Page, path: string, ready: () => Promise<void>) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    await ready()
    await page.evaluate(() => document.fonts.ready)
    expect(await overflowOf(page, width), `${path} @${width}`).toBeNull()
  }
}

test.describe('sem rolagem horizontal', () => {
  test('telas públicas e da conta em 390, 768 e 1440', async ({ page, boot }) => {
    test.slow()
    await boot('/')
    const main = page.getByRole('main')
    const seen = () => expect(main).toBeVisible()

    await expectNoOverflow(page, '/', async () => {
      await expect(page.getByTestId('nft-card').first()).toBeVisible()
    })
    for (const id of ['nft_001', 'nft_002', 'nft_003']) {
      await expectNoOverflow(page, `/nft/${id}`, async () => {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByTestId('nft-live-updates')).toBeAttached()
      })
    }
    await expectNoOverflow(page, '/login', seen)
    await expectNoOverflow(page, '/register', seen)

    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 2 }])
    await expectNoOverflow(page, '/cart', async () => {
      await expect(page.getByTestId('cart-total')).toBeVisible()
    })
    await expectNoOverflow(page, '/profile', async () => {
      await expect(main.getByLabel('E-mail')).toBeVisible()
    })
    await expectNoOverflow(page, '/wallets', seen)
    await expectNoOverflow(page, '/checkout', async () => {
      await expect(page.getByTestId('checkout-total')).toBeVisible()
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    await page.waitForURL(/\/orders\/ord_/)
    const orderPath = new URL(page.url()).pathname
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expectNoOverflow(page, orderPath, async () => {
      await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    })
  })
})
