/** @a11y axe do carrinho, pagamento (com erros e revisão aberta) e pedido (pendente, confirmado, recusado). */
import { expect, test } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder, setGuestId, addToCart } from '../checkout-helpers'
import { seriousViolations } from '../axe'

test.describe('@a11y checkout', () => {
  test('carrinho: vazio, com itens, cupom inválido', async ({ page, boot }) => {
    await boot('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    const [a] = await pickEditions(page, 1)
    await addToCart(page, { guestId: await setGuestId(page) }, a!, 2)
    await page.reload()
    await expect(page.getByTestId('cart-total')).toBeVisible()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    expect(await seriousViolations(page)).toEqual([])
    await page.getByLabel('Código promocional').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inválido' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('pagamento: erros de validação e revisão', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-total')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByLabel('Nome de exibição').fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')
    expect(await seriousViolations(page)).toEqual([])
    await page.getByLabel('Nome de exibição').fill('Alice Colecionadora')
    await connectWallet(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog', { name: 'Revisar pedido' })).toBeVisible()
    // The send button starts disabled while the quote is revalidated and fades to full opacity when it
    // enables (transition-all). Wait for the STATE first, so axe never measures that 0.5 -> 1 transition.
    await expect(page.getByTestId('send-order')).toBeEnabled()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('pedido: pendente, confirmado e recusado', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    const id = new URL(page.url()).pathname.split('/').pop()!
    await mock.settleOrder(id, 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
