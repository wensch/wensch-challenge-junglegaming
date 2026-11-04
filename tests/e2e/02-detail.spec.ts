/**
 * E2E-02 (TEL-2, DET-1..4, RT-1 no detalhe): acesso direto, NFT inexistente, edição indisponível,
 * limite de quantidade (com erro da API mapeado no campo), adicionar ao carrinho e tempo real.
 */
import { expect, test } from '../fixtures'

// Seed (src/mocks/seed.ts, determinístico): nft_002 "Prisma Boreal" tem 1/10 (ed_002_1) e ABERTA (ed_002_2);
// nft_012 tem 1/1 e 1/50 com a última esgotada; nft_005 está inteiro esgotado.
const heading = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name })

test.describe('detalhe do NFT', () => {
  test('acesso direto mostra galeria, informações e edição; refresh preserva a edição da URL', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(heading(page, 'Prisma Boreal')).toBeVisible()
    await expect(page.getByRole('main').getByRole('img', { name: /Prisma Boreal/ }).first()).toBeVisible()
    await expect(page.getByText('ID do token:')).toBeVisible()
    await expect(page.getByText('Coleção: Lume Fotografia')).toBeVisible()
    const chip = page.getByRole('button', { name: 'ABERTA' })
    await chip.click()
    await expect(page).toHaveURL(/edition=ed_002_2/)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page).toHaveURL(/edition=ed_002_2/)
    await expect(page.getByRole('button', { name: 'ABERTA' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('tab', { name: 'Detalhes do NFT' })).toBeVisible()
    await page.getByRole('tab', { name: /Avaliações de colecionadores/ }).click()
    await expect(page.getByRole('tabpanel')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
  })

  test('NFT inexistente mostra estado próprio com saída; id malformado é 404', async ({ page, boot }) => {
    await boot('/nft/nft_999')
    await expect(heading(page, 'NFT não encontrado')).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/#mercado$|\/$/)
    await page.goto('/nft/%3Cscript%3E')
    await expect(heading(page, 'Página não encontrada')).toBeVisible()
  })

  test('edição esgotada fica indisponível (chip desabilitado, compra bloqueada, texto explica)', async ({ page, boot }) => {
    await boot('/nft/nft_012')
    await expect(heading(page, /\w/)).toBeVisible()
    await expect(page.getByRole('button', { name: /1\/50/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: /1\/50/ })).toContainText('esgotada')
    // Deep link para a edição esgotada: nada de compra, mensagem explícita.
    await page.goto('/nft/nft_012?edition=ed_012_2')
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Comprar/i })).toBeDisabled()
    await expect(page.getByText('Esta edição está esgotada.')).toBeVisible()
  })

  test('NFT totalmente esgotado: não há compra', async ({ page, boot }) => {
    await boot('/nft/nft_005')
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  })

  test('limite de quantidade: stepper, validação no campo e erro da API mapeado ao campo', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    // Estoque determinístico: 3 unidades da 1/10 (maxPerOrder 3).
    await page.evaluate(() => window.__mock!.updateNft('nft_002', { editions: [{ id: 'ed_002_1', available: 3 }] }))
    await page.getByRole('button', { name: '1/10' }).click()
    const qty = page.getByRole('textbox', { name: 'Quantidade' })
    await expect(page.getByText('Máximo de 3 por pedido.')).toBeVisible()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click({ clickCount: 5 })
    await expect(qty).toHaveValue('3')
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()

    // Digitar acima do limite: erro associado ao campo (aria-invalid + aria-describedby).
    await qty.fill('4')
    const error = page.getByRole('alert').filter({ hasText: /limite|unidades/i })
    await expect(error).toBeVisible()
    await expect(qty).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await qty.getAttribute('aria-describedby')
    expect(describedBy).toContain((await error.getAttribute('id'))!)

    // Compra de 3 passa; uma segunda de 1 estoura o estoque no servidor e o erro volta ao campo.
    await qty.fill('3')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText(/no carrinho/).first()).toBeVisible()
    await qty.fill('1')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /unidade|esgot|limite/i })).toBeVisible()
    await expect(qty).toHaveAttribute('aria-invalid', 'true')
  })

  test('visitante adiciona ao carrinho e o badge reflete', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText(/no carrinho/).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Carrinho, 1 item/ }).first()).toBeAttached()
  })

  test('tempo real: preço e disponibilidade mudam na tela e são anunciados', async ({ page, boot }) => {
    await boot('/nft/nft_002')
    await expect(heading(page, 'Prisma Boreal')).toBeVisible()
    await page.evaluate(() => window.__mock!.updateNft('nft_002', { price: '3.21', editions: [{ id: 'ed_002_1', available: 1 }] }))
    await expect(page.getByTestId('nft-live-updates')).toContainText('Prisma Boreal foi atualizado')
    await expect(page.getByTestId('nft-live-updates')).toContainText('3.21 ETH')
    await expect(page.getByTestId('nft-price').first()).toHaveText('3.21 ETH')
    // Esgotou: a edição passa a indisponível sem recarregar.
    await page.evaluate(() => window.__mock!.updateNft('nft_002', { editions: [{ id: 'ed_002_1', available: 0 }, { id: 'ed_002_2', available: 0 }] }))
    await expect(page.getByTestId('nft-live-updates')).toContainText('esgotou')
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  })
})
