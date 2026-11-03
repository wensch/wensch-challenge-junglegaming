/**
 * Evidencia do revisor-frontend-senior (fundacao, volta 1). Somente leitura do app: UI, URL e
 * chamadas REST pelo MSW da propria aba. Nada escreve no cache do TanStack Query.
 * Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/revisor-evidence/playwright.revisor.config.ts
 */
import type { Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

async function api(page: Page, method: string, path: string, token?: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, token, body }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const r = await fetch(`/api${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
      const text = await r.text()
      return { status: r.status, body: text ? (JSON.parse(text) as { error?: { code?: string } }) : null }
    },
    { method, path, token, body },
  )
}

test('R1: Sair com sessao ja expirada termina em /login?reason=expired (deveria ir para /)', async ({ page, boot, mock }) => {
  await boot('/')
  await loginViaApi(page, USERS.alice)
  await page.getByRole('button', { name: /Alice/ }).click()
  const sair = page.getByRole('menuitem', { name: 'Sair' })
  await expect(sair).toBeVisible()
  // O token vence no servidor com o menu aberto (TTL vencido com a aba ociosa).
  await mock.setScenarios(['session.expired'])
  await sair.click()
  await page.waitForTimeout(1500)
  const url = new URL(page.url())
  console.log('R1', JSON.stringify({ path: url.pathname, search: url.search }))
  expect(url.pathname, 'logout explicito nao deve cair no fluxo de expiracao').toBe('/')
})

test('R2: DB do mock diverge entre abas; logout revogado numa aba volta a valer', async ({ page, boot, context }) => {
  await boot('/')
  const { token } = await loginViaApi(page, USERS.alice)
  const tabB = await context.newPage() // sem o init script de isolamento: compartilha o localStorage
  await tabB.goto('/')
  await tabB.waitForFunction(() => !!window.__mock)

  const logoutA = await api(page, 'POST', '/auth/logout', token)
  const sessionInB = await api(tabB, 'GET', '/session', token)
  const loginBobInB = await api(tabB, 'POST', '/auth/login', undefined, USERS.bob) // qualquer persist() de B
  await page.reload()
  await page.waitForFunction(() => !!window.__mock)
  const sessionInAAfterReload = await api(page, 'GET', '/session', token)
  console.log('R2', JSON.stringify({ logoutA: logoutA.status, sessionInB: sessionInB.status, loginBobInB: loginBobInB.status, sessionInAAfterReload: sessionInAAfterReload.status }))
  expect.soft(sessionInB.status, 'token revogado na aba A deveria ser 401 na aba B').toBe(401)
  expect(sessionInAAfterReload.status, 'revogacao nao pode ser desfeita pelo persist() da outra aba').toBe(401)
})
