/**
 * @a11y axe scan of the shell pages (desktop + mobile). Fails on critical/serious violations.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, isMobileProject, test } from '../fixtures'

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }))
}

const pages = ['/', '/login', '/em-breve?secao=criadores', '/rota-inexistente'] as const

test.describe('@a11y shell', () => {
  for (const url of pages) {
    test(`sem violações críticas/sérias em ${url}`, async ({ page, boot }) => {
      await boot(url)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })
  }

  test('menu mobile aberto sem violações', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'menu mobile só existe abaixo de md')
    await boot('/')
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
