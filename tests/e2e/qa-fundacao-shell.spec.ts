/**
 * QA fundacao: exploratory shell checks (deep links, guard + open redirect, keyboard, out-of-scope links).
 */
import { expect, isMobileProject, test, USERS } from '../fixtures'

const PUBLIC_ROUTES: [string, string | RegExp][] = [
  ['/', 'Mercado de NFTs'],
  ['/cart', /Carrinho|Sacola/i],
  ['/login', 'Entrar'],
  ['/register', /Criar conta|Cadastr/i],
  ['/nft/nft_004', 'Detalhes do NFT'],
  ['/em-breve', 'Esta área'],
  ['/em-breve?secao=ajuda', 'Central de ajuda'],
  ['/em-breve?secao=__proto__', 'Esta área'],
]
const PRIVATE_ROUTES = ['/checkout', '/favorites', '/profile', '/wallets', '/orders/ord_0001']

test.describe('rotas publicas: deep link e refresh', () => {
  for (const [path, heading] of PUBLIC_ROUTES) {
    test(`${path}`, async ({ page, boot }) => {
      await boot(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(heading)
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(heading)
    })
  }
})

test.describe('guard _authed', () => {
  for (const path of PRIVATE_ROUTES) {
    test(`${path} sem sessao -> login com redirect`, async ({ page, boot }) => {
      await boot(path)
      await expect(page).toHaveURL(/\/login\?/)
      const u = new URL(page.url())
      expect(u.searchParams.get('redirect')).toBe(path)
      expect(u.searchParams.get('reason')).toBe('required')
      await page.reload()
      await expect(page).toHaveURL(/\/login\?/)
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
    })
  }

  test('com sessao, cada rota privada abre e refresh mantem', async ({ page, boot }) => {
    await boot('/')
    await page.evaluate(async (c) => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
      const s = (await r.json()) as { token: string; expiresAt: string }
      localStorage.setItem('kurio.session', JSON.stringify({ token: s.token, expiresAt: s.expiresAt }))
    }, USERS.alice)
    for (const p of PRIVATE_ROUTES) {
      await page.goto(p)
      await expect(page).toHaveURL(new RegExp(p.replace(/\//g, '\\/') + '$'))
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.reload()
      await expect(page).toHaveURL(new RegExp(p.replace(/\//g, '\\/') + '$'))
    }
  })

  // BUG-QA-001: a tab-prefixed path passes safeRedirectSchema; URL parsers drop the tab and read '//evil.com'.
  const evil = ['//evil.com', 'https://evil.com', '/\\evil.com', '/\t/evil.com', '///evil.com', 'javascript:alert(1)', '%2F%2Fevil.com', '/%2F/evil.com', '/%5Cevil.com']
  for (const v of evil) {
    test(`login redirect=${JSON.stringify(v)} nao vira destino externo`, async ({ page, boot }) => {
      await boot('/')
      await page.goto(`/login?redirect=${encodeURIComponent(v)}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
      const u = new URL(page.url())
      const r = u.searchParams.get('redirect')
      // Whatever survives must resolve to the same origin when used as a navigation target.
      if (r) expect(new URL(r, u.origin).origin).toBe(u.origin)
    })
  }

  test('deep link privado com path malicioso gera redirect same-origin', async ({ page, boot }) => {
    await boot('/')
    for (const p of ['//evil.com/wallets', '/%2F%2Fevil.com', '/wallets//evil.com']) {
      await page.goto(p)
      const u = new URL(page.url())
      const r = u.searchParams.get('redirect')
      if (r) expect(new URL(r, u.origin).origin).toBe(u.origin)
    }
  })
})

test.describe('links fora de escopo', () => {
  test('nenhum link morto; /em-breve nao aparenta sucesso', async ({ page, boot }) => {
    await boot('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''))
    const bad = hrefs.filter((h) => h === '#' || h === '' || h.startsWith('javascript:'))
    expect(bad, `links mortos: ${bad.join(',')}`).toEqual([])
    const unavailable = [...new Set(hrefs.filter((h) => h.startsWith('/em-breve')))]
    expect(unavailable.length).toBeGreaterThan(5)
    for (const h of unavailable) {
      await page.goto(h)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Nenhuma ação foi realizada')).toBeVisible()
    }
  })

  test('todos os hrefs internos do shell resolvem (sem 404)', async ({ page, boot }) => {
    await boot('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const hrefs = [...new Set(await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href') ?? '')))]
    for (const h of hrefs) {
      await page.goto(h)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      expect(await page.getByRole('heading', { level: 1, name: 'Página não encontrada' }).count(), `404 em ${h}`).toBe(0)
    }
  })
})

test.describe('teclado', () => {
  // BUG-QA-002 (fixed): on a full load the focus stays at the document start; only client-side
  // navigations move it to the <h1>.
  test('primeiro Tab apos carga completa alcanca o skip link', async ({ page, boot }) => {
    await boot('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused({ timeout: 2000 })
  })

  test('skip link e header navegavel por Tab (desktop)', async ({ page, boot }, info) => {
    test.skip(isMobileProject(info.project.name), 'desktop only')
    await boot('/em-breve')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
    await page.goto('/em-breve')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const seen: string[] = []
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      const d = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement
        const r = e.getBoundingClientRect()
        return { tag: e.tagName, name: e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30) || '', visible: r.width > 0 && r.height > 0 }
      })
      expect(d.visible, JSON.stringify(d)).toBe(true)
      expect(d.name, JSON.stringify(d)).not.toBe('')
      seen.push(d.name)
    }
    expect(new Set(seen).size).toBeGreaterThan(5)
  })

  test('tab bar e Sheet por teclado (mobile)', async ({ page, boot }, info) => {
    test.skip(!isMobileProject(info.project.name), 'mobile only')
    await boot('/')
    const trigger = page.getByRole('button', { name: 'Abrir menu' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    const links = page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link')
    const n = await links.count()
    expect(n).toBeGreaterThanOrEqual(3)
    await links.nth(n - 1).focus()
    await expect(links.nth(n - 1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).not.toHaveURL(/^[^?]*\/$/)
  })
})
