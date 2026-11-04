/**
 * E2E-11, parte de formulários da conta (§9 item 11): navegação por teclado, foco visível, foco em
 * diálogos (menu da conta e listas Radix) e validação com mensagens associadas aos campos.
 */
import { loginAs } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'

test.describe('login por teclado', () => {
  test('Tab percorre campos, mostrar senha e envio com Enter; foco visível em cada controle', async ({ page, boot }) => {
    await boot('/login')
    const main = page.getByRole('main')
    const email = main.getByLabel('E-mail')
    const senha = main.getByLabel('Senha', { exact: true })
    const toggle = main.getByRole('button', { name: 'Mostrar senha' })

    await email.focus()
    // Foco visível: o anel de foco (box-shadow) aparece no campo focado por teclado.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(email).toBeFocused()
    expect(await email.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')

    await page.keyboard.type(USERS.alice.email)
    await page.keyboard.press('Tab')
    await expect(senha).toBeFocused()
    await page.keyboard.type(USERS.alice.password)
    await page.keyboard.press('Tab')
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(main.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    await expect(senha).toHaveAttribute('type', 'text')

    await senha.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'usr_001')
  })

  test('envio vazio: erros nos campos, associados por aria-describedby, e foco no primeiro inválido', async ({ page, boot }) => {
    await boot('/login')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = main.getByLabel('E-mail')
    const senha = main.getByLabel('Senha', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(senha).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    const emailMsg = page.locator(`#${await email.getAttribute('aria-describedby')}`)
    await expect(emailMsg).toHaveText('Informe um e-mail válido')
    await expect(page.locator(`#${await senha.getAttribute('aria-describedby')}`)).toHaveText('Informe a senha')

    // Corrigir limpa o erro (revalidação ao digitar).
    await email.fill('alice@example.test')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('cadastro: validação', () => {
  test('regras de senha e confirmação divergente aparecem nos campos', async ({ page, boot }) => {
    await boot('/register')
    const main = page.getByRole('main')
    await main.getByLabel('Nome de usuário').fill('ab')
    await main.getByLabel('E-mail').fill('invalido')
    await main.getByLabel('Senha', { exact: true }).fill('abcdefgh')
    await main.getByLabel('Confirmar senha').fill('outra')
    await main.getByRole('button', { name: 'Criar conta', exact: true }).click()
    for (const label of ['Nome de usuário', 'E-mail', 'Senha', 'Confirmar senha']) {
      const field = label === 'Senha' ? main.getByLabel('Senha', { exact: true }) : main.getByLabel(label)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      await expect(page.locator(`#${(await field.getAttribute('aria-describedby'))!.split(' ')[0]}`)).not.toHaveText('')
    }
    await expect(main.getByText('Inclua ao menos um número')).toBeVisible()
    await expect(main.getByText('As senhas não coincidem')).toBeVisible()
    await expect(main.getByLabel('Nome de usuário')).toBeFocused()
  })
})

test.describe('foco em diálogos e listas', () => {
  test('menu da conta: abre por teclado, foco entra no menu, Esc fecha e devolve o foco ao botão', async ({ page, boot }, info) => {
    test.skip(isMobileProject(info.project.name), 'o menu da conta em dropdown existe a partir de md; no mobile é o sheet do shell')
    await boot('/login')
    await loginAs(page, USERS.alice)
    const trigger = page.getByRole('button', { name: /Alice Colecionadora/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()

    // "Carteiras" pelo teclado leva à rota privada.
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Carteiras' }).press('Enter')
    await expect(page).toHaveURL('/wallets')
  })

  test('lista de redes (Radix Select): teclado seleciona e o foco volta ao gatilho', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/wallets')
    const form = page.getByRole('form', { name: 'Carteira principal' })
    const rede = form.getByRole('combobox', { name: 'Rede' })
    await rede.focus()
    await page.keyboard.press('Enter')
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(listbox).toBeHidden()
    await expect(rede).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test('avatar e senha: controles operáveis por teclado, com nome acessível e estado', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Alterar', exact: true }).focus()
    await expect(main.getByRole('button', { name: 'Alterar', exact: true })).toBeFocused()
    await expect(main.getByRole('button', { name: 'Remover' })).toBeDisabled()
    const form = page.getByRole('form', { name: 'Alterar senha' })
    const toggles = form.getByRole('button', { name: 'Mostrar senha' })
    await expect(toggles).toHaveCount(3)
    await toggles.first().focus()
    await page.keyboard.press('Space')
    await expect(form.getByLabel('Senha atual')).toHaveAttribute('type', 'text')
  })
})
