import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { settleAnimations } from './settle-animations'

/** Critical and serious WCAG 2.x A/AA violations of the current page, after finite animations have settled. */
export async function seriousViolations(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }))
}
