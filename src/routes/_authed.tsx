import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirectSchema } from '@/api/contracts'
import { sessionQueryOptions } from '@/queries/session'

/**
 * Pathless layout guarding private routes (checkout, pedidos, perfil, carteiras, favoritos).
 * Without a session -> /login?redirect=<current href>&reason=required. The redirect target is
 * validated with the same schema the login route uses, so an unsafe value is simply dropped.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session) {
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
