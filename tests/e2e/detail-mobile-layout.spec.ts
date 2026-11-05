/** Detalhe do NFT em 390 px (Figma "Mobile / Detalhes do NFT"): ordem vertical, medidas dos controles e carrossel sem barra. */
import { expect, test } from '../fixtures'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('detalhe mobile (390 px)', () => {
  test('ordem: descrição < edição < token/coleção/atributos < painel de compra; controles com as medidas do Figma', async ({ page, boot }) => {
    await boot('/nft/nft_001')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    const top = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!.y
    const description = await top(page.getByText('Sobre este NFT:'))
    const edition = await top(page.getByText('Edição:', { exact: true }))
    const token = await top(page.getByText(/^ID do token:/))
    const collection = await top(page.getByText(/^Coleção:/).first())
    const attributes = await top(page.getByText(/^Atributos:/))
    const purchase = await top(page.getByRole('form', { name: 'Comprar' }))
    expect(description).toBeLessThan(edition)
    expect(edition).toBeLessThan(token)
    expect(token).toBeLessThan(collection)
    expect(collection).toBeLessThan(attributes)
    expect(attributes).toBeLessThan(purchase)

    const size = async (name: string | RegExp) => (await page.getByRole('button', { name }).first().boundingBox())!
    const back = (await page.getByLabel(/^Voltar/).first().boundingBox())!
    expect([back.width, back.height]).toEqual([35, 35])
    const fav = await size(/^Favoritar /)
    expect([fav.width, fav.height]).toEqual([35, 35])
    const minus = await size('Diminuir quantidade')
    expect([minus.width, minus.height]).toEqual([20, 30])
    const cart = await size('Adicionar ao carrinho')
    expect([cart.width, cart.height]).toEqual([60, 60])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('"Mais desta coleção": sem barra de rolagem visível e com snap horizontal', async ({ page, boot }) => {
    await boot('/nft/nft_001')
    const row = page.getByRole('list', { name: 'NFTs da mesma coleção' })
    await expect(row).toBeVisible()
    const style = await row.evaluate((node) => {
      const el = node as HTMLElement
      const cs = getComputedStyle(el)
      return { bar: cs.scrollbarWidth, snap: cs.scrollSnapType, offset: el.offsetHeight - el.clientHeight }
    })
    expect(style.bar).toBe('none')
    expect(style.snap).toContain('x mandatory')
    expect(style.offset).toBe(0)
  })
})
