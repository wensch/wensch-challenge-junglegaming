/**
 * The simulated backend must survive the browser stopping an idle service worker.
 *
 * Chrome stops an idle worker (and freezes background timers, so MSW's own 5 s keep-alive stops too). The
 * restarted worker has an EMPTY list of active clients and lets every /api request through to the network,
 * where the SPA rewrite answers with HTML: the page then shows "Não foi possível falar com o servidor" until
 * it is reloaded. `ServiceWorker.stopAllWorkers` (DevTools protocol) reproduces exactly that restart.
 */
import { expect, test } from '../fixtures'

test.describe('mock: recuperação do service worker', () => {
  test('depois que o navegador encerra o worker ocioso, a API continua respondendo sem recarregar', async ({ page, context, boot }) => {
    await boot('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Página 2' })).toBeVisible()

    const cdp = await context.newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.stopAllWorkers')

    // A new page of the catalog goes through the restarted worker (no reload in between).
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByText('Não foi possível', { exact: false })).toHaveCount(0)

    // The mock answers (not the SPA's HTML) after the recovery.
    const probe = await page.evaluate(async () => {
      const r = await fetch('/api/__mock/ping', { cache: 'no-store' })
      return r.text()
    })
    expect(probe).toBe('mock-pong')
  })

  test('ao voltar para a aba depois do reinício do worker, o mock volta a responder sozinho', async ({ page, context, boot }) => {
    await boot('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.stopAllWorkers')
    // The tab was in the background: the page becomes visible again.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect
      .poll(async () => page.evaluate(async () => (await fetch('/api/__mock/ping', { cache: 'no-store' })).text()), { timeout: 10_000 })
      .toBe('mock-pong')
  })
})
