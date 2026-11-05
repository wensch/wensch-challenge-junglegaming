import { http, HttpResponse } from 'msw'
import { errorBody, type ApiErrorCode } from '@/api/contracts'
import { API_BASE } from '../http'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { contentHandlers } from './content'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { walletHandlers } from './wallets'

// Order matters: `/nfts/featured` is declared before `/nfts/:nftId` in the endpoint table.
const apiHandlers = [...authHandlers, ...catalogHandlers, ...contentHandlers, ...cartHandlers, ...orderHandlers, ...profileHandlers, ...walletHandlers]

/** Probe used by `startMocks` to prove the service worker is really answering this document's requests. */
export const PING_PATH = '/__mock/ping'
const ping = http.get(`${API_BASE}${PING_PATH}`, () => new HttpResponse('mock-pong', { status: 200, headers: { 'Content-Type': 'text/plain' } }))

const unknownRoute = http.all(`${API_BASE}/*`, ({ request }) => {
  const { body, status } = errorBody<ApiErrorCode>({ code: 'NOT_FOUND', message: `Rota desconhecida: ${new URL(request.url).pathname}` })
  return HttpResponse.json(body, { status })
})

export const restHandlers = [ping, ...apiHandlers, unknownRoute]
