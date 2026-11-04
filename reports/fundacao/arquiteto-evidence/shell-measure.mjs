// Measures header/footer geometry at 1440 against the Figma reference (fidelity #2/#3/#4) and the
// header at tablet widths (fidelity #1). Needs a preview running (default http://localhost:4176).
// Usage (repo root): BASE_URL=http://localhost:4176 node reports/fundacao/arquiteto-evidence/shell-measure.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4176'
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/`)
  await page.waitForFunction(() => !!window.__mock)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect()
    const footer = document.querySelector('footer')
    const card = footer.firstElementChild
    const [hl, band, links] = [...card.children]
    const dividers = [...hl.children].slice(1).map((s) => Math.round(r(s).left))
    const bandX = [...band.children].map((p) => Math.round(r(p).left))
    const linkX = [...links.children].map((c) => Math.round(r(c).left))
    const firstHeading = links.querySelector('h2')
    const lastLink = [...links.querySelectorAll('li')].slice(0, 5).at(-1)
    const rows = [...links.querySelector('ul').children].map((li) => Math.round(r(li).top))
    const nav = document.querySelector('header nav a')
    return {
      footerHeight: Math.round(r(footer).height),
      cardHeight: Math.round(r(card).height),
      copyrightHeight: Math.round(r(footer.lastElementChild).height),
      blocks: { highlights: Math.round(r(hl).height), band: Math.round(r(band).height), links: Math.round(r(links).height) },
      dividers,
      bandX,
      linkX,
      headingTopFromLinks: Math.round(r(firstHeading).top - r(links).top),
      linkRowStep: rows.slice(1).map((t, i) => t - rows[i]),
      lastLinkToBottom: Math.round(r(links).bottom - r(lastLink).bottom),
      navInicioX: Math.round(r(nav).left),
    }
  })
  console.log('1440', JSON.stringify(m))
  console.log('figma', JSON.stringify({ cardHeight: 574, copyrightHeight: 36, blocks: { highlights: 250, band: 88, links: 236 }, dividers: [417, 683, 949], bandX: [152, 455, 758, 1060], linkX: [152, 455, 758, 1060], navInicioX: 496 }))
  for (const width of [768, 820, 900, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    const h = await page.evaluate(() => {
      const links = [...document.querySelectorAll('header nav a')]
      const search = document.querySelector('header a[aria-label="Buscar NFTs"]').getBoundingClientRect()
      return { aprendaRight: Math.round(links.at(-1).getBoundingClientRect().right), searchLeft: Math.round(search.left) }
    })
    console.log(width, JSON.stringify(h), 'overlap', h.aprendaRight > h.searchLeft)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('footer').screenshot({ path: 'reports/fundacao/arquiteto-evidence/footer-1440.png' })
  await page.locator('header').screenshot({ path: 'reports/fundacao/arquiteto-evidence/header-1440.png' })
  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator('header').screenshot({ path: 'reports/fundacao/arquiteto-evidence/header-768.png' })
} finally {
  await browser.close()
}
