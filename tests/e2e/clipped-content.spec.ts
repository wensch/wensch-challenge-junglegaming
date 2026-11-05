/**
 * Detector of CLIPPED content. `13-overflow` only sees what spills past the document; an
 * `overflow: hidden` parent hides the spill, so a hero artwork pushed out of its box or a text column
 * squeezed to 54 px go unnoticed. Here every element that clips (overflow hidden/clip) is checked:
 *  - a visible text/image descendant must not go past the clipping box by more than 4 px;
 *  - a text block with more than 3 words must be at least 120 px wide.
 * Decorative (`aria-hidden`) subtrees, carousels and elements marked `data-clip-ok` are exempt.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { loginWithCart, pickEditions } from '../checkout-helpers'

const WIDTHS = [390, 768, 1024, 1440] as const
const TOLERANCE = 4
const MIN_TEXT_WIDTH = 120

/**
 * Known defects, reported to the orchestrator and not owned by this slice part: the Spotlight image (max 168/288 px) is cut 5 px (390) / 33 px (768) inside a narrower box. Spotlight is
 * owned by another agent; remove its entry here once fixed.
 */
const KNOWN: RegExp[] = []

function findClipped(args: { tol: number; minText: number }): string[] {
  const { tol, minText } = args
  const problems: string[] = []
  const describe = (el: Element) => `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} class="${(el.getAttribute('class') ?? '').slice(0, 90)}">`
  const exempt = (el: Element) => !!el.closest('[aria-hidden="true"], [data-clip-ok], [aria-roledescription="carousel"], .sr-only, [inert], [hidden]')
  const shown = (el: Element) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== "0" && r.width > 1 && r.height > 1
  }
  const ownText = (el: Element) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join(' ')
      .trim()

  const body = document.body
  const clippers = [...body.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el)
    const clips = (v: string) => v === 'hidden' || v === 'clip'
    const ellipsis = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none'
    return (clips(cs.overflowX) || clips(cs.overflowY)) && !ellipsis && !exempt(el) && shown(el)
  })
  const seen = new Set<string>()
  for (const parent of clippers) {
    const pr = parent.getBoundingClientRect()
    for (const el of parent.querySelectorAll('*')) {
      if (exempt(el) || !shown(el)) continue
      const isImg = el.tagName === 'IMG'
      if (!isImg && ownText(el).length === 0) continue
      const r = el.getBoundingClientRect()
      const out = Math.max(r.right - pr.right, pr.left - r.left, r.bottom - pr.bottom, pr.top - r.top)
      const key = `${describe(parent)}>${describe(el)}`
      if (out > tol && !seen.has(key)) {
        seen.add(key)
        problems.push(`CLIPPED by ${Math.round(out)}px: ${describe(el)} [${[r.left, r.top, r.right, r.bottom].map(Math.round)}] inside ${describe(parent)} [${[pr.left, pr.top, pr.right, pr.bottom].map(Math.round)}]`)
      }
    }
  }
  for (const el of body.querySelectorAll('*')) {
    if (exempt(el) || !shown(el)) continue
    const text = ownText(el)
    if (text.split(/\s+/).length <= 3) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'inline' || cs.textOverflow === 'ellipsis') continue
    const w = el.getBoundingClientRect().width
    if (w < minText) problems.push(`NARROW ${Math.round(w)}px: ${describe(el)} "${text.slice(0, 40)}"`)
  }
  return problems
}

async function scan(page: Page, path: string, width: number, ready: () => Promise<void>) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(path)
  await ready()
  await page.evaluate(() => document.fonts.ready)
  const problems = await page.evaluate(findClipped, { tol: TOLERANCE, minText: MIN_TEXT_WIDTH })
  expect(problems.filter((p) => !KNOWN.some((k) => k.test(p))), `${path} @${width}`).toEqual([])
}

test.describe('conteúdo cortado', () => {
  test('rotas públicas', async ({ page, boot }) => {
    test.slow()
    await boot('/')
    for (const width of WIDTHS) {
      await scan(page, '/', width, async () => {
        await expect(page.getByTestId('catalog-grid')).toBeVisible()
        await expect(page.getByRole('region', { name: 'Destaques' }).getByRole('img').first()).toBeVisible()
      })
      await scan(page, '/nft/nft_002', width, async () => {
        await expect(page.getByRole('heading', { level: 1, name: 'Prisma Boreal' })).toBeVisible()
        await expect(page.getByRole('list', { name: 'NFTs da mesma coleção' })).toBeVisible()
      })
      for (const path of ['/login', '/register']) await scan(page, path, width, () => expect(page.getByRole('main')).toBeVisible())
    }
  })

  test('rotas autenticadas', async ({ page, boot }) => {
    test.slow()
    await boot('/')
    const [a] = await pickEditions(page, 1)
    await loginWithCart(page, [{ item: a!, quantity: 2 }])
    const main = page.getByRole('main')
    for (const width of WIDTHS) {
      await scan(page, '/cart', width, () => expect(page.getByTestId('cart-total')).toBeVisible())
      await scan(page, '/favorites', width, () => expect(main).toBeVisible())
      await scan(page, '/profile', width, () => expect(main.getByLabel('E-mail')).toBeVisible())
      await scan(page, '/wallets', width, () => expect(main).toBeVisible())
      await scan(page, '/checkout', width, () => expect(page.getByTestId('checkout-total')).toBeVisible())
    }
  })

  test('Hero e cartões de coleção cabem inteiros entre 768 e 1199 px', async ({ page, boot }) => {
    await boot('/')
    for (const width of [768, 820, 1024, 1199]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      const hero = page.getByRole('region', { name: 'Destaques' })
      const art = hero.getByRole('link').filter({ has: page.getByRole('img') }).first()
      await expect(art).toBeVisible()
      const [h, a] = [await hero.boundingBox(), await art.boundingBox()]
      expect(a!.x + a!.width, `arte do Hero @${width}`).toBeLessThanOrEqual(h!.x + h!.width + 1)
      expect(a!.x, `arte do Hero @${width}`).toBeGreaterThanOrEqual(h!.x - 1)
      for (const article of await page.getByRole('region', { name: 'Promoções' }).locator('article').all()) {
        const textBox = await article.locator('h2').locator('..').boundingBox()
        expect(textBox!.width, `coluna de texto do cartão @${width}`).toBeGreaterThanOrEqual(180)
      }
    }
  })

  test('pontos do Hero não encostam na arte em 1200, 1440 e 1920 px', async ({ page, boot }) => {
    await boot('/')
    for (const width of [1200, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      const hero = page.getByRole('region', { name: 'Destaques' })
      const art = hero.getByRole('link').filter({ has: page.getByRole('img') }).first()
      await expect(art).toBeVisible()
      const [dots, a] = [await hero.getByRole('group', { name: 'Escolher destaque' }).boundingBox(), await art.boundingBox()]
      expect(dots!.x + dots!.width, `pontos @${width}`).toBeLessThanOrEqual(a!.x - 24)
    }
  })

  test('Hero mobile: arte inteira, pontos centralizados e título em 2 linhas', async ({ page, boot }) => {
    await boot('/')
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 })
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      const hero = page.getByRole('region', { name: 'Destaques' })
      const art = hero.getByRole('link').filter({ has: page.getByRole('img') }).first()
      await expect(art).toBeVisible()
      const [h, a, dots] = [await hero.boundingBox(), await art.boundingBox(), await hero.getByRole('group', { name: 'Escolher destaque' }).boundingBox()]
      expect(a!.x + a!.width, `arte do Hero @${width}`).toBeLessThanOrEqual(h!.x + h!.width + 1)
      expect(Math.abs(dots!.x + dots!.width / 2 - (h!.x + h!.width / 2)), `centro dos pontos @${width}`).toBeLessThanOrEqual(8)
      const title = await hero.getByRole('heading', { level: 1 }).boundingBox()
      expect(title!.height, `título em 2 linhas @${width}`).toBeLessThanOrEqual(24 * 2 + 2)
    }
  })
})
