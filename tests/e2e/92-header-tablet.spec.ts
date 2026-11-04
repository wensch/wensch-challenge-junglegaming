/**
 * Header geometry between 768 and 1440 px (fidelity #1/#4, ARCHITECTURE §13 D6): the nav never
 * overlaps the logo nor the search/cart/account group, and at 1440 "Início" sits where the Figma
 * puts it (x = 496). Plus @visual baselines of the tablet header at 768 and 820.
 */
import type { Page } from '@playwright/test'
import { expect, isMobileProject, loginViaApi, test, USERS } from '../fixtures'

const WIDTHS = [768, 800, 820, 850, 900, 1024, 1100, 1199, 1200, 1280, 1440]

async function measure(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header')!
    const rect = (el: Element | null) => el!.getBoundingClientRect()
    const links = [...header.querySelectorAll('nav[aria-label="Principal"] a')]
    const actions = header.querySelector('a[aria-label="Buscar NFTs"]')!.parentElement!
    return {
      logoRight: rect(header.querySelector('a')).right,
      navLeft: rect(links[0]!).left,
      navRight: rect(links[links.length - 1]!).right,
      actionsLeft: rect(actions).left,
      actionsRight: rect(actions).right,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
}

test.describe('header tablet/desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'header only exists from md (768 px)')

  for (const logged of [false, true]) {
    test(`sem sobreposição entre logo, nav e ações (${logged ? 'logado' : 'visitante'})`, async ({ page, boot }) => {
      await boot('/')
      if (logged) {
        await loginViaApi(page, USERS.alice)
        await expect(page.getByRole('button', { name: /Alice/ })).toBeVisible()
      } else {
        await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
      }
      await page.evaluate(() => document.fonts.ready)
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        const m = await measure(page)
        const ctx = JSON.stringify({ width, ...m })
        expect(m.logoRight + 8, ctx).toBeLessThanOrEqual(m.navLeft)
        expect(m.navRight + 8, ctx).toBeLessThanOrEqual(m.actionsLeft)
        expect(m.scrollWidth, ctx).toBe(m.clientWidth)
        if (width >= 1440) {
          // Figma 1440 frame: "Início" at x = 496, actions end at the 1320 column edge.
          expect(Math.abs(m.navLeft - 496), ctx).toBeLessThanOrEqual(2)
          expect(Math.abs(m.actionsRight - 1320), ctx).toBeLessThanOrEqual(2)
        }
      }
    })
  }
})

test.describe('@visual header tablet', () => {
  test.skip(({ isMobile }) => isMobile, 'header only exists from md (768 px)')
  for (const width of [768, 820]) {
    test(`header ${width}`, async ({ page, boot }, info) => {
      test.skip(isMobileProject(info.project.name))
      await page.setViewportSize({ width, height: 900 })
      await boot('/em-breve?secao=aprenda')
      await page.evaluate(() => document.fonts.ready)
      await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
      await expect(page.locator('header')).toHaveScreenshot(`header-${width}.png`)
    })
  }
})
