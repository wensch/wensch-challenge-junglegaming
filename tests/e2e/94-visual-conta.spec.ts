/**
 * @visual baselines das telas da conta (login, cadastro, perfil, carteiras) em 1440 e 390.
 * Comparadas com design/ref pelo revisor de fidelidade; aqui protegem contra regressão.
 */
import type { Page } from '@playwright/test'
import { loginAs } from '../account-helpers'
import { expect, test, USERS } from '../fixtures'

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Sem o rodapé nem a tab bar: o recorte é a área de conteúdo.
  await page.addStyleTag({ content: 'nav[aria-label="Navegação inferior"] { visibility: hidden !important; }' })
}

test.describe('@visual conta', () => {
  test('login', async ({ page, boot }) => {
    await boot('/login')
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('login.png')
  })

  test('cadastro', async ({ page, boot }) => {
    await boot('/register')
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('cadastro.png')
  })

  test('perfil', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await expect(page.getByRole('main').getByLabel('Nome de exibição')).toHaveValue('Alice Colecionadora')
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('perfil.png')
  })

  test('carteiras', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.bob)
    await page.goto('/wallets')
    await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
    await settle(page)
    await expect(page.getByRole('main')).toHaveScreenshot('carteiras.png')
  })
})
