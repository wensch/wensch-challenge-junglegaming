/**
 * A11Y-2 / E2E-11 — foco em diálogos e drawers: revisão do pagamento, Sheet do menu mobile e menu da
 * conta (foco entra, fica preso, Esc fecha e devolve o foco ao gatilho) + validação por teclado do
 * formulário do colecionador (foco no primeiro campo inválido, erros associados).
 */
import type { Locator, Page } from '@playwright/test'
import { loginAs } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'
import { connectWallet, loginWithCart, pickEditions } from '../s3-helpers'

/** True while the focused element is inside `container`. */
const focusInside = (container: Locator) => container.evaluate((el) => el.contains(document.activeElement))

async function expectTrapped(page: Page, container: Locator, key: 'Tab' | 'Shift+Tab', presses = 12) {
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(key)
    await expect.poll(() => focusInside(container), { message: `${key} #${i + 1} escapou do contêiner` }).toBe(true)
  }
}

test.describe('foco em diálogos', () => {
  async function openReview(page: Page, boot: (url?: string) => Promise<void>) {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await connectWallet(page)
    const trigger = page.getByRole('button', { name: 'Confirmar compra' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog).toBeVisible()
    return { trigger, dialog }
  }

  test('revisão do pagamento: foco dentro, Tab/Shift+Tab presos e Esc fecha', async ({ page, boot }) => {
    const { dialog } = await openReview(page, boot)
    await expect.poll(() => focusInside(dialog)).toBe(true)
    await expectTrapped(page, dialog, 'Tab')
    await expectTrapped(page, dialog, 'Shift+Tab')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('revisão do pagamento: Esc devolve o foco a "Confirmar compra" (BUG-QA-011)', async ({ page, boot }) => {
    const { trigger, dialog } = await openReview(page, boot)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Sheet do menu mobile: foco dentro, preso, Esc fecha e o foco volta ao gatilho', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'o Sheet só existe no mobile (barra inferior)')
    await boot('/')
    const trigger = page.getByRole('button', { name: 'Abrir menu' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'KURIO' })
    await expect(sheet).toBeVisible()
    await expect.poll(() => focusInside(sheet)).toBe(true)
    await expectTrapped(page, sheet, 'Tab')
    await expectTrapped(page, sheet, 'Shift+Tab')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Sheet do menu mobile autenticado também devolve o foco ao gatilho', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'o Sheet só existe no mobile (barra inferior)')
    await boot('/login')
    await loginAs(page, USERS.alice)
    const trigger = page.getByRole('button', { name: 'Abrir menu' })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'KURIO' })
    await expect(sheet.getByRole('button', { name: 'Sair' })).toBeVisible()
    await expectTrapped(page, sheet, 'Tab')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('menu da conta (desktop): foco entra no menu, Esc fecha e o foco volta ao botão', async ({ page, boot }, info) => {
    test.skip(isMobileProject(info.project.name), 'o menu da conta em dropdown existe a partir de md')
    await boot('/login')
    await loginAs(page, USERS.alice)
    const trigger = page.getByRole('button', { name: /Alice Colecionadora/ })
    await trigger.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect.poll(() => focusInside(menu)).toBe(true)
    // Setas circulam dentro do menu (o Tab de um menu Radix o fecha, por desenho do padrão WAI-ARIA).
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowDown')
      await expect.poll(() => focusInside(menu)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('validação por teclado do formulário do colecionador', () => {
  test('envio vazio no pagamento: foco no primeiro campo inválido e erros associados', async ({ page, boot }) => {
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 1 }])
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-total')).toBeVisible()
    const form = page.getByTestId('checkout-form')
    const labels = ['Nome de exibição', 'Nome de usuário', 'Nome do perfil', 'Código de indicação', 'E-mail']
    for (const l of labels) await form.getByLabel(l).fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(form.getByLabel('Nome de exibição')).toBeFocused()
    for (const l of labels) {
      const field = form.getByLabel(l)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const ids = ((await field.getAttribute('aria-describedby')) ?? '').split(' ').filter(Boolean)
      expect(ids.length, `${l}: aria-describedby`).toBeGreaterThan(0)
      await expect(page.locator(`#${ids[0]}`)).toBeVisible()
      await expect(page.locator(`#${ids[0]}`)).not.toHaveText('')
    }
    // Sem diálogo aberto com dados inválidos.
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('perfil: envio com campo vazio foca o primeiro inválido e o erro vem associado', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    const main = page.getByRole('main')
    await main.getByLabel('E-mail').fill('')
    await main.getByLabel('Apelido da carteira').fill('')
    await main.getByRole('button', { name: 'Salvar', exact: true }).click()
    const email = main.getByLabel('E-mail')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const id = ((await email.getAttribute('aria-describedby')) ?? '').split(' ')[0]
    await expect(page.locator(`#${id}`)).toBeVisible()
    await expect(main.getByLabel('Apelido da carteira')).toHaveAttribute('aria-invalid', 'true')
  })
})
