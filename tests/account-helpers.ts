/** Helpers of the account specs (03, 08, 11): UI flows of login/logout and a read-only cache probe. */
import type { Page } from '@playwright/test'
import { expect } from './fixtures'

/** Read-only snapshot of the query cache keys (through the React fiber of QueryClientProvider). */
export async function cacheKeys(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[] }[] } } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const qc = f.memoizedProps?.client
      if (qc?.getQueryCache) return qc.getQueryCache().getAll().map((q) => q.queryKey)
      stack.push(f.child, f.sibling)
    }
    throw new Error('QueryClient not found')
  })
}

/** Fills and submits the login form (the page must already be on /login). */
export async function submitLogin(page: Page, creds: { email: string; password: string }) {
  await page.getByRole('main').getByLabel('E-mail').fill(creds.email)
  await page.getByRole('main').getByLabel('Senha', { exact: true }).fill(creds.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Opens the account menu (desktop dropdown / mobile sheet) and clicks "Sair". */
export async function logoutThroughUi(page: Page, displayName: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const sair = page.getByRole('dialog', { name: 'KURIO' }).getByRole('button', { name: 'Sair' })
    await expect(sair).toBeVisible()
    await sair.click()
    return
  }
  await page.getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
}

/** Logs in through the form and waits until the session is established (socket bound to the user). */
export async function loginAs(page: Page, creds: { email: string; password: string }) {
  await submitLogin(page, creds)
  await expect(page.getByTestId('realtime-probe')).not.toHaveAttribute('data-user', 'guest')
}
