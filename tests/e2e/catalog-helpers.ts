/** Helpers shared by the catalog/detail specs: the same actions work on the desktop sidebar and the mobile sheet. */
import type { Locator, Page } from '@playwright/test'
import { expect } from '../fixtures'
import { compare } from '../../src/lib/money'

export const cards = (page: Page): Locator => page.getByTestId('nft-card')

export async function cardNames(page: Page): Promise<string[]> {
  return (await cards(page).locator('a span.truncate').allTextContents()).map((t) => t.trim())
}

export async function cardPrices(page: Page): Promise<string[]> {
  return (await cards(page).getByTestId('nft-price').allTextContents()).map((t) => t.replace(' ETH', '').trim())
}

/** Waits until the grid shows real cards (not skeletons) and is not dimmed by a pending page. */
export async function gridReady(page: Page) {
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await expect(page.getByTestId('catalog-grid')).not.toHaveAttribute('data-stale', 'true')
}

/** Opens the filter surface (mobile sheet or desktop sidebar) and returns its scope. */
export async function openFilters(page: Page, mobile: boolean): Promise<Locator> {
  if (!mobile) return page.locator('#mercado')
  await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
  return page.getByRole('dialog', { name: 'Filtros' })
}

export async function closeFilters(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole('button', { name: 'Ver resultados' }).click()
}

export async function searchFor(page: Page, mobile: boolean, term: string) {
  if (!mobile) await page.getByRole('button', { name: 'Buscar NFTs' }).click()
  const box = page.getByRole('searchbox', { name: 'Buscar NFTs' })
  await box.fill(term)
  await box.press('Enter')
}

export async function sortBy(page: Page, scope: Locator, option: string) {
  await scope.getByRole('combobox', { name: 'Ordenar por' }).click()
  await page.getByRole('option', { name: option }).click()
}

export const isAscending = (values: string[]) => values.every((v, i) => i === 0 || compare(values[i - 1]!, v) <= 0)
