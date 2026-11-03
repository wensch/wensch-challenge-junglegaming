import { http, HttpResponse } from 'msw'
import { errorBody, type ApiErrorCode } from '@/api/contracts'
import { API_BASE } from '../http'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { walletHandlers } from './wallets'

// Order matters: `/nfts/featured` is declared before `/nfts/:nftId` in the endpoint table.
const apiHandlers = [...authHandlers, ...catalogHandlers, ...cartHandlers, ...orderHandlers, ...profileHandlers, ...walletHandlers]

const unknownRoute = http.all(`${API_BASE}/*`, ({ request }) => {
  const { body, status } = errorBody<ApiErrorCode>({ code: 'NOT_FOUND', message: `Rota desconhecida: ${new URL(request.url).pathname}` })
  return HttpResponse.json(body, { status })
})

export const restHandlers = [...apiHandlers, unknownRoute]
