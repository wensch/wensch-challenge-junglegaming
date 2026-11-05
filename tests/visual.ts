import type { Page } from '@playwright/test'

/** Waits for web fonts and, optionally, hides the elements matched by `hideSelector` (outside the crop). */
export async function settleFonts(page: Page, hideSelector?: string) {
  await page.evaluate(() => document.fonts.ready)
  if (hideSelector) await page.addStyleTag({ content: `${hideSelector} { visibility: hidden !important; }` })
}
