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
import { cachedSession, syncSessionWithStorage, teardownSession } from '@/queries/session'
import { createAppRouter } from '@/router'
import { subscribeSession } from '@/session/store'

export function bootstrap(el: HTMLElement) {
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)

  // Focus management: only client-side navigations move focus to the page title (a full load keeps
  // the document start, so the first Tab reaches the skip link).
  router.subscribe('onBeforeNavigate', (e) => {
    if (e.fromLocation) markClientNavigation()
  })

  // 401 with the CURRENT Bearer token on a private call (fired once per token):
  //  - SESSION_EXPIRED: teardown, then login with a safe redirect back to where the user was;
  //  - UNAUTHENTICATED: token revoked/unknown -> teardown and re-run guards (private routes redirect).
  setSessionInvalidHandler((reason) => {
    const { pathname, href } = router.state.location
    void teardownSession(queryClient, reason).then(() => {
      if (reason === 'unauthenticated') return router.invalidate()
      if (pathname === '/login') return
      const target = safeRedirectSchema.safeParse(href)
      return router.navigate({ to: '/login', search: { reason: 'expired', ...(target.success ? { redirect: target.data } : {}) } })
    })
  })

  // Session changed in storage (another tab logged out / in, or this tab dropped a token): align the
  // cache, the socket and the guards with it. Deferred to a microtask so in-tab flows that write the
  // storage and the cache back-to-back (establishSession, teardown) are seen in their final state.
  subscribeSession(() => {
    queueMicrotask(() => {
      const before = cachedSession(queryClient)
      void syncSessionWithStorage(queryClient).then((after) => {
        if ((before?.token ?? null) !== (after?.token ?? null)) void router.invalidate()
      })
    })
  })

  createRoot(el).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
