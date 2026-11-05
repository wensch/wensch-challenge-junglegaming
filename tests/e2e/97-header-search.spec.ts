/**
 * Barra de busca do cabeçalho (D41): a lupa abre uma barra em largura total, em linha própria abaixo
 * do cabeçalho, que empurra o conteúdo (não sobrepõe o Hero). Desktop/tablet; no mobile a busca é a
 * barra inline "Explorar coleções" (coberta pelos specs de catálogo).
 */
import { expect, test } from '../fixtures'
import { gridReady } from '../catalog-helpers'
import { seriousViolations } from '../axe'

test.describe('busca do cabeçalho', () => {
  test.skip(({ isMobile }) => isMobile, 'o cabeçalho só existe a partir de md (768 px)')

  for (const width of [768, 1440]) {
    test(`abre em linha própria sem cobrir o Hero, foco e Esc (${width})`, async ({ page, boot }) => {
      await page.setViewportSize({ width, height: 900 })
      await boot('/')
      await gridReady(page)
      const hero = page.getByRole('region', { name: 'Destaques' })
      const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
      const before = (await hero.boundingBox())!

      await trigger.click()
      const form = page.getByRole('search', { name: 'Busca no cabeçalho' })
      const box = form.getByRole('searchbox', { name: 'Buscar NFTs' })
      await expect(form).toBeVisible()
      await expect(box).toBeFocused()
      await expect(box).toHaveAttribute('placeholder', 'Buscar por nome, coleção ou criador')
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')

      const bar = (await form.boundingBox())!
      const after = (await hero.boundingBox())!
      const header = (await page.locator('header').boundingBox())!
      expect(bar.y).toBeGreaterThanOrEqual(header.y + 40) // linha própria, abaixo da linha do cabeçalho
      expect(bar.y + bar.height, 'a barra termina antes do Hero').toBeLessThanOrEqual(after.y + 0.5)
      expect(after.y, 'o Hero foi empurrado').toBeGreaterThan(before.y + bar.height - 1)
      // O texto do placeholder cabe inteiro (sem corte).
      const fits = await box.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth)
      expect(fits).toBe(true)
      expect(bar.width).toBeGreaterThanOrEqual(Math.min(1200, width - 48) - 2) // largura do container
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      expect(await seriousViolations(page)).toEqual([])

      await page.keyboard.press('Escape')
      await expect(form).toBeHidden()
      await expect(trigger).toBeFocused()

      await trigger.click()
      await page.getByRole('button', { name: 'Fechar busca' }).click()
      await expect(form).toBeHidden()
      await expect(trigger).toBeFocused()
    })
  }

  for (const width of [768, 1440]) {
    test(`@visual barra de busca aberta ${width}`, async ({ page, boot }) => {
      await page.setViewportSize({ width, height: 900 })
      await boot('/em-breve?secao=aprenda')
      await page.evaluate(() => document.fonts.ready)
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await expect(page.getByRole('search', { name: 'Busca no cabeçalho' })).toBeVisible()
      await page.getByRole('searchbox').blur()
      await expect(page.locator('header')).toHaveScreenshot(`header-search-${width}.png`)
    })
  }

  test('Enter submete: q na URL, página 1 e a barra fecha', async ({ page, boot }) => {
    await boot('/?page=2')
    await gridReady(page)
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    const box = page.getByRole('search', { name: 'Busca no cabeçalho' }).getByRole('searchbox')
    await box.fill('Prisma')
    await box.press('Enter')
    await expect(page).toHaveURL(/q=Prisma/)
    await expect(page).not.toHaveURL(/page=2/)
    await expect(page.getByRole('search', { name: 'Busca no cabeçalho' })).toBeHidden()
    await gridReady(page)
  })
})
