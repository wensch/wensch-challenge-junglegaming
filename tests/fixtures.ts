/**
 * Shared Playwright fixtures.
 * - Isolation: every test already runs in a fresh browser context; on top of that the first document
 *   of the test starts with empty localStorage/sessionStorage (mock DB, scenarios, session, guest id).
 *   The flag lives in sessionStorage, so reloads inside the same test keep state (refresh tests).
 * - `mock`: typed access to `window.__mock` (MockControl). Tests talk to the simulated server ONLY
 *   through it — never through the app's cache or internals.
 * - `boot(url, scenarios?)`: open the app, reset the mock to the seed + scenarios, reload so the
 *   app starts against that exact state.
 */
import { test as base, expect, type Page } from '@playwright/test'
import type { ScenarioName } from '../src/api/contracts/scenarios'

export interface MockHelper {
  ready(): Promise<void>
  reset(scenarios?: ScenarioName[]): Promise<void>
  setScenarios(names: ScenarioName[]): Promise<void>
  emit(event: 'nft.updated' | 'order.updated', payload: unknown, opts?: { userId?: string }): Promise<void>
  drop(): Promise<void>
  settleOrder(orderId: string, status: 'confirmed' | 'declined'): Promise<void>
}

function createMockHelper(page: Page): MockHelper {
  const ready = async () => {
    await page.waitForFunction(() => !!window.__mock)
  }
  return {
    ready,
    async reset(scenarios) {
      await ready()
      await page.evaluate((s) => window.__mock!.reset(s), scenarios)
    },
    async setScenarios(names) {
      await ready()
      await page.evaluate((n) => window.__mock!.setScenarios(n), names)
    },
    async emit(event, payload, opts) {
      await ready()
      await page.evaluate(([e, p, o]) => window.__mock!.emit(e, p, o), [event, payload, opts ?? {}] as const)
    },
    async drop() {
      await ready()
      await page.evaluate(() => window.__mock!.drop())
    },
    async settleOrder(orderId, status) {
      await ready()
      await page.evaluate(([id, s]) => window.__mock!.settleOrder(id, s), [orderId, status] as const)
    },
  }
}

interface Fixtures {
  mock: MockHelper
  boot: (url?: string, scenarios?: ScenarioName[]) => Promise<void>
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      const FLAG = '__pw_isolated'
      if (sessionStorage.getItem(FLAG)) return
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem(FLAG, '1')
    })
    await provide(page)
  },
  mock: async ({ page }, provide) => {
    await provide(createMockHelper(page))
  },
  boot: async ({ page, mock }, provide) => {
    await provide(async (url = '/', scenarios) => {
      await page.goto(url)
      await mock.reset(scenarios)
      await page.reload()
      await mock.ready()
    })
  },
})

export { expect }

/** Fictitious seed users (src/mocks/seed.ts). */
export const USERS = {
  alice: { email: 'alice@example.test', password: 'Senha@123' },
  bob: { email: 'bob@example.test', password: 'Senha@456' },
} as const

/**
 * Logs in through the real REST endpoint (MSW) and stores the session the same way the app does
 * (`kurio.session`), then reloads and waits for the mock worker of the new document to be ready.
 * Faster than the UI form, for specs that are not about the login screen.
 */
export async function loginViaApi(page: Page, user: { email: string; password: string }) {
  const session = await page.evaluate(async (creds) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds) })
    if (!r.ok) throw new Error(`login failed: ${r.status}`)
    const s = (await r.json()) as { token: string; expiresAt: string; user: { id: string; displayName: string } }
    localStorage.setItem('kurio.session', JSON.stringify({ token: s.token, expiresAt: s.expiresAt }))
    return s
  }, user)
  await page.reload()
  // `reload()` resolves on `load`, before this document's MSW worker finished starting. Navigating
  // again inside that window yields a document the service worker does not control (its `/api` calls
  // reach the network). Wait for the mock control, published only once the worker is up.
  await page.waitForFunction(() => !!window.__mock)
  return session
}

export const isMobileProject = (projectName: string) => projectName === 'mobile'
