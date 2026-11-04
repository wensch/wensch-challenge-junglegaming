/**
 * Real app entry (imported by main.tsx only after the MSW worker started).
 * Wires QueryClient + Router (context), the session lifecycle (expiry, revocation, other tabs) and
 * React StrictMode.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { setSessionInvalidHandler } from '@/api/client'
import { safeRedirectSchema } from '@/api/contracts'
import { markClientNavigation } from '@/lib/navigation'
import { createQueryClient } from '@/queries/client'
import { cachedSession, isPastExpiry, syncSessionWithStorage, teardownSession } from '@/queries/session'
import { createAppRouter } from '@/router'
import { readStoredSession, subscribeSession } from '@/session/store'

/** Largest delay `setTimeout` accepts (2^31 − 1 ms ≈ 24.8 days); longer TTLs re-arm on fire. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1

/** Returns a cleanup that removes the session listeners and the expiry timer (tests/HMR). */
export function bootstrap(el: HTMLElement): () => void {
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)

  // Focus management: only client-side navigations move focus to the page title (a full load keeps
  // the document start, so the first Tab reaches the skip link).
  router.subscribe('onBeforeNavigate', (e) => {
    if (e.fromLocation) markClientNavigation()
  })

  const onPrivateRoute = () => router.state.matches.some((m) => m.routeId.startsWith('/_authed'))

  // 401 with the CURRENT Bearer token on a private call:
  //  - SESSION_EXPIRED: teardown `expired` (drafts of the user kept), then login with a safe redirect
  //    back to where the user was. On a PUBLIC page a background read (GET: refetch on focus or after a
  //    socket reconnection) does not interrupt the browsing: the flow runs on the next user action
  //    (mutation, or navigation to a private route, which the guard handles with `reason=expired`);
  //  - UNAUTHENTICATED: token revoked/unknown -> teardown and re-run guards (private routes redirect).
  setSessionInvalidHandler((reason, { method }) => {
    if (reason === 'expired' && method === 'get' && !onPrivateRoute()) return false
    const { pathname, href } = router.state.location
    void teardownSession(queryClient, reason).then(() => {
      if (reason === 'unauthenticated') return router.invalidate()
      if (pathname === '/login') return
      const target = safeRedirectSchema.safeParse(href)
      return router.navigate({ to: '/login', search: { reason: 'expired', ...(target.success ? { redirect: target.data } : {}) } })
    })
    return true
  })

  // Natural expiry by the local clock (ARCHITECTURE §4): a timer armed at `expiresAt` runs the flow
  // BEFORE the next request. On a private route (checkout!) the guards re-run: `syncSessionWithStorage`
  // does the `expired` teardown and `_authed` redirects to /login?reason=expired&redirect=<current>.
  // On a public page nothing is interrupted; the next private navigation or mutation runs the flow.
  // Re-armed whenever the session changes and when the tab becomes visible (timers are throttled or
  // frozen in background tabs and while the machine sleeps).
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  const onLocalExpiry = () => {
    const cached = cachedSession(queryClient)
    if (!cached || !isPastExpiry(cached.expiresAt)) return
    if (onPrivateRoute()) void router.invalidate()
  }
  const armExpiryTimer = () => {
    clearTimeout(expiryTimer)
    expiryTimer = undefined
    const stored = readStoredSession()
    if (!stored) return
    const delay = Date.parse(stored.expiresAt) - Date.now()
    if (delay <= 0) {
      onLocalExpiry()
      return
    }
    // Clamped: a longer delay would overflow and fire immediately; on fire it simply re-arms.
    expiryTimer = setTimeout(armExpiryTimer, Math.min(delay, MAX_TIMER_DELAY_MS))
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') armExpiryTimer()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // Session changed in storage (another tab logged out / in, or this tab dropped a token): align the
  // cache, the socket and the guards with it. Deferred to a microtask so in-tab flows that write the
  // storage and the cache back-to-back (establishSession, teardown) are seen in their final state.
  const unsubscribeSession = subscribeSession(() => {
    queueMicrotask(() => {
      armExpiryTimer()
      const before = cachedSession(queryClient)
      void syncSessionWithStorage(queryClient).then((after) => {
        if ((before?.token ?? null) !== (after?.token ?? null)) void router.invalidate()
      })
    })
  })

  armExpiryTimer()

  const root = createRoot(el)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )

  return () => {
    clearTimeout(expiryTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribeSession()
    setSessionInvalidHandler(null)
    root.unmount()
  }
}
