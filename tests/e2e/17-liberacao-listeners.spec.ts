/**
 * RT-7 — liberação de listeners. O que o app expõe e usamos (somente leitura):
 *  - `realtime-probe`: `data-connections` (connects do socket atual; volta a 0 no stop), `data-status`,
 *    `data-user`, `data-applied` (eventos aplicados);
 *  - assinantes do QueryCache (a assinatura do reconciler é um deles) e observers ativos, lidos pelo
 *    mesmo fiber de `cacheKeys`;
 *  - efeito observável: evento emitido por `window.__mock.emit` para um usuário que já saiu NÃO é aplicado,
 *    e um único evento válido aumenta `data-applied` em exatamente 1 (sem socket/handler duplicado).
 * Lacuna: o app não expõe a contagem de listeners do socket nem de conexões abertas no servidor simulado.
 */
import type { Page } from '@playwright/test'
import { loginAs, logoutThroughUi } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions, sendOrder } from '../checkout-helpers'

interface Footprint {
  /** Assinantes do QueryCache (inclui a assinatura do reconciler). */
  cacheSubscribers: number
  /** Observers ativos (uma entrada por componente que observa uma query). */
  observers: number
}

async function footprint(page: Page): Promise<Footprint> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Cache = { listeners: Set<unknown>; getAll(): { getObserversCount(): number }[] }
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => Cache } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const cache = f.memoizedProps?.client?.getQueryCache?.()
      if (cache) return { cacheSubscribers: cache.listeners.size, observers: cache.getAll().reduce((n, q) => n + q.getObserversCount(), 0) }
      stack.push(f.child, f.sibling)
    }
    throw new Error('QueryClient not found')
  })
}

const probe = (page: Page) => page.getByTestId('realtime-probe')
const applied = async (page: Page) => parseInt((await probe(page).getAttribute('data-applied')) ?? '0', 10)

const nftEvent = (id: string, version: number) => ({
  id: `evt-rt7-${id}-${version}`,
  type: 'nft.updated',
  resource: { kind: 'nft', id },
  version,
  occurredAt: new Date().toISOString(),
  data: { nftId: id, price: '1.5', compareAtPrice: null, available: 9, soldOut: false, editions: [{ id: `ed_${id.slice(4)}_1`, price: '1.5', available: 9 }] },
})

async function expectConnectedOnce(page: Page, user: string) {
  await expect(probe(page)).toHaveAttribute('data-status', 'connected')
  await expect(probe(page)).toHaveAttribute('data-user', user)
  await expect(probe(page)).toHaveAttribute('data-connections', '1')
}

test.describe('RT-7 liberação de listeners', () => {
  test('10 idas e voltas catálogo/detalhe/carrinho: assinantes e observers voltam ao baseline e há um único socket', async ({ page, boot }) => {
    test.slow()
    await boot('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await expectConnectedOnce(page, 'guest')

    const home = page.locator('a[href="/"]:visible').first()
    const cartLink = page.locator('a[href="/cart"]:visible').first()
    const cycle = async () => {
      await page.getByTestId('nft-card').first().getByRole('link').first().click()
      await expect(page.getByTestId('nft-live-updates')).toBeAttached()
      await cartLink.click()
      await expect(page).toHaveURL(/\/cart$/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await home.click()
      await expect(page.getByTestId('nft-card').first()).toBeVisible()
    }

    await cycle() // aquece (chunks lazy, queries do catálogo)
    const baseline = await footprint(page)
    expect(baseline.cacheSubscribers).toBeGreaterThan(0)
    for (let i = 0; i < 10; i++) await cycle()
    const after = await footprint(page)
    expect(after.cacheSubscribers, 'assinantes do QueryCache').toBe(baseline.cacheSubscribers)
    expect(after.observers, 'observers ativos').toBeLessThanOrEqual(baseline.observers)
    await expectConnectedOnce(page, 'guest')

    // Um único evento válido é aplicado exatamente uma vez (sem handlers/sockets duplicados).
    const before = await applied(page)
    await page.evaluate((e) => window.__mock!.emit('nft.updated', e), nftEvent('nft_003', 5_000))
    await expect.poll(() => applied(page)).toBe(before + 1)
  })

  test('logout e troca de usuário: o footprint volta ao do visitante, um socket por sessão e o usuário anterior não recebe mais eventos', async ({ page, boot }, info) => {
    test.slow()
    const mobile = isMobileProject(info.project.name)
    await boot('/')
    await expectConnectedOnce(page, 'guest')
    const guest = await footprint(page)

    for (const [creds, id, name] of [
      [USERS.alice, 'usr_001', 'Alice Colecionadora'],
      [USERS.bob, 'usr_002', 'Bob'],
    ] as const) {
      await page.goto('/login')
      await loginAs(page, creds)
      await expectConnectedOnce(page, id)
      await logoutThroughUi(page, name, mobile)
      await expectConnectedOnce(page, 'guest')
      await expect(page.getByTestId('nft-card').first()).toBeVisible()
      const out = await footprint(page)
      expect(out.cacheSubscribers, `assinantes após logout de ${id}`).toBe(guest.cacheSubscribers)

      // Evento privado do usuário que saiu: nenhum listener restante o aplica.
      const before = await applied(page)
      await page.evaluate(
        ([uid]) =>
          window.__mock!.emit(
            'order.updated',
            { id: `evt-rt7-priv-${uid}`, type: 'order.updated', resource: { kind: 'order', id: 'ord_0001' }, version: 9_000, userId: uid, occurredAt: new Date().toISOString(), data: { orderId: 'ord_0001', status: 'confirmed' } },
            { userId: uid },
          ),
        [id] as const,
      )
      await expect(probe(page)).toHaveAttribute('data-applied', String(before))
    }
  })

  test('pedido: ao sair da tela do pedido e voltar ao catálogo, assinantes e observers voltam ao baseline', async ({ page, boot }) => {
    test.slow()
    await boot('/', ['payment.hold'])
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const baseline = await footprint(page)

    await page.goto('/checkout')
    await connectWallet(page)
    await sendOrder(page)
    await page.waitForURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const onOrder = await footprint(page)
    expect(onOrder.cacheSubscribers).toBe(baseline.cacheSubscribers)

    await page.locator('a[href="/"]:visible').first().click()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await expect.poll(async () => (await footprint(page)).cacheSubscribers).toBe(baseline.cacheSubscribers)
    await expect.poll(async () => (await footprint(page)).observers).toBeLessThanOrEqual(baseline.observers + 2)
    await expect(probe(page)).toHaveAttribute('data-connections', '1')
  })
})
