import { setupWorker } from 'msw/browser'
import { restHandlers } from './handlers'
import { realtimeHandlers, emitToClients, dropConnections } from './realtime'

export const worker = setupWorker(...restHandlers, ...realtimeHandlers)

// Test/demo control surface lives in the mock layer only.
declare global {
  interface Window {
    __mock?: { emit: typeof emitToClients; drop: typeof dropConnections }
  }
}
window.__mock = { emit: emitToClients, drop: dropConnections }
