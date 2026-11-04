import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI
// PW_PORT lets parallel worktrees run the suite without reusing each other's preview server.
const PORT = process.env.PW_PORT ?? '4173'
const LOCAL_URL = `http://localhost:${PORT}`
const PREVIEW = `npx vite preview --port ${PORT} --strictPort`
const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const MOBILE = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
const MOCK_HARNESS = /mocks\.spec\.ts$/

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: process.env.BASE_URL ?? LOCAL_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Baselines are per platform (font rasterization differs between Windows and Linux).
  snapshotPathTemplate: 'tests/__screenshots__/{platform}/{projectName}/{testFileName}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  // CI never writes baselines: a missing or different screenshot FAILS the visual step. Linux
  // baselines are produced on demand by .github/workflows/visual-baselines.yml (workflow_dispatch,
  // uploaded as an artifact) and committed deliberately (ARCHITECTURE §7.1).
  ...(CI ? { updateSnapshots: 'none' as const } : {}),
  // `vite preview` (and production) serve the real CSP from vercel.json, so the app suites prove that
  // MSW, the service worker and the socket work under it. The mock-layer harness (mocks.spec.ts)
  // injects socket.io-client as an inline <script> of its own — test tooling, not app code — so only
  // that file runs with `bypassCSP`, in separate projects.
  projects: [
    { name: 'desktop', testIgnore: MOCK_HARNESS, use: { ...DESKTOP } },
    { name: 'mobile', testIgnore: MOCK_HARNESS, use: { ...MOBILE } },
    { name: 'desktop-harness', testMatch: MOCK_HARNESS, use: { ...DESKTOP, bypassCSP: true } },
    { name: 'mobile-harness', testMatch: MOCK_HARNESS, use: { ...MOBILE, bypassCSP: true } },
  ],
  // BASE_URL points the suite at a deployed build (e.g. production smoke) and skips the local server.
  ...(process.env.BASE_URL ? {} : { webServer: { command: process.env.PW_SKIP_BUILD ? PREVIEW : `npm run build && ${PREVIEW}`, url: LOCAL_URL, reuseExistingServer: !CI, timeout: 180_000 } }),
})
