/**
 * E2E-07 (§5/§9.7) pela interface: 409 IDEMPOTENCY_CONFLICT. Nenhum cenário o provoca, então o estado é
 * montado só com o que o navegador já tem: depois de um pedido real (payment.hold), a chave desse pedido é
 * regravada no `sessionStorage` (`kurio.u.<id>.attempt`) com a impressão digital do corpo ALTERADO (nota
 * nova). O app reenvia a mesma chave com outro corpo, o servidor simulado responde 409 com o `orderId` e a
 * interface deve levar ao pedido original, sem criar um segundo.
 */
import type { Page, Request } from '@playwright/test'
import { expect, test } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

interface OrderBody {
  quoteId: string
  quoteVersion: number
  walletId: string
  connectionId: string
  network: string
  collector: Record<string, string | undefined>
}

const ordersOf = (page: Page, token: string) =>
  page.evaluate(async (t) => {
    const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${t}` } })
    return ((await r.json()) as { items: { id: string; status: string }[] }).items.filter((o) => o.id > 'ord_0003')
  }, token)

test.describe('pagamento: conflito de idempotência', () => {
  test('mesma chave com outro corpo (409): o app abre o pedido original e não cria outro', async ({ page, boot }) => {
    await boot('/', ['payment.hold'])
    const [a] = await pickEditions(page, 1)
    const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)

    const posts: Request[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/orders' && r.method() === 'POST') posts.push(r)
    })
    await sendOrder(page)
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const firstId = new URL(page.url()).pathname.split('/').pop()!
    const firstBody = JSON.parse(posts[0]!.postData()!) as OrderBody
    const firstKey = posts[0]!.headers()['idempotency-key']!

    // Back to the payment page with the cart intact (payment.hold): a different note makes it a different body.
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByLabel('Observação do colecionador (opcional)').fill('Nota diferente do primeiro envio')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()

    // Attempt record = the first order's key bound to the fingerprint of THIS body (same canonical form as the app).
    const stored = await page.evaluate(
      async ([token, userId, key, body]) => {
        const q = await fetch('/api/quotes', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ network: body.network }) })
        const quote = (await q.json()) as { id: string; version: number }
        const c = body.collector
        const canonical = JSON.stringify([
          quote.id,
          quote.version,
          body.walletId,
          body.connectionId,
          body.network,
          [c.displayName, c.username, c.profileName, c.email, c.ensName, c.referralCode, 'Nota diferente do primeiro envio'],
        ])
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
        const fingerprint = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
        sessionStorage.setItem(`kurio.u.${userId}.attempt`, JSON.stringify({ fingerprint, key }))
        return fingerprint
      },
      [session.token, session.user.id, firstKey, firstBody] as const,
    )
    expect(stored).toMatch(/^[a-f0-9]{64}$/)

    const conflict = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    const response = await conflict
    expect(response.status()).toBe(409)
    expect(response.request().headers()['idempotency-key']).toBe(firstKey)
    expect(((await response.json()) as { error: { code: string; orderId: string } }).error).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', orderId: firstId })

    await expect(page).toHaveURL(new RegExp(`/orders/${firstId}$`))
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await ordersOf(page, session.token)).toHaveLength(1)
  })
})
