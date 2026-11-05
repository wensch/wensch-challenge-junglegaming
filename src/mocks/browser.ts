import { setupWorker } from 'msw/browser'
import { installControl } from './control'
import { loadPersisted, setDb } from './db'
import { TRANSPORT_FAILURE_EVENT } from '@/api/transport-events'
import { PING_PATH, restHandlers } from './handlers'
import { API_BASE } from './http'
import { resumePendingOrders } from './orders'
import { realtimeHandlers } from './realtime'
import { initScenarios } from './scenario-state'

export const worker = setupWorker(...restHandlers, ...realtimeHandlers)

/**
 * Boots the simulated backend: scenarios (URL / localStorage) -> DB (persisted or seeded) -> worker.
 * Must finish BEFORE the app (and socket.io-client) is imported: engine.io captures globalThis.WebSocket at load.
 */
export async function startMocks(): Promise<void> {
  initScenarios()
  // The seed (lazy chunk, async password hashing) and the worker registration run in parallel; the DB is
  // set before the app can fire its first request (the app is only imported after this function returns).
  const persisted = loadPersisted()
  const seeding = persisted ? Promise.resolve(persisted) : import('./seed').then((m) => m.buildSeed())
  const [db] = await Promise.all([seeding, worker.start({ onUnhandledRequest: 'bypass', quiet: true })])
  setDb(db)
  resumePendingOrders()
  if (!(await ensureControlled())) {
    // A reload is in flight: never resolve, so the app does not boot in an uncontrolled document.
    await new Promise<never>(() => {})
  }
  installControl()
  watchWorker()
}

const HEALTH_INTERVAL_MS = 8_000
const FULL_RESTART_COOLDOWN_MS = 60_000
let reviving: Promise<boolean> | null = null
let lastFullRestart = 0

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Keeps the simulated backend answering for the whole session, not only at boot.
 *
 * The browser stops an idle service worker (and freezes background timers, so MSW's own 5 s keep-alive stops
 * too). The restarted worker starts with an EMPTY list of active clients and lets every /api request through
 * to the network, where the SPA rewrite answers with HTML: screens fall into an error state until a reload.
 * Re-activating this client is the same message MSW posts at start (`MOCK_ACTIVATE`, see
 * public/mockServiceWorker.js); it does not touch the WebSocket interception, so a live socket survives.
 * A full stop/start is the last resort (rate limited so a failure scenario cannot make it loop).
 */
export function reviveWorker(): Promise<boolean> {
  reviving ??= (async () => {
    if (await swAnswers()) return true
    navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
    for (let i = 0; i < 10; i++) {
      await sleep(100)
      if (await swAnswers()) return true
    }
    if (Date.now() - lastFullRestart < FULL_RESTART_COOLDOWN_MS) return false
    lastFullRestart = Date.now()
    await worker.stop()
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
    return swAnswers()
  })()
    .catch(() => false)
    .finally(() => {
      reviving = null
    })
  return reviving
}

/** When to check: the tab comes back, the connection returns, the HTTP client reports a transport failure, and every few seconds while visible. */
function watchWorker(): void {
  const check = () => {
    if (document.visibilityState === 'visible') void reviveWorker()
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('pageshow', check)
  window.addEventListener('online', check)
  window.addEventListener('focus', check)
  window.addEventListener(TRANSPORT_FAILURE_EVENT, () => void reviveWorker())
  window.setInterval(check, HEALTH_INTERVAL_MS)
}

const RELOAD_FLAG = '__mock_sw_reload'
const CONTROLLER_TIMEOUT_MS = 3000

/** True when the service worker answers this document's requests (a controller can exist before MSW registers the client). */
async function swAnswers(): Promise<boolean> {
  if (!navigator.serviceWorker.controller) return false
  try {
    const res = await fetch(`${API_BASE}${PING_PATH}`, { cache: 'no-store' })
    return res.ok && (await res.text()) === 'mock-pong'
  } catch {
    return false
  }
}

/**
 * A document navigated while the previous document's worker was still starting can end up without a service
 * worker controller, or controlled by a worker that has not registered this client yet; its /api calls would
 * then hit the network. Wait (controllerchange / short polling, up to 3 s) until a probe is answered by the
 * mock; otherwise reload once (sessionStorage flag prevents loops). Returns false when a reload was triggered.
 */
async function ensureControlled(): Promise<boolean> {
  const sw = navigator.serviceWorker
  const deadline = Date.now() + CONTROLLER_TIMEOUT_MS
  for (;;) {
    if (await swAnswers()) {
      clearFlag()
      return true
    }
    if (Date.now() >= deadline) break
    await new Promise<void>((resolve) => {
      const done = () => {
        sw.removeEventListener('controllerchange', done)
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, 100)
      sw.addEventListener('controllerchange', done)
    })
  }
  let already: boolean
  try {
    already = sessionStorage.getItem(RELOAD_FLAG) === '1'
    if (!already) sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    already = true
  }
  if (already) {
    console.warn('[mocks] service worker is not controlling this document; continuing uncontrolled')
    return true
  }
  location.reload()
  return false
}

function clearFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* storage unavailable */
  }
}
