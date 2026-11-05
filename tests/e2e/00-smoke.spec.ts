/**
 * Shell smoke: routing, guards, 404, layout landmarks and the real Socket.IO
 * pipeline (MSW binding -> socket.io-client -> reconciler). Events are emitted server-side through
 * `window.__mock.emit`; the test only observes the hidden realtime probe rendered by the app.
 */
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

const nftEvent = (id: string, version: number, price = '1.25') => ({
  id,
  type: 'nft.updated',
  resource: { kind: 'nft', id: 'nft_004' },
  version,
  occurredAt: new Date().toISOString(),
  data: { nftId: 'nft_004', price, compareAtPrice: null, available: 10, soldOut: false, editions: [{ id: 'ed_004_1', price, available: 10 }] },
})

test.describe('shell', () => {
  test('home carrega com layout, título e landmarks', async ({ page, boot }, info) => {
    await boot('/')
    await expect(page).toHaveTitle(/KURIO/)
    await expect(page.getByRole('heading', { level: 1, name: /SEJA DONO/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Destaques' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toContainText('© 2026 Kurio')
    if (isMobileProject(info.project.name)) {
      const tabbar = page.getByRole('navigation', { name: 'Navegação inferior' })
      await expect(tabbar).toBeVisible()
      await expect(tabbar.getByRole('link', { name: 'Início' })).toHaveAttribute('data-status', 'active')
    } else {
      const nav = page.getByRole('navigation', { name: 'Principal' })
      await expect(nav.getByRole('link', { name: 'Início' })).toHaveAttribute('data-status', 'active')
      await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    }
  })

  test('deep link e refresh preservam rota e search params', async ({ page, boot }) => {
    await boot('/nft/nft_004?edition=ed_004_1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/\/nft\/nft_004\?edition=ed_004_1$/)

    // Invalid catalog params fall back to defaults instead of breaking the page.
    await page.goto('/?page=abc&sort=hack&tab=nope')
    await expect(page.getByRole('heading', { level: 1, name: /SEJA DONO/ })).toBeVisible()

    // Client-side navigation from the footer keeps the filter in the URL and survives refresh.
    await page.getByRole('contentinfo').getByRole('link', { name: 'Fotografia' }).click()
    await expect(page).toHaveURL(/categories=/)
    await page.reload()
    await expect(page).toHaveURL(/categories=/)
    await expect(page.getByRole('heading', { level: 1, name: /SEJA DONO/ })).toBeVisible()
  })

  test('404 para rota inexistente e id malformado', async ({ page, boot }) => {
    await boot('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    await page.goto('/nft/%3Cscript%3E')
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('rota privada redireciona para login com redirect seguro', async ({ page, boot }) => {
    await boot('/wallets?x=1')
    await expect(page).toHaveURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/wallets?x=1')
    expect(url.searchParams.get('reason')).toBe('required')
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()

    // Open redirect attempts are dropped by safeRedirectSchema (page still renders).
    await page.goto('/login?redirect=%2F%2Fevil.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
  })

  test('com sessão a rota privada abre e o socket reconecta como usuário', async ({ page, boot }, info) => {
    await boot('/')
    const session = await loginViaApi(page, USERS.alice)
    const probe = page.getByTestId('realtime-probe')
    await expect(probe).toHaveAttribute('data-user', session.user.id)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()
    if (!isMobileProject(info.project.name)) {
      await expect(page.getByRole('button', { name: new RegExp(session.user.displayName) })).toBeVisible()
    }
  })
})

test.describe('tempo real', () => {
  test('socket.io-client conecta, aplica, deduplica, ignora versão antiga e reconecta', async ({ page, boot, mock }) => {
    await boot('/')
    const probe = page.getByTestId('realtime-probe')
    await expect(probe).toHaveAttribute('data-status', 'connected')
    await expect(probe).toHaveAttribute('data-user', 'guest')

    await mock.emit('nft.updated', nftEvent('evt-smoke-1', 900))
    await expect(probe).toHaveAttribute('data-last-event', 'evt-smoke-1')
    await expect(probe).toHaveAttribute('data-last-outcome', 'applied')
    await expect(probe).toHaveAttribute('data-applied', '1')

    // Same id again: deduplicated, no second application.
    await mock.emit('nft.updated', nftEvent('evt-smoke-1', 900))
    await expect(probe).toHaveAttribute('data-last-outcome', 'duplicate')
    await expect(probe).toHaveAttribute('data-applied', '1')

    // Older version of the same resource: ignored.
    await mock.emit('nft.updated', nftEvent('evt-smoke-2', 899))
    await expect(probe).toHaveAttribute('data-last-event', 'evt-smoke-2')
    await expect(probe).toHaveAttribute('data-last-outcome', 'stale')

    // Payload outside the contract: dropped without breaking the UI.
    await mock.emit('nft.updated', { id: 'evt-bad', version: 'x' })
    await expect(probe).toHaveAttribute('data-last-outcome', 'invalid')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Server-side drop: the client reconnects by itself (second connection).
    await mock.drop()
    await expect(probe).toHaveAttribute('data-connections', '2', { timeout: 15_000 })
    await expect(probe).toHaveAttribute('data-status', 'connected')
  })

  test('order.updated de outro usuário é descartado', async ({ page, boot, mock }) => {
    await boot('/')
    const probe = page.getByTestId('realtime-probe')
    await expect(probe).toHaveAttribute('data-status', 'connected')
    await mock.emit('order.updated', {
      id: 'evt-foreign',
      type: 'order.updated',
      resource: { kind: 'order', id: 'ord_x' },
      version: 2,
      userId: 'usr_someone',
      occurredAt: new Date().toISOString(),
      data: { orderId: 'ord_x', status: 'confirmed', transaction: null, declineReason: null, updatedAt: new Date().toISOString() },
    })
    // Raw broadcast (no target) reaches the visitor socket: the client must refuse it (defense in depth).
    await expect(probe).toHaveAttribute('data-last-event', 'evt-foreign')
    await expect(probe).toHaveAttribute('data-last-outcome', 'foreign')
    await expect(probe).toHaveAttribute('data-applied', '0')
  })
})

test.describe('menu mobile', () => {
  test('abre, navega por teclado, fecha com Esc e devolve o foco', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'menu mobile só existe abaixo de md')
    await boot('/')
    const trigger = page.getByRole('button', { name: 'Abrir menu' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'KURIO' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.click()
    await dialog.getByRole('link', { name: /Criadores/ }).click()
    await expect(page).toHaveURL(/\/criadores$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Criadores' })).toBeVisible()
  })
})
