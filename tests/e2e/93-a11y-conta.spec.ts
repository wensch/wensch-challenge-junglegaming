/**
 * @a11y axe das telas da conta (login, cadastro, perfil, carteiras), com e sem erros de validação.
 * Falha em violações críticas/sérias.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { loginAs } from '../account-helpers'
import { expect, test, USERS } from '../fixtures'

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }))
}

test.describe('@a11y conta', () => {
  test('login e cadastro', async ({ page, boot }) => {
    await boot('/login?reason=expired&redirect=%2Fwallets')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('main').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('main').getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(await seriousViolations(page)).toEqual([])

    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('main').getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByRole('main').getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
    expect(await seriousViolations(page)).toEqual([])
  })

  test('perfil (com erros de validação) e carteiras', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await expect(page.getByRole('main').getByLabel('Nome de exibição')).toHaveValue('Alice Colecionadora')
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('main').getByLabel('Nome de exibição').fill('')
    await page.getByRole('main').getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('main').getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')
    expect(await seriousViolations(page)).toEqual([])

    await page.goto('/wallets')
    await expect(page.getByRole('form', { name: 'Carteira principal' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Endereço da carteira').fill('0x1')
    await page.getByRole('form', { name: 'Carteira principal' }).getByRole('button', { name: 'Salvar carteira' }).click()
    expect(await seriousViolations(page)).toEqual([])
  })
})
