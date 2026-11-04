/**
 * E2E-03 (§9 item 3): cadastro, login (retorno ao fluxo), expiração, logout e troca de usuário,
 * tudo pela interface. Requisitos: TEL-6, TEL-7, CON-1..5, CON-8.
 */
import { cacheKeys, loginAs, logoutThroughUi, submitLogin } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'

const probe = (page: import('@playwright/test').Page) => page.getByTestId('realtime-probe')

test.describe('cadastro', () => {
  test('cria a conta, entra logado e a sessão sobrevive ao refresh', async ({ page, boot }) => {
    await boot('/register')
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible()
    await page.getByRole('main').getByLabel('Nome de usuário').fill('colecionadora')
    await page.getByRole('main').getByLabel('E-mail').fill('colecionadora@example.test')
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill('Senha@789')
    await page.getByRole('main').getByLabel('Confirmar senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()

    await expect(page).toHaveURL('/')
    await expect(probe(page)).not.toHaveAttribute('data-user', 'guest')
    const userId = await probe(page).getAttribute('data-user')
    await page.reload()
    await page.waitForFunction(() => !!window.__mock)
    await expect(probe(page)).toHaveAttribute('data-user', userId!)
  })

  test('e-mail já cadastrado: 409 EMAIL_TAKEN aparece no campo, não em um alerta genérico', async ({ page, boot }) => {
    await boot('/register')
    await page.getByRole('main').getByLabel('Nome de usuário').fill('outra_alice')
    await page.getByRole('main').getByLabel('E-mail').fill(USERS.alice.email)
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill('Senha@789')
    await page.getByRole('main').getByLabel('Confirmar senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()

    const email = page.getByRole('main').getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedBy}`)).toHaveText('Este e-mail já está cadastrado')
    await expect(email).toBeFocused()
    await expect(page).toHaveURL(/\/register/)
    // Corrigir o e-mail e reenviar funciona.
    await email.fill('outra_alice@example.test')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page).toHaveURL('/')
  })

  test('cenário register.email-taken: o servidor recusa e o campo mostra o erro', async ({ page, boot }) => {
    await boot('/register', ['register.email-taken'])
    await page.getByRole('main').getByLabel('Nome de usuário').fill('nova_pessoa')
    await page.getByRole('main').getByLabel('E-mail').fill('nova@example.test')
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill('Senha@789')
    await page.getByRole('main').getByLabel('Confirmar senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByRole('main').getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()
  })
})

test.describe('login e retorno ao fluxo', () => {
  test('rota privada sem sessão: login com mensagem e retorno ao destino original', async ({ page, boot }) => {
    await boot('/wallets')
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Fwallets/)
    await expect(page).toHaveURL(/reason=required/)
    await expect(page.getByRole('status').filter({ hasText: 'Entre na sua conta para continuar.' })).toBeVisible()

    await submitLogin(page, USERS.alice)
    await expect(page).toHaveURL('/wallets')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeVisible()
  })

  test('credenciais erradas: alerta no formulário, sem sair da tela', async ({ page, boot }) => {
    await boot('/login')
    await submitLogin(page, { email: USERS.alice.email, password: 'errada123' })
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await expect(probe(page)).toHaveAttribute('data-user', 'guest')
  })

  test('redirect externo é descartado: o login termina na página inicial', async ({ page, boot }) => {
    await boot('/login?redirect=//evil.example&reason=required')
    await submitLogin(page, USERS.alice)
    await expect(page).toHaveURL('/')
    expect(new URL(page.url()).hostname).not.toBe('evil.example')
    await expect(probe(page)).not.toHaveAttribute('data-user', 'guest')
  })

})

test.describe('expiração', () => {
  test('sessão expira durante a navegação: login com contexto e retomada do destino', async ({ page, boot, mock }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await mock.ready()
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()

    await mock.setScenarios(['session.expired'])
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Carteiras' }).click()

    await expect(page).toHaveURL(/\/login\?.*reason=expired/)
    await expect(page).toHaveURL(/redirect=%2Fwallets/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou.' })).toBeVisible()
    await expect(probe(page)).toHaveAttribute('data-user', 'guest')
    await expect.poll(async () => (await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])

    await submitLogin(page, USERS.alice)
    await expect(page).toHaveURL('/wallets')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeVisible()
  })
})

test.describe('logout e troca de usuário', () => {
  test('logout pela interface limpa o cache privado e o socket e bloqueia rotas privadas', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()
    await expect.poll(async () => (await cacheKeys(page)).some((k) => k[0] === 'u' && k[2] === 'profile')).toBe(true)

    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await expect(probe(page)).toHaveAttribute('data-user', 'guest')
    await expect.poll(async () => (await cacheKeys(page)).filter((k) => k[0] === 'u')).toEqual([])

    await page.goto('/wallets')
    await expect(page).toHaveURL(/\/login\?.*reason=required/)
  })

  test('menu da conta (desktop) / menu mobile: Sair encerra a sessão', async ({ page, boot }, info) => {
    const mobile = isMobileProject(info.project.name)
    await boot('/login')
    await submitLogin(page, USERS.alice)
    await expect(page).toHaveURL('/')
    await logoutThroughUi(page, 'Alice Colecionadora', mobile)
    await expect(probe(page)).toHaveAttribute('data-user', 'guest')
    if (!mobile) await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  })

  test('troca de usuário pela tela de login: nada de alice sobra no cache nem no socket', async ({ page, boot }) => {
    await boot('/login')
    await loginAs(page, USERS.alice)
    await page.goto('/profile')
    await expect(page.getByRole('main').getByLabel('Nome de usuário')).toHaveValue('alice')
    await expect(probe(page)).toHaveAttribute('data-user', 'usr_001')

    await page.goto('/login')
    await expect(page.getByRole('status').filter({ hasText: 'Entrar com outra conta troca o usuário' })).toBeVisible()
    await submitLogin(page, USERS.bob)
    await expect(page).toHaveURL('/')
    await expect(probe(page)).toHaveAttribute('data-user', 'usr_002')
    const owners = (await cacheKeys(page)).filter((k) => k[0] === 'u').map((k) => k[1])
    expect(owners.filter((o) => o !== 'usr_002')).toEqual([])

    await page.goto('/profile')
    await expect(page.getByRole('main').getByLabel('Nome de usuário')).toHaveValue('bob')
  })
})
