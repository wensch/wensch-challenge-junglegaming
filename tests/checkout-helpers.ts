/**
 * Helpers of the checkout specs. State is prepared through the REAL REST endpoints (MSW handlers) with
 * `fetch` inside the page; everything asserted afterwards is observed in the UI.
 */
import type { Page } from '@playwright/test'
import { expect, loginViaApi, USERS } from './fixtures'

export interface Seeded {
  nftId: string
  editionId: string
  name: string
  price: string
  available: number
  maxPerOrder: number
}

/** First NFTs with an edition that has room for `minAvailable` units (deterministic seed order). */
export async function pickEditions(page: Page, count: number, minAvailable = 3): Promise<Seeded[]> {
  return page.evaluate(
    async ([n, min]) => {
      const out: Seeded[] = []
      for (let i = 1; i <= 36 && out.length < n; i++) {
        const id = `nft_${String(i).padStart(3, '0')}`
        const r = await fetch(`/api/nfts/${id}`)
        if (!r.ok) continue
        const d = (await r.json()) as { id: string; name: string; editions: { id: string; price: string; available: number; maxPerOrder: number }[] }
        const e = d.editions.find((x) => x.available >= min && x.maxPerOrder >= min)
        if (e) out.push({ nftId: d.id, editionId: e.id, name: d.name, price: e.price, available: e.available, maxPerOrder: e.maxPerOrder })
      }
      return out
    },
    [count, minAvailable] as const,
  )
}

export type Auth = { token: string } | { guestId: string }

const headersOf = (auth: Auth) => ('token' in auth ? { Authorization: `Bearer ${auth.token}` } : { 'X-Guest-Id': auth.guestId })

export async function addToCart(page: Page, auth: Auth, item: Seeded, quantity: number) {
  const status = await page.evaluate(
    async ([h, body]) => {
      const r = await fetch('/api/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) })
      return r.status
    },
    [headersOf(auth), { nftId: item.nftId, editionId: item.editionId, quantity }] as const,
  )
  if (status !== 200) throw new Error(`addToCart failed: ${status}`)
}

/** Visitor id the app would create (`kurio.guestId`), stored so the UI sees the same guest cart. */
export async function setGuestId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const id = crypto.randomUUID()
    localStorage.setItem('kurio.guestId', id)
    return id
  })
}

/** Logs alice in (real endpoint) with a cart of the given items; the page is on `/` afterwards. */
export async function loginWithCart(page: Page, items: { item: Seeded; quantity: number }[]) {
  const session = await loginViaApi(page, USERS.alice)
  for (const { item, quantity } of items) await addToCart(page, { token: session.token }, item, quantity)
  return session
}

/** Updates a NFT through the simulated server (REST state AND the `nft.updated` event). */
export async function updateNft(page: Page, nftId: string, patch: { price?: string; editions?: { id: string; price?: string; available?: number }[] }) {
  await page.evaluate(([id, p]) => window.__mock!.updateNft(id, p), [nftId, patch] as const)
}

export async function connectWallet(page: Page) {
  // A connection kept in the checkout draft is restored on return: connect only when needed.
  if ((await page.getByTestId('wallet-status').getAttribute('data-state')) === 'connected') return
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await expect(page.getByTestId('wallet-status')).toHaveAttribute('data-state', 'connected')
}

export async function sendOrder(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
}

