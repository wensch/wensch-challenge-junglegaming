/**
 * E2E-07 — Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido
 * (PAG-2, PAG-3, PAG-4, PAG-5, PAG-7). POST /orders is observed on the wire (request headers) and the
 * outcome in the UI; the orders list is read through the REST handler to prove "one order only".
 */
import type { Page, Request } from '@playwright/test'
import { expect, test } from '../fixtures'
import { loginWithCart, pickEditions, connectWallet, sendOrder, updateNft } from '../s3-helpers'

function trackOrderPosts(page: Page) {
  const posts: Request[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/orders' && r.method() === 'POST') posts.push(r)
  })
  return posts
}

const ordersOf = (page: Page, token: string) =>
  page.evaluate(async (t) => {
    const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${t}` } })
    return ((await r.json()) as { items: { id: string; status: string }[] }).items.filter((o) => o.id > 'ord_0003')
  }, token)

test.describe('pagamento: falhas e recuperação', () => {
  test('pagamento recusado: itens preservados, nova tentativa cria novo pedido', async ({ page, boot }) => {
    await boot('/', ['payment.declined'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)

    const declined = page.getByTestId('order-declined')
    await expect(declined).toBeVisible({ timeout: 15_000 })
    await expect(declined).toContainText('Pagamento recusado')
    await expect(page.getByTestId('receipt')).toHaveCount(0)

    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)

    // Retry is a NEW purchase (new Idempotency-Key): a second declined order, never the first one again.
    const posts = trackOrderPosts(page)
    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    expect(posts).toHaveLength(1)
    expect(await ordersOf(page, session.token)).toHaveLength(2)
  })

  test('carteira recusa a conexão e depois conecta; desconectar bloqueia o envio', async ({ page, boot, mock }) => {
    await boot('/', ['wallet.reject'])
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    await expect(page.getByTestId('wallet-rejected')).toContainText('recusada')
    await expect(page.getByTestId('wallet-status')).toHaveAttribute('data-state', 'disconnected')

    await mock.setScenarios([])
    await connectWallet(page)
    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(page.getByTestId('wallet-status')).toHaveAttribute('data-state', 'disconnected')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Conecte a carteira para continuar').first()).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('clique repetido: um único POST e um único pedido', async ({ page, boot }) => {
    await boot('/', ['payment.hold', 'latency.slow'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const posts = trackOrderPosts(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const send = page.getByRole('dialog', { name: 'Revisar pedido' }).getByRole('button', { name: 'Enviar pedido' })
    await expect(send).toBeEnabled({ timeout: 15_000 })
    await send.dblclick()
    await send.click({ force: true, noWaitAfter: true, timeout: 2_000 }).catch(() => undefined)

    await page.waitForURL(/\/orders\/ord_/, { timeout: 20_000 })
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(await ordersOf(page, session.token)).toHaveLength(1)
  })

  test('timeout após criação: o reenvio usa a mesma chave e devolve o mesmo pedido', async ({ page, boot }) => {
    test.setTimeout(75_000)
    await boot('/', ['order.timeout-after-create', 'payment.hold'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const posts = trackOrderPosts(page)
    await sendOrder(page)
    await expect(page.getByRole('dialog').getByText('Enviando pedido')).toBeVisible()

    await page.waitForURL(/\/orders\/ord_/, { timeout: 40_000 })
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(posts.length).toBeGreaterThanOrEqual(2)
    const keys = new Set(posts.map((p) => p.headers()['idempotency-key']))
    expect(keys.size).toBe(1)
    const orders = await ordersOf(page, session.token)
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0]!.id)
  })

  test('abrir um pedido terminal antigo não perde a chave: o reenvio devolve o mesmo pedido', async ({ page, boot }) => {
    await boot('/', ['payment.hold'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const posts = trackOrderPosts(page)
    await sendOrder(page)
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const pendingId = new URL(page.url()).pathname.split('/').pop()!

    // Another, already terminal order is opened: it must not discard the attempt of the pending one.
    const old = await page.evaluate(async (t) => {
      const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${t}` } })
      return ((await r.json()) as { items: { id: string; status: string }[] }).items.find((o) => o.status !== 'pending')?.id
    }, session.token)
    expect(old).toBeTruthy()
    await page.goto(`/orders/${old}`)
    await expect(page.getByTestId('order-skeleton')).toHaveCount(0)
    await expect.poll(() => page.locator('[data-status]').first().getAttribute('data-status')).not.toBe('pending')

    // The stored attempt survived (same key, bound to the pending order); resending the first request with
    // it returns the SAME order and creates no second one.
    const stored = await page.evaluate((id) => sessionStorage.getItem(`kurio.u.${id}.attempt`), session.user.id)
    expect(stored).not.toBeNull()
    const attempt = JSON.parse(stored!) as { key: string; orderId: string }
    expect(attempt.key).toBe(posts[0]!.headers()['idempotency-key'])
    expect(attempt.orderId).toBe(pendingId)
    const replay = await page.evaluate(
      async ([token, key, body]) => {
        const r = await fetch('/api/orders', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key!, 'Content-Type': 'application/json' }, body })
        return { status: r.status, id: ((await r.json()) as { id: string }).id }
      },
      [session.token, attempt.key, posts[0]!.postData()] as const,
    )
    expect(replay.id).toBe(pendingId)
    expect(await ordersOf(page, session.token)).toHaveLength(1)
  })

  test('cotação mudou com a revisão aberta: 409 QUOTE_STALE mostra o diff e exige nova confirmação', async ({ page, boot, mock }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()

    // The socket is down when the price moves: the client only learns it from the server's 409.
    await mock.drop()
    await updateNft(page, a!.nftId, { editions: [{ id: a!.editionId, price: '9.5' }] })
    const stale = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    expect((await stale).status()).toBe(409)

    await expect(dialog.getByTestId('stale-changes')).toContainText('o preço mudou')
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-lines')).toContainText('9.5')
  })

  test('sessão expira no envio: o checkout é retomado após o login com o mesmo rascunho', async ({ page, boot }) => {
    await boot('/', ['session.expire-on-checkout'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await page.getByLabel('Observação do colecionador (opcional)').fill('retomar depois')
    await connectWallet(page)
    const posts = trackOrderPosts(page)
    await sendOrder(page)
    await page.waitForURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.searchParams.get('redirect')).toBe('/checkout')
    expect(posts).toHaveLength(1)
    expect(await page.evaluate((id) => sessionStorage.getItem(`kurio.u.${id}.checkout`), session.user.id)).toContain('retomar depois')
  })
})
