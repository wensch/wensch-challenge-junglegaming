/**
 * QA integrada (rodada 1): fluxo ponta a ponta SOMENTE pela UI (catalogo -> detalhe -> carrinho do visitante ->
 * login -> merge -> cupom -> pagamento -> pendente -> confirmado/recusado -> recibo), troca de usuario com carrinho,
 * reload por etapa. Estado da simulacao so por __mock (settleOrder/emit).
 */
import { expect, test, USERS } from '../fixtures'
import { connectWallet, sendOrder } from '../s3-helpers'
import { submitLogin, logoutThroughUi, loginAs } from '../account-helpers'

test.describe('qa integrada', () => {
  for (const outcome of ['confirmed', 'declined'] as const) {
    test(`UI pura: visitante -> login -> merge -> cupom -> pedido pendente -> ${outcome}`, async ({ page, boot, mock }, info) => {
      const mobile = info.project.name.startsWith('mobile')
      await boot('/', ['payment.hold'])
      await page.goto('/nft/nft_002')
      await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
      await expect(page.getByText(/no carrinho/).first()).toBeVisible()
      await page.reload()
      await page.goto('/cart')
      await expect(page.getByTestId('cart-line')).toHaveCount(1)
      await page.reload()
      await expect(page.getByTestId('cart-line')).toHaveCount(1)

      await page.goto('/login?redirect=/cart')
      await page.waitForFunction(() => !!window.__mock)
      await submitLogin(page, USERS.alice)
      await page.waitForURL('**/cart')
      await expect(page.getByTestId('cart-line').first()).toContainText('Prisma Boreal')
      const subtotal = await page.getByTestId('cart-subtotal').textContent()

      await page.getByLabel('Código promocional').fill('WELCOME10')
      await page.getByRole('button', { name: 'Aplicar' }).click()
      await expect(page.getByTestId('coupon-applied')).toContainText('WELCOME10')
      await page.reload()
      await expect(page.getByTestId('coupon-applied')).toContainText('WELCOME10')
      await expect(page.getByTestId('cart-subtotal')).toHaveText(subtotal!)

      await page.getByRole('link', { name: /finalizar/i }).click()
      await page.waitForURL('**/checkout')
      await page.reload()
      await connectWallet(page)
      await sendOrder(page)
      await page.waitForURL(/\/orders\/ord_/)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      await expect(page.getByTestId('receipt')).toHaveCount(0)
      await page.reload()
      await expect(page.getByTestId('order-pending')).toBeVisible()
      await expect(page.getByTestId('receipt')).toHaveCount(0)
      const orderId = new URL(page.url()).pathname.split('/').pop()!
      await mock.settleOrder(orderId, outcome)
      if (outcome === 'confirmed') {
        await expect(page.getByTestId('receipt')).toBeVisible()
        await page.reload()
        await expect(page.getByTestId('receipt')).toBeVisible()
      } else {
        await expect(page.getByTestId('order-declined')).toBeVisible()
        await expect(page.getByTestId('receipt')).toHaveCount(0)
        await page.goto('/cart')
        await expect(page.getByTestId('cart-line')).toHaveCount(1)
      }
      // Logout: outro usuario nao ve nada de alice.
      await logoutThroughUi(page, 'Alice Colecionadora', mobile)
      await page.goto(`/orders/${orderId}`)
      await expect(page.getByTestId('receipt')).toHaveCount(0)
      await expect(page.getByTestId('order-pending')).toHaveCount(0)
    })
  }

  test('troca de usuario: carrinho de alice nao aparece para bob', async ({ page, boot }, info) => {
    const mobile = info.project.name.startsWith('mobile')
    await boot('/login?redirect=/')
    await page.waitForFunction(() => !!window.__mock)
    await loginAs(page, USERS.alice)
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto('/nft/nft_002')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText(/no carrinho/).first()).toBeVisible()
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await logoutThroughUi(page, 'Alice Colecionadora', mobile)
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(0)
    await page.goto('/login?redirect=/cart')
    await page.waitForFunction(() => !!window.__mock)
    await submitLogin(page, USERS.bob)
    await page.waitForURL('**/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(0)
    const kurio = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k.startsWith('kurio.'))))
    expect(kurio).not.toContain('Prisma Boreal')
    expect(kurio).not.toContain('usr_001')
  })
})
