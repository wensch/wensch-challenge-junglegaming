/**
 * Real app entry (imported by main.tsx only after the MSW worker started).
 * Wires QueryClient + Router (context), the session-expiry flow and React StrictMode.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { setSessionExpiredHandler } from '@/api/client'
import { safeRedirectSchema } from '@/api/contracts'
import { createQueryClient } from '@/queries/client'
import { teardownSession } from '@/queries/session'
import { createAppRouter } from '@/router'
import { RouterProvider } from '@tanstack/react-router'

export function bootstrap(el: HTMLElement) {
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)

  // 401 SESSION_EXPIRED on any private call (fired once per token): teardown, then login with
  // a safe redirect back to where the user was (ARCHITECTURE §4).
  setSessionExpiredHandler(() => {
    const { pathname, href } = router.state.location
    void teardownSession(queryClient, 'expired').then(() => {
      if (pathname === '/login') return
      const target = safeRedirectSchema.safeParse(href)
      void router.navigate({ to: '/login', search: { reason: 'expired', ...(target.success ? { redirect: target.data } : {}) } })
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
