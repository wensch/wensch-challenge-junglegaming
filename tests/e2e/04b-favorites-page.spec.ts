/**
 * E2E-04b (FAV-1): página "Lista de interesse" (`/favorites`): lista, vazio, remoção otimista com
 * rollback, erro com retry, isolamento entre usuários e atualização de preço por `nft.updated`.
 * Seed: alice favoritou nft_002, nft_008 e nft_013; bob, nft_004.
 */
import { expect, loginViaApi, test, USERS } from '../fixtures'

const favNft = (id: string, version: number, price: string) => ({
  id: `evt-fav-${id}-${version}`,
  type: 'nft.updated',
  resource: { kind: 'nft', id },
  version,
  occurredAt: new Date().toISOString(),
  data: { nftId: id, price, compareAtPrice: null, available: 7, soldOut: false, editions: [{ id: `ed_${id.slice(4)}_1`, price, available: 7 }] },
})

const items = (page: import('@playwright/test').Page) => page.getByTestId('favorite-item')
const removeButtons = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Remover .* da lista de interesse$/ })

test.describe('página Lista de interesse', () => {
  test('lista os favoritos da alice com contagem anunciada', async ({ page, boot }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/favorites')
    await expect(page.getByRole('heading', { level: 1, name: 'Lista de interesse' })).toBeVisible()
    await expect(items(page)).toHaveCount(3)
    await expect(page.getByTestId('favorites-count')).toHaveText('3 NFTs na lista de interesse.')
    await expect(items(page).first().getByRole('link')).toHaveAttribute('href', /\/nft\/nft_/)
  })

  test('visitante é levado ao login', async ({ page, boot }) => {
    await boot('/favorites')
    await expect(page).toHaveURL(/\/login\?/)
  })

  test('isolamento: bob vê só o próprio favorito', async ({ page, boot }) => {
    await boot('/')
    await loginViaApi(page, USERS.bob)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(1)
    await expect(page.locator('[data-nft-id="nft_004"]')).toHaveCount(1)
    await expect(page.locator('[data-nft-id="nft_002"]')).toHaveCount(0)
  })

  test('remover é otimista e persiste; a última remoção mostra o vazio com chamada ao catálogo', async ({ page, boot }) => {
    await boot('/')
    await loginViaApi(page, USERS.bob)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(1)
    await removeButtons(page).click()
    await expect(items(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Sua lista de interesse está vazia' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('removido dos favoritos')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sua lista de interesse está vazia' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/(#mercado)?$/)
  })

  test('falha ao remover desfaz o otimismo e avisa', async ({ page, boot, mock }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(3)
    await mock.setScenarios(['latency.slow', 'favorites.fail'])
    await removeButtons(page).first().click()
    await expect(items(page)).toHaveCount(2)
    await expect(items(page)).toHaveCount(3, { timeout: 10_000 })
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('A alteração foi desfeita')
    await expect(page.getByTestId('favorites-count')).toHaveText('3 NFTs na lista de interesse.')
  })

  test('favicon.ico e robots.txt são servidos como arquivos estáticos (não o HTML do SPA)', async ({ request }) => {
    const icon = await request.get('/favicon.ico')
    expect(icon.ok()).toBe(true)
    expect(icon.headers()['content-type']).not.toContain('text/html')
    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBe(true)
    expect(await robots.text()).toContain('User-agent: *')
  })

  test('nft.updated (pelo socket) atualiza o preço na lista', async ({ page, boot, mock }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/favorites')
    await expect(items(page)).toHaveCount(3)
    await mock.emit('nft.updated', favNft('nft_008', 900, '0.4321'))
    await expect(page.locator('[data-nft-id="nft_008"]').getByTestId('nft-price')).toContainText(/0[.,]4321/)
  })

  test('carregamento lento: skeleton e rodapé estável', async ({ page, boot, mock }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await mock.setScenarios(['latency.slow'])
    await page.goto('/favorites')
    await expect(page.getByTestId('favorites-skeleton')).toBeVisible()
    const footer = page.locator('footer').first()
    const before = await footer.boundingBox()
    await expect(items(page)).toHaveCount(3, { timeout: 20_000 })
    const after = await footer.boundingBox()
    expect(Math.abs(before!.y - after!.y)).toBeLessThan(40)
  })
})
