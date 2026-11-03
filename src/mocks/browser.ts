import { setupWorker } from 'msw/browser'
import { installControl } from './control'
import { loadPersisted, setDb } from './db'
import { restHandlers } from './handlers'
import { resumePendingOrders } from './orders'
import { realtimeHandlers } from './realtime'
import { initScenarios } from './scenario-state'
import { buildSeed } from './seed'

export const worker = setupWorker(...restHandlers, ...realtimeHandlers)

/**
 * Boots the simulated backend: scenarios (URL / localStorage) -> DB (persisted or seeded) -> worker.
 * Must finish BEFORE the app (and socket.io-client) is imported: engine.io captures globalThis.WebSocket at load.
 */
export async function startMocks(): Promise<void> {
  initScenarios()
  setDb(loadPersisted() ?? (await buildSeed()))
  resumePendingOrders()
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  installControl()
}
