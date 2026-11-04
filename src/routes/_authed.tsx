import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirectSchema } from '@/api/contracts'
import { sessionQueryOptions, syncSessionWithStorage } from '@/queries/session'
import { getToken } from '@/session/store'

/**
 * Pathless layout guarding private routes (checkout, pedidos, perfil, carteiras, favoritos).
 * Without a session -> /login?redirect=<current href>&reason=required. The redirect target is
 * validated with the same schema the login route uses, so an unsafe value is simply dropped.
 * The cached session is trusted only if its token is still the stored one (another tab may have
 * logged out or switched user): otherwise the session is re-synchronized first.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    await syncSessionWithStorage(context.queryClient)
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session || session.token !== getToken()) {
      const target = safeRedirectSchema.safeParse(location.href)
      throw redirect({
        to: '/login',
        search: { reason: 'required', ...(target.success ? { redirect: target.data } : {}) },
      })
    }
    return { session }
  },
  component: Outlet,
})
