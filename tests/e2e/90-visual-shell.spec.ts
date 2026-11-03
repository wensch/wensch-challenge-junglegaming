/**
 * @visual baselines of the shell (header/tab bar and footer) at 1440 and 390.
 * Compared against design/ref by the fidelity reviewer; here they guard against regressions.
 */
import { expect, isMobileProject, test } from '../fixtures'

test.describe('@visual shell', () => {
  test.beforeEach(async ({ page, boot }) => {
    await boot('/em-breve?secao=aprenda')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('header / tab bar', async ({ page }, info) => {
    if (isMobileProject(info.project.name)) {
      await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveScreenshot('tabbar.png')
    } else {
      await expect(page.locator('header')).toHaveScreenshot('header.png')
    }
  })

  test('footer', async ({ page }) => {
    const footer = page.getByRole('contentinfo')
    await footer.scrollIntoViewIfNeeded()
    // The fixed tab bar overlaps the footer on mobile; hide it for this shot only.
    await page.addStyleTag({ content: 'nav[aria-label="Navegação inferior"] { visibility: hidden !important; }' })
    await expect(footer).toHaveScreenshot('footer.png')
  })
})
