/**
 * Hero e botão de filtro no mobile (Figma Mobile / Início): respiro interno, arte dentro do cartão
 * e ícone do filtro de 22 px, em 390 e 360 px.
 */
import { expect, isMobileProject, test } from '../fixtures'
import { gridReady } from '../catalog-helpers'

for (const width of [390, 360]) {
  test(`hero mobile ${width}px: arte dentro do cartão, padding do texto e ícone do filtro`, async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'geometria mobile')
    await page.setViewportSize({ width, height: 844 })
    await boot('/')
    await gridReady(page)
    const hero = page.getByRole('region', { name: 'Destaques' })
    const card = await hero.boundingBox()
    const art = await hero.locator('a[aria-label^="Ver "] img').boundingBox()
    const text = await hero.getByText('Bem-vindo à Kurio').boundingBox()
    expect(card && art && text).toBeTruthy()
    expect(card!.x + card!.width - (art!.x + art!.width)).toBeGreaterThanOrEqual(8)
    expect(text!.x - card!.x).toBeGreaterThanOrEqual(20)
    expect(card!.x).toBeGreaterThanOrEqual(23.5)
    const icon = await page.getByRole('button', { name: 'Filtros e ordenação' }).locator('svg').boundingBox()
    expect(Math.round(icon!.width)).toBe(22)
    expect(Math.round(icon!.height)).toBe(22)
  })
}
