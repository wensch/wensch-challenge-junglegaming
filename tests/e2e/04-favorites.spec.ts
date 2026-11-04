/**
 * E2E-04 (FAV-1, INT-8, A11Y-6): favoritos com atualização otimista, persistência, falha de mutation
 * com rollback e recuperação. Alice (seed) já favoritou nft_002, nft_008 e nft_013; nft_003 não.
 */
import { expect, loginViaApi, test, USERS } from '../fixtures'

const heart = (page: import('@playwright/test').Page, mobile: boolean) =>
  mobile ? page.getByRole('button', { name: 'Favoritar Quimera Selvagem' }) : page.getByRole('button', { name: /Favoritar|Favoritado/ })

test.describe('favoritos', () => {
  test('visitante é levado ao login e volta ao NFT', async ({ page, boot }) => {
    await boot('/nft/nft_003')
    await page.getByRole('button', { name: /^Favoritar/ }).first().click()
    await expect(page).toHaveURL(/\/login\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/nft/nft_003')
    expect(url.searchParams.get('reason')).toBe('required')
  })

  test('favoritar é otimista, persiste após refresh e desfavoritar também', async ({ page, boot }, info) => {
    const mobile = info.project.name === 'mobile'
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/nft/nft_003')
    const button = mobile ? page.getByRole('button', { name: /^Favoritar/ }).first() : page.getByRole('button', { name: /^Favorit/ })
    await expect(button).toBeEnabled()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('adicionado aos favoritos')
    await page.reload()
    await expect(heart(page, mobile).first()).toBeEnabled()
    await expect(heart(page, mobile).first()).toHaveAttribute('aria-pressed', 'true')
    await heart(page, mobile).first().click()
    await expect(heart(page, mobile).first()).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(heart(page, mobile).first()).toBeEnabled()
    await expect(heart(page, mobile).first()).toHaveAttribute('aria-pressed', 'false')
  })

  test('falha da mutation desfaz o otimismo, avisa e a nova tentativa funciona', async ({ page, boot, mock }) => {
    await boot('/')
    await loginViaApi(page, USERS.alice)
    await page.goto('/nft/nft_003')
    const button = page.getByRole('button', { name: /^Favorit/ }).first()
    await expect(button).toBeEnabled()
    // Latência lenta alarga a janela em que o estado otimista é visível antes do rollback.
    await mock.setScenarios(['latency.slow', 'favorites.fail'])
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('A alteração foi desfeita')
    // Recuperação: sem o cenário de falha, o mesmo clique persiste.
    await mock.setScenarios(['default'])
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: 'Notificações' })).toContainText('adicionado aos favoritos')
    await page.reload()
    await expect(page.getByRole('button', { name: /^Favorit/ }).first()).toHaveAttribute('aria-pressed', 'true')
  })
})
