/** Galeria do detalhe (Figma "Product Images"): 4 miniaturas, troca da imagem principal, teclado e aria-current. */
import { expect, test } from '../fixtures'

test.describe('galeria do detalhe', () => {
  test('4 miniaturas; clique e teclado trocam a imagem principal; aria-current segue a ativa; sem deslocamento', async ({ page, boot }) => {
    await boot('/nft/nft_001')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    const thumbs = page.getByRole('list', { name: /Imagens de Emerald Ape/ }).getByRole('button')
    await expect(thumbs).toHaveCount(4)
    for (let i = 0; i < 4; i++) await expect(thumbs.nth(i)).toHaveAccessibleName(`Imagem ${i + 1} de 4`)
    const main = page.locator('main img[fetchpriority="high"]').first()
    const srcs = await thumbs.locator('img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute('src')))
    expect(new Set(srcs).size).toBe(4)
    await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('src', srcs[0]!)
    const before = await main.boundingBox()

    await thumbs.nth(2).click()
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
    await expect(thumbs.nth(0)).not.toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('src', srcs[2]!)
    await expect(main).toHaveAttribute('alt', /imagem 3 de 4/)
    expect(await main.boundingBox()).toEqual(before)

    await thumbs.nth(3).focus()
    await page.keyboard.press('Enter')
    await expect(thumbs.nth(3)).toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('src', srcs[3]!)
    await page.keyboard.press('Shift+Tab')
    await expect(thumbs.nth(2)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
    await expect(main).toHaveAttribute('src', srcs[2]!)
    await expect(thumbs.locator('xpath=self::*[@aria-current="true"]')).toHaveCount(1)
  })
})
