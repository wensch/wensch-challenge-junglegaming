import { http, HttpResponse } from 'msw'
import { errorBody, type ApiErrorCode } from '@/api/contracts'
import { emitRaw } from '../realtime'
import { API_BASE } from '../http'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { walletHandlers } from './wallets'

// Order matters: `/nfts/featured` is declared before `/nfts/:nftId` in the endpoint table.
const apiHandlers = [...authHandlers, ...catalogHandlers, ...cartHandlers, ...orderHandlers, ...profileHandlers, ...walletHandlers]

// Diagnostics kept for the bootstrap spike test (to be removed with 00-spike.spec.ts).
const diagnostics = [
  http.get(`${API_BASE}/health`, () => HttpResponse.json({ ok: true, source: 'msw' })),
  http.post(`${API_BASE}/spike/price-change`, () => {
    emitRaw('nft.updated', { id: 'evt-1', resource: 'nft:1', version: 2, data: { price: '1.25' } })
    return HttpResponse.json({ emitted: true })
  }),
]

const unknownRoute = http.all(`${API_BASE}/*`, ({ request }) => {
  const { body, status } = errorBody<ApiErrorCode>({ code: 'NOT_FOUND', message: `Rota desconhecida: ${new URL(request.url).pathname}` })
  return HttpResponse.json(body, { status })
})

export const restHandlers = [...apiHandlers, ...diagnostics, unknownRoute]
