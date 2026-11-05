/**
 * Fired on `window` when a request failed because of the transport itself (no connection, or the API URL
 * answered with the app's HTML instead of JSON), not because of what the server said. Anything that can
 * recover the transport (the demo build's mock layer re-activates its service worker) listens to it; the
 * HTTP client knows nothing about who that is.
 */
export const TRANSPORT_FAILURE_EVENT = 'app:transport-failure'

/** Rate limited: a page that fires many requests at once raises one signal, not one per request. */
let lastSignal = 0
export function notifyTransportFailure(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastSignal < 1_000) return
  lastSignal = now
  window.dispatchEvent(new Event(TRANSPORT_FAILURE_EVENT))
}
