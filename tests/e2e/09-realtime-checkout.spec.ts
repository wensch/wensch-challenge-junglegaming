/**
 * E2E-09 — Preço/disponibilidade por Socket.IO durante o checkout (RT-8, PAG-3, MON-2).
 * Changes are produced by the simulated server (`window.__mock.updateNft`: REST state + `nft.updated`
 * frame through socket.io-client). The UI must inform, refresh the summary from the new quote and BLOCK
 * confirmation until the user accepts the new values.
 */
import { expect, test } from '../fixtures'
import { add, formatEth, mulQty } from '../../src/lib/money'
import { connectWallet, loginWithCart, pickEditions, updateNft } from '../checkout-helpers'

const ETH_FEE = '0.0021'

test.describe('checkout em tempo real', () => {
  test('preço muda com o checkout aberto: aviso, resumo novo e nova confirmação obrigatória', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 2 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await expect(page.getByTestId('checkout-total')).toHaveText(formatEth(add(mulQty(a!.price, 2), ETH_FEE)))

    const newPrice = add(a!.price, '1')
    await updateNft(page, a!.nftId, { editions: [{ id: a!.editionId, price: newPrice }] })

    await expect(page.getByTestId('checkout-moved')).toBeVisible()
    await expect(page.getByTestId('checkout-total')).toHaveText(formatEth(add(mulQty(newPrice, 2), ETH_FEE)))

    // The review opens, shows the diff and refuses to send the stale values.
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog.getByTestId('stale-changes')).toContainText(`de ${formatEth(a!.price)} para ${formatEth(newPrice)}`)
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()

    await dialog.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(dialog.getByTestId('review-total')).toHaveText(formatEth(add(mulQty(newPrice, 2), ETH_FEE)))
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('receipt-total')).toHaveText(formatEth(add(mulQty(newPrice, 2), ETH_FEE)), { timeout: 15_000 })
  })

  test('edição esgota com o checkout aberto: confirmação bloqueada e mensagem', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const confirm = page.getByRole('button', { name: 'Confirmar compra' })
    await expect(confirm).toBeEnabled()

    await updateNft(page, a!.nftId, { editions: [{ id: a!.editionId, available: 0 }] })
    await expect(confirm).toBeDisabled()
    await expect(page.locator('#checkout-blocked')).toContainText('indisponíveis')
    await expect(confirm).toHaveAttribute('aria-describedby', 'checkout-blocked')
  })

  test('cenário checkout.price-changed: o preço sobe logo após a cotação e a UI pede nova confirmação', async ({ page, boot }) => {
    await boot('/', ['checkout.price-changed'])
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-moved')).toBeVisible({ timeout: 10_000 })
    await connectWallet(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog.getByTestId('stale-changes')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
  })
})
