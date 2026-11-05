/**
 * E2E-01 (TEL-1, CAT-1..4, RT-1 no catálogo): busca, filtros combinados, ordenação, paginação e
 * restauração pelo histórico, com a URL como fonte de verdade; estados vazio e erro; respostas fora
 * de ordem; evento `nft.updated` entregue pelo socket.io-client e observado na grade.
 */
import { expect, isMobileProject, test } from '../fixtures'
import { cardNames, cardPrices, cards, closeFilters, gridReady, isAscending, openFilters, searchFor, sortBy } from './catalog-helpers'

test.describe('catálogo', () => {
  test('destaques e grade 3x3 com paginação; navegar ao NFT', async ({ page, boot }) => {
    await boot('/')
    await expect(page.getByRole('region', { name: 'Destaques' })).toBeVisible()
    await gridReady(page)
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toBeVisible()
    const first = (await cardNames(page))[0]!
    await cards(page).first().getByRole('link').click()
    await expect(page).toHaveURL(/\/nft\/nft_\d+/)
    await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible()
  })

  test('busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico', async ({ page, boot }, info) => {
    const mobile = isMobileProject(info.project.name)
    await boot('/')
    await gridReady(page)
    const page1 = await cardNames(page)

    // Paginação: página 2 na URL, outra lista.
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await gridReady(page)
    expect(await cardNames(page)).not.toEqual(page1)

    // Mudança de filtro reinicia a paginação (CAT-2) e a API recebe os mesmos parâmetros (CAT-3).
    let scope = await openFilters(page, mobile)
    const requestWithFilter = page.waitForRequest((r) => r.url().includes('/api/nfts?') && r.url().includes('categories=fotografia'))
    await scope.getByRole('checkbox', { name: /Fotografia/ }).check()
    const apiUrl = new URL((await requestWithFilter).url())
    expect(apiUrl.searchParams.get('page')).toBe('1')
    await closeFilters(page, mobile)
    await expect(page).toHaveURL(/categories=/)
    await expect(page).not.toHaveURL(/page=/)

    // Filtros combináveis: categoria + rede + ordenação por preço.
    scope = await openFilters(page, mobile)
    const combined = page.waitForRequest((r) => r.url().includes('networks=polygon') && r.url().includes('categories=fotografia'))
    await scope.getByRole('checkbox', { name: /Polygon/ }).check()
    expect(new URL((await combined).url()).searchParams.get('categories')).toBe('fotografia')
    const sorted = page.waitForRequest((r) => r.url().includes('sort=price_asc'))
    await sortBy(page, scope, 'Preço: menor para maior')
    await sorted
    await closeFilters(page, mobile)
    await expect(page).toHaveURL(/sort=price_asc/)
    await gridReady(page)
    const filteredUrl = page.url()
    const prices = await cardPrices(page)
    expect(prices.length).toBeGreaterThan(0)
    expect(isAscending(prices)).toBe(true)

    // Busca textual, composta com os filtros.
    const term = prices.length ? (await cardNames(page))[0]!.split(' ')[0]! : 'Neon'
    await searchFor(page, mobile, term)
    await expect(page).toHaveURL(new RegExp('q=' + term))
    await expect(page).toHaveURL(/categories=/)

    // Refresh mantém tudo; voltar no histórico restaura o estado anterior.
    await page.reload()
    await expect(page).toHaveURL(new RegExp('q=' + term))
    await gridReady(page)
    await page.goBack()
    await expect(page).toHaveURL(filteredUrl)
    await gridReady(page)
    expect(await cardPrices(page)).toEqual(prices)
  })

  test('busca sem resultado mostra estado vazio com ação para limpar', async ({ page, boot }, info) => {
    const mobile = isMobileProject(info.project.name)
    await boot('/')
    await searchFor(page, mobile, 'zzzz-inexistente')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await gridReady(page)
    await expect(cards(page)).toHaveCount(9)
  })

  test('cenário catalog.empty: vazio sem filtros', async ({ page, boot }) => {
    await boot('/', ['catalog.empty'])
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('parâmetros inválidos na URL caem nos padrões e páginas inexistentes são explicadas', async ({ page, boot }) => {
    await boot('/?page=abc&sort=hack&tab=nope&categories=xyz')
    await gridReady(page)
    await expect(cards(page)).toHaveCount(9)
    await page.goto('/?page=999')
    await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeVisible()
    await page.getByRole('button', { name: 'Ir para a primeira página' }).click()
    await expect(page).not.toHaveURL(/page=/)
    await gridReady(page)
  })

  test('falha 5xx mostra erro com retry e recupera', async ({ page, boot, mock }) => {
    await boot('/', ['http.503'])
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
    await mock.setScenarios(['default'])
    await page.getByRole('alert').filter({ hasText: 'carregar o catálogo' }).getByRole('button', { name: 'Tentar novamente' }).click()
    await gridReady(page)
    await expect(cards(page)).toHaveCount(9)
  })

  test('respostas fora de ordem: só vale o resultado da URL atual', async ({ page, boot }) => {
    await page.clock.install()
    await boot('/', ['catalog.out-of-order'])
    // A 1ª requisição (URL "/") demora 2 s; a troca de aba responde em 100 ms e a antiga chega depois.
    await page.getByRole('link', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await gridReady(page)
    const trending = await cardNames(page)
    // Relógio da página avança além dos 2 s da resposta antiga: ela chega agora, e só então comparamos.
    await page.clock.runFor(2600)
    await page.clock.runFor(200)
    expect(await cardNames(page)).toEqual(trending)
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')
  })

  test('nft.updated via socket atualiza o preço do card e é anunciado', async ({ page, boot }) => {
    await boot('/')
    await gridReady(page)
    const card = cards(page).first()
    const id = await card.getAttribute('data-nft-id')
    const name = (await cardNames(page))[0]!
    await page.evaluate((nftId) => window.__mock!.updateNft(nftId!, { price: '7.777' }), id)
    await expect(card.getByTestId('nft-price')).toHaveText('7.777 ETH')
    await expect(page.getByTestId('nft-live-updates')).toContainText(name)
  })
})
