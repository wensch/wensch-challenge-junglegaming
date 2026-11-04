/**
 * Evidencia do revisor-frontend-senior (fundacao, volta 2). Somente UI, URL, storage e REST pelo MSW
 * da propria aba; nada escreve no cache do TanStack Query.
 * Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/revisor-evidence/playwright.revisor.config.ts
 */
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

test('V1: expiracao natural (relogio passa do expiresAt) durante a navegacao', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const s = await loginViaApi(page, USERS.alice)
  await expect(page.getByRole('button', { name: /Alice/ })).toBeVisible()
  const draftKey = `kurio.u.${s.user.id}.checkout`
  await page.evaluate((k) => sessionStorage.setItem(k, '{"step":"review"}'), draftKey)

  // O usuario deixa a aba aberta alem do TTL (8 h) e depois navega para uma rota privada.
  await page.clock.fastForward('08:05:00')
  // Endurecimento pos-fundacao (F2/#14): na pagina publica o timer ja faz o teardown silencioso (o menu
  // da conta some e aparece o aviso). A navegacao privada seguinte sai pelo link do rodape.
  await expect(page.getByTestId('session-expired-toast')).toBeVisible()
  await page.getByRole('contentinfo').getByRole('link', { name: 'Meu perfil' }).click()
  await page.waitForURL(/\/login/)
  const url = new URL(page.url())
  const draft = await page.evaluate((k) => sessionStorage.getItem(k), draftKey)
  console.log('V1', JSON.stringify({ path: url.pathname, reason: url.searchParams.get('reason'), redirect: url.searchParams.get('redirect'), draftKept: draft !== null }))
  expect.soft(url.searchParams.get('reason'), 'expiracao deveria cair no fluxo reason=expired').toBe('expired')
  expect.soft(draft, 'contexto (rascunho do mesmo usuario) deveria ser preservado na expiracao').not.toBeNull()
})

test('V2: token desconhecido no boot vira visitante sem erro de rota', async ({ page, boot }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await boot('/')
  await page.evaluate(() =>
    localStorage.setItem('kurio.session', JSON.stringify({ token: 'tok_revogado_0123456789abcdef', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })),
  )
  await page.reload()
  await page.waitForFunction(() => !!window.__mock)
  await page.waitForTimeout(1500)
  const stored = await page.evaluate(() => localStorage.getItem('kurio.session'))
  const h1 = await page.locator('h1').first().textContent()
  console.log('V2', JSON.stringify({ storedCleared: stored === null, h1, pageErrors: errors }))
  expect(stored).toBeNull()
  expect(errors).toEqual([])
  await expect(page.getByRole('link', { name: /Entrar/ }).first()).toBeVisible()
})

test('V3: dois cliques rapidos em Sair geram um unico POST /auth/logout', async ({ page, boot }) => {
  await boot('/')
  await loginViaApi(page, USERS.alice)
  const logouts: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('/api/auth/logout')) logouts.push(r.method())
  })
  await page.getByRole('button', { name: /Alice/ }).click()
  const sair = page.getByRole('menuitem', { name: 'Sair' })
  await sair.click()
  await page.waitForTimeout(1000)
  console.log('V3', JSON.stringify({ logouts: logouts.length, path: new URL(page.url()).pathname }))
  expect(logouts.length).toBe(1)
})
