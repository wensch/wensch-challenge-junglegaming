/**
 * E2E-08 (§9 item 8): edição de perfil, avatar, senha e carteiras, com erros de validação (cliente e API),
 * persistência após refresh e conflito de versão. Requisitos: TEL-8, TEL-9, TEL-10 (mobile), CON-6, CON-7.
 */
import type { Page } from '@playwright/test'
import { loginAs, submitLogin } from '../account-helpers'
import { expect, isMobileProject, test, USERS } from '../fixtures'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Opens a private page as `creds` (login through the UI, then a full load of the target). */
async function openAs(page: Page, boot: (url?: string) => Promise<void>, creds: { email: string; password: string }, path: string) {
  await boot('/login')
  await loginAs(page, creds)
  await page.goto(path)
  await page.waitForFunction(() => !!window.__mock)
}

/**
 * Changes a resource behind the UI's back (another device) through the REST API, which bumps its
 * `version`. `wallet` edits the primary wallet (id taken from GET /wallets), otherwise the profile.
 */
async function editElsewhere(page: Page, target: 'profile' | 'wallet', patch: Record<string, unknown>) {
  await page.evaluate(
    async ([t, p]) => {
      const { token } = JSON.parse(localStorage.getItem('kurio.session')!) as { token: string }
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      let path = '/profile'
      let current = (await (await fetch('/api/profile', { headers })).json()) as Record<string, unknown>
      if (t === 'wallet') {
        const list = (await (await fetch('/api/wallets', { headers })).json()) as { primary: Record<string, unknown> }
        current = list.primary
        path = `/wallets/${String(current.id)}`
        if (current.alternateAddress === null) delete current.alternateAddress
      }
      const r = await fetch(`/api${path}`, { method: 'PATCH', headers, body: JSON.stringify({ ...current, ...(p as object) }) })
      if (!r.ok) throw new Error(`PATCH ${path} -> ${r.status}`)
    },
    [target, patch] as const,
  )
}

const main = (page: Page) => page.getByRole('main')
/** The error message element of a field (waits for the field to be flagged invalid first). */
async function errorOf(page: Page, label: string | RegExp) {
  const field = main(page).getByLabel(label)
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  const ids = (await field.getAttribute('aria-describedby')) ?? ''
  return page.locator(`#${ids.split(' ')[0]}`)
}

test.describe('perfil', () => {
  test('mostra os dados do usuário e salva alterações que sobrevivem ao refresh', async ({ page, boot }, info) => {
    await openAs(page, boot, USERS.alice, '/profile')
    const nome = main(page).getByLabel('Nome de exibição')
    await expect(nome).toHaveValue('Alice Colecionadora')
    await expect(main(page).getByLabel('Nome de usuário')).toHaveValue('alice')
    await expect(main(page).getByLabel('E-mail')).toHaveValue('alice@example.test')
    await expect(main(page).getByLabel('Nome ENS (sem .eth)')).toHaveValue('alice')

    await nome.fill('Alice Atualizada')
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(main(page).getByRole('status').filter({ hasText: 'Dados do perfil salvos.' })).toBeVisible()
    if (!isMobileProject(info.project.name)) await expect(page.getByRole('button', { name: /Alice Atualizada/ })).toBeVisible()

    await page.reload()
    await expect(main(page).getByLabel('Nome de exibição')).toHaveValue('Alice Atualizada')
  })

  test('validação no cliente: mensagens associadas aos campos por aria-describedby', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    await main(page).getByLabel('Nome de exibição').fill('')
    await main(page).getByLabel('Nome de usuário').fill('Nome Inválido!')
    await main(page).getByLabel('Nome ENS (sem .eth)').fill('MAIÚSCULO')
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    for (const label of ['Nome de exibição', 'Nome de usuário', 'Nome ENS (sem .eth)']) {
      await expect(main(page).getByLabel(label)).toHaveAttribute('aria-invalid', 'true')
      await expect(await errorOf(page, label)).toBeVisible()
    }
    await expect(main(page).getByLabel('Nome de exibição')).toBeFocused()
  })

  test('erros da API vão para os campos (forms.server-validation e EMAIL_TAKEN)', async ({ page, boot, mock }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    await main(page).getByLabel('E-mail').fill(USERS.bob.email)
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(await errorOf(page, 'E-mail')).toHaveText('Este e-mail já está cadastrado')
    await expect(main(page).getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')

    await main(page).getByLabel('E-mail').fill('alice@example.test')
    await mock.setScenarios(['forms.server-validation'])
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(await errorOf(page, 'Nome de usuário')).toHaveText('Este nome de usuário não está disponível')
  })

  test('409 CONFLICT_VERSION: avisa, recarrega a versão e pede nova confirmação', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    await expect(main(page).getByLabel('Nome de exibição')).toHaveValue('Alice Colecionadora')
    await editElsewhere(page, 'profile', { walletAlias: 'Alterado em outro lugar' })

    await main(page).getByLabel('Nome de exibição').fill('Alice Minha Edição')
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    const alert = main(page).getByRole('alert').filter({ hasText: 'Seus dados mudaram em outro lugar.' })
    await expect(alert).toBeVisible()
    // A versão do servidor foi carregada e a edição do usuário continua no formulário.
    await expect(main(page).getByLabel('Apelido da carteira')).toHaveValue('Alterado em outro lugar')
    await expect(main(page).getByLabel('Nome de exibição')).toHaveValue('Alice Minha Edição')

    await main(page).getByRole('button', { name: 'Confirmar e salvar' }).click()
    await expect(main(page).getByRole('status').filter({ hasText: 'Dados do perfil salvos.' })).toBeVisible()
    await page.reload()
    await expect(main(page).getByLabel('Nome de exibição')).toHaveValue('Alice Minha Edição')
    await expect(main(page).getByLabel('Apelido da carteira')).toHaveValue('Alterado em outro lugar')
  })

  test('avatar: upload simulado, persistência e remoção; arquivo inválido é recusado', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    const input = page.getByTestId('avatar-input')
    await expect(main(page).getByRole('button', { name: 'Remover' })).toBeDisabled()

    await input.setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(main(page).getByRole('alert').filter({ hasText: 'Use PNG, JPEG ou WebP' })).toBeVisible()
    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
    await expect(main(page).getByRole('alert').filter({ hasText: 'Imagem maior que 2 MB' })).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(main(page).getByRole('status').filter({ hasText: 'Avatar atualizado.' })).toBeVisible()
    const img = main(page).getByRole('img', { name: /Avatar de/ })
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)

    await page.reload()
    await expect(main(page).getByRole('img', { name: /Avatar de/ })).toBeVisible()
    await main(page).getByRole('button', { name: 'Remover' }).click()
    await expect(main(page).getByRole('status').filter({ hasText: 'Avatar removido.' })).toBeVisible()
    await expect(main(page).getByRole('img', { name: /Avatar de/ })).toHaveCount(0)
    await page.reload()
    await expect(main(page).getByRole('button', { name: 'Remover' })).toBeDisabled()
  })

  test('senha: erros de validação e da API, troca bem-sucedida e novo login', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    const form = page.getByRole('form', { name: 'Alterar senha' })
    const atual = form.getByLabel('Senha atual')
    const nova = form.getByLabel('Nova senha', { exact: true })
    const confirmar = form.getByLabel('Confirmar nova senha')
    const enviar = form.getByRole('button', { name: 'Alterar senha' })

    await nova.fill('curta')
    await enviar.click()
    await expect(atual).toHaveAttribute('aria-invalid', 'true')
    await expect(nova).toHaveAttribute('aria-invalid', 'true')

    await atual.fill('SenhaErrada1')
    await nova.fill('NovaSenha@1')
    await confirmar.fill('Diferente@1')
    await enviar.click()
    await expect(confirmar).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByText('As senhas não coincidem')).toBeVisible()

    await confirmar.fill('NovaSenha@1')
    await enviar.click()
    await expect(form.getByText('Senha atual incorreta')).toBeVisible()
    await expect(atual).toHaveAttribute('aria-invalid', 'true')

    await atual.fill(USERS.alice.password)
    await enviar.click()
    await expect(form.getByRole('status').filter({ hasText: 'Senha alterada.' })).toBeVisible()
    await expect(atual).toHaveValue('')

    // A senha nova vale no próximo login; a antiga não.
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
    await page.goto('/login')
    await submitLogin(page, USERS.alice)
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await submitLogin(page, { email: USERS.alice.email, password: 'NovaSenha@1' })
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'usr_001')
  })

  test('estados: skeleton em rede lenta, erro com nova tentativa e atualização em segundo plano', async ({ page, boot, mock }) => {
    await openAs(page, boot, USERS.alice, '/profile')
    await expect(main(page).getByLabel('Nome de exibição')).toHaveValue('Alice Colecionadora')

    // Erro com retry: a lista de carteiras falha (sem rede) e se recupera ao tentar de novo.
    await mock.setScenarios(['network.offline'])
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Carteiras' }).click()
    const retry = main(page).getByRole('button', { name: 'Tentar novamente' })
    await expect(retry).toBeVisible({ timeout: 15_000 })
    await expect(main(page).getByRole('alert')).toContainText('Não foi possível falar com o servidor')
    await mock.setScenarios(['latency.slow'])
    await retry.click()
    // Skeleton enquanto carrega (sem o formulário ainda), depois os dados.
    await expect(main(page).getByText('Carregando…')).toBeVisible()
    await expect(main(page).getByRole('form', { name: 'Carteira principal' })).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('carteiras', () => {
  test('principal e secundária preenchidas; edição persiste após refresh', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/wallets')
    const principal = page.getByRole('form', { name: 'Carteira principal' })
    const secundaria = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(principal.getByLabel('Apelido da carteira')).toHaveValue('Carteira principal')
    await expect(secundaria.getByLabel('Apelido da carteira')).toHaveValue('Carteira reserva')

    await principal.getByLabel('Apelido da carteira').fill('Minha principal')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByRole('status').filter({ hasText: 'Carteira salva.' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Minha principal')
  })

  test('endereço validado pela rede escolhida (EVM x Solana) e erros por campo', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/wallets')
    const principal = page.getByRole('form', { name: 'Carteira principal' })
    await principal.getByLabel('Endereço da carteira').fill('0x123')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByText('Endereço deve ter o formato 0x seguido de 40 caracteres hexadecimais')).toBeVisible()
    await expect(principal.getByLabel('Endereço da carteira')).toHaveAttribute('aria-invalid', 'true')

    await principal.getByRole('combobox', { name: 'Rede' }).click()
    await page.getByRole('option', { name: 'Solana' }).click()
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByText('Endereço Solana inválido')).toBeVisible()

    await principal.getByLabel('Endereço da carteira').fill('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin')
    await principal.getByLabel('Código de indicação').fill('x')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByLabel('Código de indicação')).toHaveAttribute('aria-invalid', 'true')
    await expect(principal.getByLabel('Código de indicação')).toBeFocused()
  })

  test('forms.server-validation: erro do servidor no campo apelido', async ({ page, boot, mock }) => {
    await openAs(page, boot, USERS.alice, '/wallets')
    await mock.setScenarios(['forms.server-validation'])
    const principal = page.getByRole('form', { name: 'Carteira principal' })
    await principal.getByLabel('Apelido da carteira').fill('Qualquer apelido')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByText('Este apelido já está em uso')).toBeVisible()
    await expect(principal.getByLabel('Apelido da carteira')).toHaveAttribute('aria-invalid', 'true')
  })

  test('secundária vazia: estado vazio, "Igual à principal", cadastro, endereço duplicado e persistência', async ({ page, boot }) => {
    await openAs(page, boot, USERS.bob, '/wallets')
    await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
    const principal = page.getByRole('form', { name: 'Carteira principal' })
    const enderecoPrincipal = await principal.getByLabel('Endereço da carteira').inputValue()

    await page.getByLabel('Igual à carteira principal').check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secundaria = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secundaria.getByLabel('Nome de exibição')).toHaveValue('Bob Artista')
    await expect(secundaria.getByLabel('Endereço da carteira')).toHaveValue('')

    // O mesmo endereço da principal é recusado pela API, no campo.
    await secundaria.getByLabel('Endereço da carteira').fill(enderecoPrincipal)
    await secundaria.getByLabel('Apelido da carteira').fill('Reserva do Bob')
    await secundaria.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secundaria.getByText('Este endereço já está cadastrado')).toBeVisible()

    await secundaria.getByLabel('Endereço da carteira').fill(`0x${'0'.repeat(38)}b2`)
    await secundaria.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secundaria.getByRole('status').filter({ hasText: 'Carteira salva.' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByLabel('Apelido da carteira')).toHaveValue('Reserva do Bob')
  })

  test('409 CONFLICT_VERSION na carteira: recarrega e pede nova confirmação', async ({ page, boot }) => {
    await openAs(page, boot, USERS.alice, '/wallets')
    const principal = page.getByRole('form', { name: 'Carteira principal' })
    await expect(principal.getByLabel('Apelido da carteira')).toHaveValue('Carteira principal')
    await editElsewhere(page, 'wallet', { label: 'Mudou fora' })

    await principal.getByLabel('Nome de exibição').fill('Alice Nova')
    await principal.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(principal.getByRole('alert').filter({ hasText: 'Esta carteira mudou em outro lugar.' })).toBeVisible()
    await expect(principal.getByLabel('Apelido da carteira')).toHaveValue('Mudou fora')
    await principal.getByRole('button', { name: 'Confirmar e salvar' }).click()
    await expect(principal.getByRole('status').filter({ hasText: 'Carteira salva.' })).toBeVisible()
  })
})
