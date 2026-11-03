import { http, HttpResponse } from 'msw'
import { emitToClients } from './realtime'

export const restHandlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true, source: 'msw' })),
  http.post('/api/spike/price-change', () => {
    emitToClients('nft.updated', { id: 'evt-1', resource: 'nft:1', version: 2, data: { price: '1.25' } })
    return HttpResponse.json({ emitted: true })
  }),
]
