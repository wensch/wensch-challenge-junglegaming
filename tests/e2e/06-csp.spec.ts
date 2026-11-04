/**
 * Security headers (ARCHITECTURE §4): the document is served with the production CSP and
 * Permissions-Policy (vercel.json, mirrored by `vite preview`), and the app — MSW worker, service
 * worker, Socket.IO over the intercepted WebSocket, fonts, Radix styles — runs without a single
 * CSP violation, as visitor and as a logged user.
 */
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

test('CSP e Permissions-Policy presentes; nenhuma violação ao usar o shell', async ({ page, boot }, info) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  const response = await page.goto('/')
  const headers = response!.headers()
  expect(headers['content-security-policy']).toContain("script-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['permissions-policy']).toContain('camera=()')

  await boot('/')
  const probe = page.getByTestId('realtime-probe')
  await expect(probe).toHaveAttribute('data-status', 'connected')
  await loginViaApi(page, USERS.alice)
  await expect(probe).toHaveAttribute('data-user', /usr_/)
  if (isMobileProject(info.project.name)) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('dialog', { name: 'KURIO' })).toBeVisible()
  } else {
    await page.getByRole('button', { name: /Alice/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  }
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
})
