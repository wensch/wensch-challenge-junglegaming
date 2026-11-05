/**
 * Session lifecycle across tabs and on explicit logout (ARCHITECTURE §4, §9).
 * The cache is only READ (through the React fiber of QueryClientProvider) to prove that private
 * data is gone; nothing here writes into it. Tabs share localStorage (same browser context), which
 * is how a real browser propagates logout/login between tabs (`storage` event).
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

/** Read-only snapshot of the query cache keys and data. */
async function cacheDump(page: Page): Promise<{ keys: unknown[][]; blob: string }> {
  return page.evaluate(() => {
    const root = document.getElementById('root') as unknown as Record<string, unknown>
    const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))!
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { client?: { getQueryCache?: () => { getAll(): { queryKey: unknown[]; state: { data: unknown } }[] } } } }
    const stack: (Fiber | undefined)[] = [root[key] as Fiber]
    while (stack.length) {
      const f = stack.pop()
      if (!f) continue
      const qc = f.memoizedProps?.client
      if (qc?.getQueryCache) {
        const all = qc.getQueryCache().getAll()
        return { keys: all.map((q) => q.queryKey), blob: JSON.stringify(all.map((q) => [q.queryKey, q.state.data])) }
      }
      stack.push(f.child, f.sibling)
    }
    throw new Error('QueryClient not found')
  })
}

async function openTabB(page: Page) {
  const tabB = await page.context().newPage() // no isolation init script: shares the storage of tab A
  await tabB.goto('/')
  await tabB.waitForFunction(() => !!window.__mock)
  return tabB
}

/** Opens the account menu (desktop dropdown / mobile sheet) and returns its "Sair" control. */
async function openLogout(page: Page, displayName: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const sair = page.getByRole('dialog', { name: 'KURIO' }).getByRole('button', { name: 'Sair' })
    await expect(sair).toBeVisible()
    return sair
  }
  await page.getByRole('button', { name: new RegExp(displayName) }).click()
  const sair = page.getByRole('menuitem', { name: 'Sair' })
  await expect(sair).toBeVisible()
  return sair
}

async function logoutThroughUi(page: Page, displayName: string, mobile: boolean) {
  await (await openLogout(page, displayName, mobile)).click()
}

test.describe('sessão entre abas', () => {
  test('logout na aba A limpa a aba B (cache privado, socket, guard)', async ({ page, boot }, info) => {
    const mobile = isMobileProject(info.project.name)
    await boot('/')
    const alice = await loginViaApi(page, USERS.alice)
    const tabB = await openTabB(page)
    const probeB = tabB.getByTestId('realtime-probe')
    await expect(probeB).toHaveAttribute('data-user', alice.user.id)
    await expect.poll(async () => (await cacheDump(tabB)).keys.some((k) => k[0] === 'u')).toBe(true)

    await logoutThroughUi(page, alice.user.displayName, mobile)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')

    await expect(probeB).toHaveAttribute('data-user', 'guest')
    await expect.poll(async () => (await cacheDump(tabB)).keys.filter((k) => k[0] === 'u')).toEqual([])
    const dump = await cacheDump(tabB)
    expect(dump.blob).not.toContain(alice.token)
    expect(dump.blob).not.toContain(USERS.alice.email)
    if (!mobile) await expect(tabB.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await expect(tabB.getByText(alice.user.displayName)).toHaveCount(0)

    // Client-side navigation to a private route in tab B is refused.
    await tabB.evaluate(() => {
      history.pushState({}, '', '/checkout')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(tabB).toHaveURL(/\/login\?/)
    expect(new URL(tabB.url()).searchParams.get('reason')).toBe('required')
  })

  test('troca de usuário na aba A: nada de alice permanece na aba B', async ({ page, boot }) => {
    await boot('/')
    const alice = await loginViaApi(page, USERS.alice)
    const tabB = await openTabB(page)
    await expect(tabB.getByTestId('realtime-probe')).toHaveAttribute('data-user', alice.user.id)

    // Tab A replaces the stored session with bob's (login without logout, e.g. another account).
    const bob = await page.evaluate(async (creds) => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds) })
      const s = (await r.json()) as { token: string; expiresAt: string; user: { id: string } }
      localStorage.setItem('kurio.session', JSON.stringify({ token: s.token, expiresAt: s.expiresAt }))
      return s
    }, USERS.bob)

    // Tab B ends as bob (or as visitor if the simulated server of that tab does not know bob's token
    // yet) — never as alice, and never with alice's data under any key.
    await expect(tabB.getByTestId('realtime-probe')).not.toHaveAttribute('data-user', alice.user.id)
    await expect.poll(async () => (await cacheDump(tabB)).keys.filter((k) => k[0] === 'u' && k[1] === alice.user.id)).toEqual([])
    const dump = await cacheDump(tabB)
    expect(dump.blob).not.toContain(alice.token)
    expect(dump.blob).not.toContain(USERS.alice.email)
    expect(['guest', bob.user.id]).toContain(await tabB.getByTestId('realtime-probe').getAttribute('data-user'))
  })
})

test.describe('logout explícito', () => {
  test('com o token já vencido no servidor, Sair vai para o início (não para o fluxo de expiração)', async ({ page, boot, mock }, info) => {
    const mobile = isMobileProject(info.project.name)
    await page.clock.install()
    await boot('/')
    const alice = await loginViaApi(page, USERS.alice)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', alice.user.id)
    // The token expires server-side while the menu is open (idle tab), then the user clicks "Sair".
    const sair = await openLogout(page, alice.user.displayName, mobile)
    await mock.setScenarios(['session.expired'])
    // Two correct orders race here: the click reaches `POST /auth/logout` (401 answered as a silent
    // logout) or a background GET sees the 401 first and tears the session down silently, which removes
    // the menu before the click lands. The guarantee is the OUTCOME below, so a detached menu is fine.
    await sair.click({ timeout: 5_000 }).catch(() => undefined)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
    // Relógio da página avança 1 s: qualquer redirecionamento agendado (reason=expired) já teria disparado.
    await page.clock.runFor(1000)
    const url = new URL(page.url())
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('reason')).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
  })
})

test.describe('rascunhos por usuário depois da expiração (segurança #13)', () => {
  const ALICE_DRAFT = '{"secret":"rascunho-de-alice"}'

  async function aliceExpiredWithDraft(page: Page, boot: (url?: string) => Promise<void>) {
    await page.clock.install()
    await boot('/')
    const alice = await loginViaApi(page, USERS.alice)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', alice.user.id)
    const draftKey = `kurio.u.${alice.user.id}.checkout`
    await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [draftKey, ALICE_DRAFT] as const)
    // Natural expiry on a public page: silent teardown, alice's draft kept for her re-login.
    await page.clock.fastForward('08:05:00')
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', 'guest')
    expect(await page.evaluate((k) => sessionStorage.getItem(k), draftKey)).toBe(ALICE_DRAFT)
    return { alice, draftKey }
  }

  const draftKeys = (page: Page) => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio.u.')))

  test('sem sessão em cache, bob entra por outra aba: o rascunho de alice sai desta aba', async ({ page, boot }) => {
    const { alice } = await aliceExpiredWithDraft(page, boot)
    const tabB = await openTabB(page)
    const bob = await loginViaApi(tabB, USERS.bob)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', bob.user.id)
    await expect.poll(() => draftKeys(page)).toEqual([])
    expect((await cacheDump(page)).blob).not.toContain(alice.user.id)
    await tabB.close()
  })

  test('alice volta pela outra aba: o rascunho dela continua nesta aba', async ({ page, boot }) => {
    const { alice, draftKey } = await aliceExpiredWithDraft(page, boot)
    const tabB = await openTabB(page)
    await loginViaApi(tabB, USERS.alice)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', alice.user.id)
    expect(await draftKeys(page)).toEqual([draftKey])
    await tabB.close()
  })

  test('boot com outro usuário no storage: o primeiro GET /session apaga o rascunho de alice', async ({ page, boot }) => {
    await aliceExpiredWithDraft(page, boot)
    // Bob's session is stored in this tab, then the tab reloads (sessionStorage survives the reload).
    const bob = await loginViaApi(page, USERS.bob)
    await expect(page.getByTestId('realtime-probe')).toHaveAttribute('data-user', bob.user.id)
    await expect.poll(() => draftKeys(page)).toEqual([])
  })
})
