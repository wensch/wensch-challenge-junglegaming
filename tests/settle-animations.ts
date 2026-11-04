import type { Page } from '@playwright/test'

/**
 * Waits until every FINITE animation on the page has finished (dialog fade/zoom, sheet slide, dropdown).
 * axe folds ancestor opacity into the contrast it computes, so measuring mid-fade reports a bogus
 * `color-contrast` violation (reproduced with `Animation.setPlaybackRate`; flaky on slower CI machines).
 * Infinite animations (skeleton shimmer) are ignored: they never "finish" and do not change final colors.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => Number.isFinite(a.effect?.getComputedTiming().iterations ?? 1))
      .every((a) => a.playState !== 'running' && !a.pending),
  )
}
