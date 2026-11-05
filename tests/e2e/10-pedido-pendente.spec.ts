/**
 * E2E-10 — Eventos duplicados/antigos, desconexão e retomada de pedido pendente (RT-2, RT-9, PAG-5, PAG-6).
 * The order is settled ONLY by the simulation (`settleOrder`); replayed/old events go through the real
 * socket (`__mock.emit`) and are observed in the UI and in the hidden realtime probe.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

async function pendingOrder(page: Page, boot: (url?: string, s?: never[]) => Promise<void>) {
  void boot
  const [a] = await pickEditions(page, 1)
  const session = await loginWithCart(page, [{ item: a!, quantity: 1 }])
  await page.goto('/checkout')
  await connectWallet(page)
  await sendOrder(page)
  await page.waitForURL(/\/orders\/ord_/)
  await expect(page.getByTestId('order-pending')).toBeVisible()
  return { session, orderId: new URL(page.url()).pathname.split('/').pop()! }
}

const envelope = (id: string, orderId: string, userId: string, version: number, status: 'pending' | 'confirmed' | 'declined') => ({
  id,
  type: 'order.updated',
  resource: { kind: 'order', id: orderId },
  version,
  userId,
  occurredAt: new Date().toISOString(),
  data: { orderId, status, transaction: null, declineReason: null, updatedAt: new Date().toISOString() },
})

test.describe('pedido pendente', () => {
  test('refresh com o pedido pendente: mesmo pedido, sem nova compra, e o carrinho avisa', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const { orderId, session } = await pendingOrder(page, boot)
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(page.url()).toContain(orderId)

    await page.goto('/cart')
    await expect(page.getByTestId('pending-order-banner')).toContainText('aguardando confirmação')
    await page.getByRole('link', { name: 'Acompanhar pedido' }).click()
    await expect(page.getByTestId('order-pending')).toBeVisible()

    const count = await page.evaluate(async (t) => ((await (await fetch('/api/orders?status=pending', { headers: { Authorization: `Bearer ${t}` } })).json()) as { items: unknown[] }).items.length, session.token)
    expect(count).toBe(1)
    await mock.settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()
  })

  test('pendente -> confirmado: o foco vai para o título do recibo', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const { orderId } = await pendingOrder(page, boot)
    await mock.settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Seus NFTs agora estão na sua carteira' })).toBeFocused()
  })

  test('conexão cai com o pedido pendente: ao reconectar o estado é recuperado do REST', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const { orderId } = await pendingOrder(page, boot)
    const probe = page.getByTestId('realtime-probe')
    await expect(probe).toHaveAttribute('data-status', 'connected')
    const connections = parseInt((await probe.getAttribute('data-connections')) ?? '0', 10)

    // The simulation confirms WHILE the socket is down: the event is lost; REST has the truth.
    await mock.drop()
    await mock.settleOrder(orderId, 'confirmed')
    await expect(probe).toHaveAttribute('data-connections', String(connections + 1), { timeout: 20_000 })
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-pending')).toHaveCount(0)
  })

  test('eventos duplicados e antigos não reaplicam nem regridem o estado terminal', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const { orderId, session } = await pendingOrder(page, boot)
    const probe = page.getByTestId('realtime-probe')

    await mock.settleOrder(orderId, 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()
    const applied = await probe.getAttribute('data-applied')

    // Duplicate of the id already applied, then an old `pending` and a newer-looking `pending` after a terminal state.
    const last = await probe.getAttribute('data-last-event')
    await mock.emit('order.updated', envelope(last!, orderId, session.user.id, 99, 'pending'), { userId: session.user.id })
    await expect(probe).toHaveAttribute('data-last-outcome', 'duplicate')
    await mock.emit('order.updated', envelope('evt-old', orderId, session.user.id, 1, 'pending'), { userId: session.user.id })
    await expect(probe).toHaveAttribute('data-last-event', 'evt-old')
    await mock.emit('order.updated', envelope('evt-late-pending', orderId, session.user.id, 50, 'pending'), { userId: session.user.id })
    await expect(probe).toHaveAttribute('data-last-event', 'evt-late-pending')
    await expect(probe).toHaveAttribute('data-applied', applied!)
    await expect(page.getByTestId('receipt')).toBeVisible()
    await expect(page.getByTestId('order-pending')).toHaveCount(0)
  })

  test('recusado é terminal e permanece após refresh; confirmação só vem da simulação', async ({ page, boot, mock }) => {
    await boot('/', ['payment.hold'])
    const { orderId } = await pendingOrder(page, boot)
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await mock.settleOrder(orderId, 'declined')
    await expect(page.getByTestId('order-declined')).toBeVisible()
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await mock.settleOrder(orderId, 'confirmed') // the simulation refuses to move a terminal order
    await page.reload()
    await expect(page.getByTestId('order-declined')).toBeVisible()
    await expect(page.getByTestId('receipt')).toHaveCount(0)
  })
})
