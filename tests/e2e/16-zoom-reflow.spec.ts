/**
 * A11Y-7 — zoom 200% e reflow (WCAG 1.4.4, 1.4.10). 200% sobre 1280 px = 640 CSS px; 400% = 320 CSS px
 * (viewport de reflow do WCAG). Em cada tela: sem rolagem horizontal do documento e as ações
 * principais continuam dentro da largura, visíveis e clicáveis (`click({ trial })` exige que nada as cubra).
 */
import type { Locator, Page } from '@playwright/test'
import { expect, loginViaApi, test, USERS } from '../fixtures'
import { addToCart, loginWithCart, pickEditions, setGuestId } from '../s3-helpers'

const VIEWPORTS = [
  { name: 'zoom 200% (640px)', width: 640, height: 450 },
  { name: 'reflow 320px', width: 320, height: 568 },
] as const

async function expectReflow(page: Page, width: number, where: string, actions: Locator[], strictDocument = width > 320) {
  // Emulação mobile a 320 px: o viewport de layout cresce com o rodapé (BUG-QA-012) e o teste de acerto fica impreciso;
  // a cobertura de clique a 320 px vem do projeto desktop.
  const hitTest = !(width === 320 && test.info().project.name === 'mobile')
  await page.evaluate(() => document.fonts.ready)
  const m = await page.evaluate(() => {
    const d = document.documentElement
    // Conteúdo fora do rodapé: o rodapé em 320 px é o BUG-QA-012 (teste fixme abaixo), não esconde o resto.
    // A barra inferior fixa acompanha o viewport de layout (que cresce com o rodapé, BUG-QA-012).
    // Itens dentro de uma região com rolagem/recorte próprio (carrossel) podem passar da largura por desenho.
    const clipped = (e: Element) => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return true
      return false
    }
    const culprit = [...document.body.querySelectorAll('*')].find((e) => !e.closest('footer') && !e.closest('nav.fixed') && !clipped(e) && e.getBoundingClientRect().right > d.clientWidth + 1)
    return { sw: d.scrollWidth, cw: d.clientWidth, culprit: culprit ? `<${culprit.tagName.toLowerCase()} class="${culprit.getAttribute('class')}">` : null }
  })
  expect(m.culprit, `${where}: conteúdo passa de ${m.cw}px`).toBeNull()
  if (strictDocument) expect(m.sw, `${where}: scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw)
  for (const a of actions) {
    // Centraliza: a barra inferior fixa cobre o rodapé do viewport e o usuário pode rolar até expor o botão.
    await a.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect(a).toBeVisible()
    const box = (await a.boundingBox())!
    expect(box.x, `${where}: ${String(a)} cortado à esquerda`).toBeGreaterThanOrEqual(-0.5)
    expect(box.x + box.width, `${where}: ${String(a)} cortado à direita`).toBeLessThanOrEqual(width + 0.5)
    if (hitTest) await a.click({ trial: true, timeout: 5_000 }) // falha se outro elemento cobrir o botão
  }
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
    })

    test('telas públicas: início, detalhe e login', async ({ page, boot }) => {
      await boot('/')
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await expect(page.getByTestId('nft-card').first()).toBeVisible()
      await expectReflow(page, vp.width, '/', [page.getByTestId('nft-card').first().getByRole('link').first()])

      await page.goto('/nft/nft_001')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectReflow(page, vp.width, '/nft/nft_001', [page.getByRole('button', { name: 'Adicionar ao carrinho' })])

      await page.goto('/login')
      await expect(page.getByRole('main').getByLabel('E-mail')).toBeVisible()
      await expectReflow(page, vp.width, '/login', [page.getByRole('main').getByLabel('E-mail'), page.getByRole('button', { name: 'Entrar', exact: true })])
    })

    test('carrinho e pagamento', async ({ page, boot }) => {
      await boot('/')
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const [a] = await pickEditions(page, 1)
      await addToCart(page, { guestId: await setGuestId(page) }, a!, 1)
      await page.goto('/cart')
      await expect(page.getByTestId('cart-total')).toBeVisible()
      await expectReflow(page, vp.width, '/cart', [page.getByRole('main').getByRole('link', { name: 'Conectar e finalizar' })])

      await loginWithCart(page, [{ item: a!, quantity: 1 }])
      await page.goto('/checkout')
      await expect(page.getByTestId('checkout-total')).toBeVisible()
      await expectReflow(page, vp.width, '/checkout', [
        page.getByTestId('checkout-form').getByLabel('Nome de exibição'),
        page.getByRole('button', { name: 'Conectar carteira', exact: true }),
        page.getByRole('button', { name: 'Confirmar compra' }),
      ])
    })

    test('perfil e lista de interesse', async ({ page, boot }) => {
      await boot('/')
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await loginViaApi(page, USERS.alice)
      await page.goto('/profile')
      await expect(page.getByRole('main').getByLabel('E-mail')).toBeVisible()
      await expectReflow(page, vp.width, '/profile', [page.getByRole('main').getByRole('button', { name: 'Salvar', exact: true })])

      await page.goto('/favorites')
      await expect(page.getByTestId('favorite-item').first()).toBeVisible()
      await expectReflow(page, vp.width, '/favorites', [
        page.getByTestId('favorite-item').first().getByRole('link').first(),
        page.getByRole('button', { name: /^Remover .* da lista de interesse$/ }).first(),
      ])
    })
  })
}

// BUG-QA-012: o rodapé tem largura mínima de 360 px; em 320 px todas as telas ganham rolagem horizontal.
test.fixme('reflow 320px: o documento inteiro (rodapé incluso) não rola na horizontal (BUG-QA-012)', async ({ page, boot }) => {
  await boot('/')
  await page.setViewportSize({ width: 320, height: 568 })
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
  await expectReflow(page, 320, '/', [], true)
})
