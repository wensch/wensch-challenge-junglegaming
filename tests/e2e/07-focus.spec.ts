/**
 * Focus management: a full load leaves the focus at the document start (first Tab
 * = skip link); a client-side navigation moves it to the new page's <h1>, /em-breve included.
 */
import { expect, test } from '../fixtures'

test('carga completa não move o foco; navegação client-side foca o h1 (inclusive /em-breve)', async ({ page, boot }) => {
  await boot('/em-breve?secao=aprenda')
  await expect(page.getByRole('heading', { level: 1, name: 'Aprenda' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).not.toBeFocused()

  await page.getByRole('main').getByRole('link', { name: 'Voltar para o início' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()

  await page.getByRole('contentinfo').getByRole('link', { name: /Central de ajuda/ }).first().click()
  await expect(page).toHaveURL(/\/em-breve\?secao=ajuda/)
  await expect(page.getByRole('heading', { level: 1, name: 'Central de ajuda' })).toBeFocused()
})
