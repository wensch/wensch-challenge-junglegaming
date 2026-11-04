/**
 * Evidencia do revisor-frontend-senior (fundacao, volta 3). Somente UI, URL, storage, socket probe e
 * REST pelo MSW da propria aba; nada escreve no cache do TanStack Query.
 * Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/revisor-evidence/playwright.revisor.config.ts revisor-v3
 */
import { expect, loginViaApi, test, USERS } from '../../../tests/fixtures'

test('V4: sessao vencida pelo relogio numa pagina publica (estado "fantasma")', async ({ page, boot }) => {
  await page.clock.install()
  await boot('/')
  const s = await loginViaApi(page, USERS.alice)
  await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', s.user.id)

  const cart401: string[] = []
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/') && r.status() === 401) cart401.push(`${r.request().method()} ${new URL(r.url()).pathname}`)
  })
  await page.clock.fastForward('08:05:00')
  // Heartbeat/sweep do servidor simulado (20 s) e o retorno a aba (refetch on focus).
  await page.clock.runFor(45_000)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.clock.runFor(2_000)
  await page.waitForTimeout(500)

  const probe = page.getByTestId('realtime-probe')
  const out = {
    path: new URL(page.url()).pathname,
    headerShowsUser: await page.getByRole('button', { name: /Alice/ }).isVisible(),
    storedToken: (await page.evaluate(() => localStorage.getItem('kurio.session'))) !== null,
    probeUser: await probe.getAttribute('data-user'),
    probeStatus: await probe.getAttribute('data-status'),
    probeConnections: await probe.getAttribute('data-connections'),
    responses401: cart401,
  }
  const toast = page.getByTestId('session-expired-toast')
  const out2 = { ...out, toastVisible: await toast.isVisible(), toastInLiveRegion: await page.locator('section[aria-live="polite"]').getByTestId('session-expired-toast').count() }
  console.log('V4', JSON.stringify(out2))
  // Depois do endurecimento (F2/#14): teardown `expired` silencioso, sem redirecionar.
  expect(out.path).toBe('/')
  expect(out.headerShowsUser).toBe(false)
  expect(out.storedToken).toBe(false)
  expect(out.probeUser).toBe('guest')
  expect(out2.toastVisible).toBe(true)
  expect(out2.toastInLiveRegion).toBe(1)
  await expect(toast.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login?reason=expired&redirect=%2F')
})
