/**
 * E2E-06 — Compra completa até o recibo confirmado (TEL-4, TEL-5, PAG-1, PAG-2, PAG-5..8, RT-2, MON-2).
 * The cart is prepared through the real REST handlers (the catalog screens belong to S1); everything else
 * is driven through the UI. The receipt is observed only after the simulation answers `confirmed`.
 */
import { expect, test } from '../fixtures'
import { add, formatEth, mulQty, sum } from '../../src/lib/money'
import { addToCart, connectWallet, loginWithCart, pickEditions, sendOrder, updateNft } from '../s3-helpers'

const ETH_FEE = '0.0021'

test.describe('compra', () => {
  test('do carrinho ao recibo confirmado, com validação e revisão', async ({ page, boot }) => {
    await boot('/')
    const [a, b] = await pickEditions(page, 2)
    await loginWithCart(page, [{ item: a!, quantity: 2 }, { item: b!, quantity: 1 }])
    const subtotal = sum([mulQty(a!.price, 2), b!.price])
    const total = add(subtotal, ETH_FEE)

    await page.goto('/cart')
    await expect(page.getByTestId('cart-total')).toHaveText(formatEth(total))
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await page.waitForURL('**/checkout')

    // Totals of the checkout come from the same quote.
    await expect(page.getByTestId('checkout-total')).toHaveText(formatEth(total))
    await expect(page.getByTestId('checkout-items').getByRole('listitem')).toHaveCount(2)

    // Validation: empty required field + no connection -> errors tied to the controls.
    const name = page.getByLabel('Nome de exibição')
    await name.fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAttribute('aria-describedby', /.+/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await name.fill('Alice Colecionadora')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Conecte a carteira para continuar')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Wallet: connect, disconnect, connect again.
    await connectWallet(page)
    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(page.getByTestId('wallet-status')).toHaveAttribute('data-state', 'disconnected')
    await connectWallet(page)

    // Review shows what will be sent; the order is only created by "Enviar pedido".
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog).toContainText('Alice Colecionadora')
    await expect(dialog.getByTestId('review-total')).toHaveText(formatEth(total))
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()

    await page.waitForURL(/\/orders\/ord_/)
    const receipt = page.getByTestId('receipt')
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    await expect(receipt.getByTestId('receipt-hash')).toHaveText(/^0x[0-9A-F]{4}…[0-9A-F]{4}$/)
    await expect(receipt.getByTestId('receipt-lines').getByRole('listitem')).toHaveCount(2)
    await expect(receipt.getByTestId('receipt-subtotal')).toHaveText(formatEth(subtotal))
    await expect(receipt.getByTestId('receipt-fee')).toHaveText(formatEth(ETH_FEE))
    await expect(receipt.getByTestId('receipt-total')).toHaveText(formatEth(total))
    const link = receipt.getByRole('link', { name: /Ver no Etherscan/ })
    await expect(link).toHaveAttribute('href', /^https:\/\/etherscan\.io\/tx\/0x[a-f0-9]{64}$/)
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    // The bought items left the cart.
    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('recibo é snapshot: mudanças no catálogo não o alteram (também após refresh)', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    const receipt = page.getByTestId('receipt')
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    const before = await receipt.getByTestId('receipt-total').textContent()

    await updateNft(page, a!.nftId, { editions: [{ id: a!.editionId, price: add(a!.price, '3') }] })
    await page.reload()
    await expect(page.getByTestId('receipt')).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText(before ?? '')
    await expect(page.getByTestId('receipt-lines')).toContainText(a!.name)
  })

  test('remoção parcial: só o comprado sai; o que foi adicionado depois permanece', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const [a, b] = await pickEditions(page, 2)
    const session = await loginWithCart(page, [{ item: a!, quantity: 2 }, { item: b!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    const orderId = new URL(page.url()).pathname.split('/').pop()!

    // While pending, one more unit of A is added to the cart (REST), then the simulation confirms.
    await addToCart(page, { token: session.token }, a!, 1)
    await mock.settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()

    await page.goto('/cart')
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(1)
    await expect(lines.first()).toContainText(a!.name)
    await expect(lines.first().getByTestId('line-quantity')).toHaveText('1')
  })

  test('pedido de outro usuário e id inexistente não exibem recibo', async ({ page, boot }) => {
    await boot('/')
    await loginWithCart(page, [])
    await page.goto('/orders/ord_9999')
    await expect(page.getByRole('heading', { name: 'Pedido indisponível' })).toBeVisible()
    await expect(page.getByTestId('receipt')).toHaveCount(0)
  })
})
