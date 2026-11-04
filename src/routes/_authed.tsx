import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirectSchema } from '@/api/contracts'
import { cachedSession, sessionExpiredRecently, sessionQueryOptions, syncSessionWithStorage } from '@/queries/session'
import { getToken, readStoredSession } from '@/session/store'

/**
 * Pathless layout guarding private routes (checkout, pedidos, perfil, carteiras, favoritos).
 * The cached session is trusted only if its token is still the stored one (another tab may have
 * logged out or switched user) and it has not expired by the local clock: `syncSessionWithStorage`
 * runs first and, on natural expiry, performs the `expired` teardown (drafts of the user kept).
 * Without a session -> /login?redirect=<target href>&reason=expired|required (`expired` when the last
 * session of this tab ended by expiry). The redirect target is validated with the same schema the
 * login route uses, so an unsafe value is simply dropped.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location, preload }) => {
    const toLogin = () => {
      const target = safeRedirectSchema.safeParse(location.href)
      return redirect({
        to: '/login',
        search: { reason: sessionExpiredRecently() ? 'expired' : 'required', ...(target.success ? { redirect: target.data } : {}) },
      })
    }
    // Preload (`defaultPreload: 'intent'`, hover/touch on a link) must have NO side effects: tearing
    // the session down here would make the link the user is about to click disappear (and the
    // redirect of a preload is discarded). The real navigation runs the full check below.
    if (preload) {
      const cached = cachedSession(context.queryClient)
      const stored = readStoredSession()
      if (!cached || !stored || stored.expired || cached.token !== stored.token) throw toLogin()
      return { session: cached }
    }
    await syncSessionWithStorage(context.queryClient)
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session || session.token !== getToken()) throw toLogin()
    return { session }
  },
  component: Outlet,
})
