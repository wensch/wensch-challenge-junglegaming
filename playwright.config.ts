import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Baselines are per platform (font rasterization differs between Windows and Linux).
  snapshotPathTemplate: 'tests/__screenshots__/{platform}/{projectName}/{testFileName}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  // CI (Linux) writes missing baselines instead of failing on them; they are uploaded as an artifact
  // and committed deliberately. Existing baselines are always compared.
  ...(CI ? { updateSnapshots: 'missing' as const } : {}),
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  // BASE_URL points the suite at a deployed build (e.g. production smoke) and skips the local server.
  ...(process.env.BASE_URL ? {} : { webServer: { command: process.env.PW_SKIP_BUILD ? 'npm run preview' : 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !CI, timeout: 180_000 } }),
})
