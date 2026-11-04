// Config isolada do gate de seguranca (S2+S3 integradas). Usa o preview ja rodando (BASE_URL), sem webServer.
// Rodar: BASE_URL=http://localhost:4173 npx playwright test -c reports/s-integrada/seguranca-evidence/playwright.security.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.sec\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: './test-results',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})
