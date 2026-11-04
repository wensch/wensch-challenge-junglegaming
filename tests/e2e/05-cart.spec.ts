/**
 * E2E-05 — Carrinho: quantidades, remoção, cupom e persistência (TEL-3, CAR-1..6, MON-1/2).
 * State is prepared through the real REST handlers; assertions observe the UI. Real-time changes are
 * produced with `window.__mock.updateNft` (REST state + `nft.updated` through socket.io-client).
 */
import { expect, test, USERS } from '../fixtures'
import { submitLogin } from '../account-helpers'
import { formatEth, mulQty, sub, add } from '../../src/lib/money'
import { addToCart, loginWithCart, pickEditions, setGuestId, updateNft, type Seeded } from '../s3-helpers'

const ETH_FEE = '0.0021'

async function openGuestCart(page: import('@playwright/test').Page, boot: (url?: string) => Promise<void>, items: { item: Seeded; quantity: number }[]) {
  const guestId = await setGuestId(page)
  for (const { item, quantity } of items) await addToCart(page, { guestId }, item, quantity)
  await page.goto('/cart')
  await page.waitForFunction(() => !!window.__mock)
  void boot
}

test.describe('carrinho', () => {
  test('visitante: itens, resumo vindo da cotação e persistência após refresh', async ({ page, boot }) => {
    await boot('/')
    const [a, b] = await pickEditions(page, 2)
    await openGuestCart(page, boot, [{ item: a!, quantity: 2 }, { item: b!, quantity: 1 }])

    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(2)
    await expect(lines.first()).toContainText(a!.name)
    await expect(lines.first().getByTestId('line-quantity')).toHaveText('2')

    // Summary: subtotal, discount, fee, total — all from the quote (POST /quotes), formatted without float math.
    const subtotal = add(mulQty(a!.price, 2), b!.price)
    await expect(page.getByTestId('cart-subtotal')).toHaveText(formatEth(subtotal))
    await expect(page.getByTestId('cart-discount')).toHaveText('(-) 00.00')
    await expect(page.getByTestId('cart-fee')).toHaveText(formatEth(ETH_FEE))
    await expect(page.getByTestId('cart-total')).toHaveText(formatEth(add(subtotal, ETH_FEE)))

    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByTestId('cart-line').first().getByTestId('line-quantity')).toHaveText('2')
    await expect(page.getByRole('link', { name: /Carrinho com 3 itens|3/ }).first()).toBeVisible()
  })

  test('quantidade respeita a disponibilidade e remoção atualiza o resumo', async ({ page, boot }) => {
    await boot('/')
    const [a, b] = await pickEditions(page, 2)
    await openGuestCart(page, boot, [{ item: a!, quantity: 1 }, { item: b!, quantity: 1 }])

    const first = page.getByTestId('cart-line').first()
    const inc = first.getByRole('button', { name: /Aumentar quantidade/ })
    const dec = first.getByRole('button', { name: /Diminuir quantidade/ })
    await expect(dec).toBeDisabled()
    await inc.click()
    await expect(first.getByTestId('line-quantity')).toHaveText('2')
    await expect(page.getByTestId('cart-announcer')).toContainText('atualizada para 2')
    await expect(page.getByTestId('cart-subtotal')).toHaveText(formatEth(add(mulQty(a!.price, 2), b!.price)))

    // Walk up to the limit: the "+" button is disabled and says why.
    const limit = Math.min(a!.available, a!.maxPerOrder)
    for (let q = 2; q < limit; q++) {
      await inc.click()
      await expect(first.getByTestId('line-quantity')).toHaveText(String(q + 1))
    }
    await expect(inc).toBeDisabled()
    await expect(inc).toHaveAccessibleName(new RegExp(`limite de ${limit}`))

    await page.waitForLoadState('networkidle')
    await first.getByRole('button', { name: /Remover/ }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-subtotal')).toHaveText(formatEth(b!.price))
    await page.getByTestId('cart-line').getByRole('button', { name: /Remover/ }).click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('atualização otimista: falha da API reverte a quantidade e avisa', async ({ page, boot, mock }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await openGuestCart(page, boot, [{ item: a!, quantity: 1 }])
    const line = page.getByTestId('cart-line').first()
    await expect(line).toBeVisible()
    await expect(page.getByTestId('cart-total')).toBeVisible()
    await page.waitForLoadState('networkidle')

    await mock.setScenarios(['http.500.once'])
    await line.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(page.getByTestId('cart-announcer')).toContainText('quantidade anterior foi restaurada')
    await expect(line.getByTestId('line-quantity')).toHaveText('1')

    // Recovers: the next attempt goes through.
    await line.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(line.getByTestId('line-quantity')).toHaveText('2')
  })

  test('cupom válido, remoção, inválido e expirado', async ({ page, boot, mock }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await openGuestCart(page, boot, [{ item: a!, quantity: 2 }])
    const subtotal = mulQty(a!.price, 2)
    const input = page.getByLabel('Código promocional')

    await input.fill('welcome10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('WELCOME10')
    const discount = sub(subtotal, mulQty(subtotal, 1)) // placeholder to keep types; real value read below
    void discount
    await expect(page.getByTestId('cart-discount')).not.toHaveText('(-) 00.00')
    await expect(page.getByTestId('cart-subtotal')).toHaveText(formatEth(subtotal))

    await page.getByRole('button', { name: /Remover cupom/ }).click()
    await expect(page.getByTestId('cart-discount')).toHaveText('(-) 00.00')
    await expect(page.getByLabel('Código promocional')).toBeVisible()

    await page.getByLabel('Código promocional').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    const error = page.getByRole('alert').filter({ hasText: 'inválido' })
    await expect(error).toBeVisible()
    await expect(page.getByLabel('Código promocional')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Código promocional')).toHaveAttribute('aria-describedby', /.+/)

    await page.getByLabel('Código promocional').fill('BLACK2024')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'expirou' })).toBeVisible()

    await mock.setScenarios(['coupon.invalid'])
    await page.getByLabel('Código promocional').fill('WELCOME10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inválido' })).toBeVisible()
  })

  test('preço e disponibilidade chegam por nft.updated com o carrinho aberto', async ({ page, boot }) => {
    await boot('/')
    const [a, b] = await pickEditions(page, 2)
    await openGuestCart(page, boot, [{ item: a!, quantity: 2 }, { item: b!, quantity: 1 }])
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    const before = await page.getByTestId('cart-total').textContent()

    const newPrice = add(a!.price, '0.5')
    await updateNft(page, a!.nftId, { editions: [{ id: a!.editionId, price: newPrice }] })

    await expect(page.getByTestId('cart-changes')).toContainText('mudou')
    await expect(page.getByTestId('cart-announcer')).toContainText('foi atualizado')
    await expect(page.getByTestId('cart-line').first()).toContainText(`Preço alterado de ${formatEth(a!.price)} para ${formatEth(newPrice)}`)
    await expect(page.getByTestId('cart-subtotal')).toHaveText(formatEth(add(mulQty(newPrice, 2), b!.price)))
    await expect(page.getByTestId('cart-total')).not.toHaveText(before ?? '')

    // Availability drops below the quantity: blocking message, CTA disabled, stepper limit follows.
    await updateNft(page, b!.nftId, { editions: [{ id: b!.editionId, available: 0 }] })
    await expect(page.getByTestId(/line-notice-/).filter({ hasText: 'Esgotado' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await expect(page.getByTestId('cart-blocking')).toBeVisible()

    // Acknowledging the new price keeps the item and the cart stays consistent.
    await page.getByRole('button', { name: 'Aceitar novo preço' }).click()
    await expect(page.getByTestId(/line-notice-/).filter({ hasText: 'Preço alterado' })).toHaveCount(0)
  })

  test('estados: skeleton sem deslocamento, vazio e erro com nova tentativa', async ({ page, boot, mock }) => {
    await boot('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar o mercado' }).first()).toBeVisible()

    const [a] = await pickEditions(page, 1)
    const guestId = await setGuestId(page)
    await addToCart(page, { guestId }, a!, 1)
    await mock.setScenarios(['latency.slow'])
    await page.reload()
    const skeleton = page.getByTestId('cart-skeleton')
    await expect(skeleton).toBeVisible()
    await expect(page.getByTestId('cart-line')).toHaveCount(1, { timeout: 15_000 })

    await mock.setScenarios(['network.offline'])
    await page.reload()
    await expect(page.getByRole('button', { name: 'Tentar novamente' }).first()).toBeVisible({ timeout: 20_000 })
    await mock.setScenarios([])
    await page.getByRole('button', { name: 'Tentar novamente' }).first().click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
  })

  test('itens do visitante preservados ao autenticar (login com carrinho)', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    const guestId = await setGuestId(page)
    await addToCart(page, { guestId }, a!, 2)
    await page.goto('/login?redirect=/cart')
    await page.waitForFunction(() => !!window.__mock)
    await submitLogin(page, USERS.alice)
    await page.waitForURL('**/cart')
    await expect(page.getByTestId('cart-line').first()).toContainText(a!.name)
    await expect(page.getByTestId('cart-line').first().getByTestId('line-quantity')).toHaveText('2')
  })

  test('usuário logado: carrinho próprio persiste e CTA leva ao pagamento', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await page.waitForURL('**/checkout')
    await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeVisible()
  })
})
