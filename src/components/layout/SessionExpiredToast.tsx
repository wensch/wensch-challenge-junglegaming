/**
 * Non-modal notice for a session that expired while the user was on a PUBLIC page (ARCHITECTURE §4).
 * Rendered by the sonner Toaster (inside the router, `aria-live="polite"` container). The "Entrar"
 * link reads the CURRENT location when rendered, so it always resumes where the user is now.
 */
import { Link, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { safeRedirectSchema } from '@/api/contracts'

const TOAST_ID = 'session-expired'

function SessionExpiredMessage() {
  const href = useRouterState({ select: (s) => s.location.href })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const target = pathname === '/login' ? null : safeRedirectSchema.safeParse(href)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm" data-testid="session-expired-toast">
      <span>Sua sessão expirou.</span>
      <Link
        to="/login"
        search={{ reason: 'expired', ...(target?.success ? { redirect: target.data } : {}) }}
        onClick={() => toast.dismiss(TOAST_ID)}
        className="font-semibold text-text-accent underline underline-offset-2"
      >
        Entrar
      </Link>
    </div>
  )
}

/** Shows (once) the "session expired" notice. It stays until dismissed or a new session starts. */
export function showSessionExpiredToast(): void {
  toast(<SessionExpiredMessage />, { id: TOAST_ID, duration: Number.POSITIVE_INFINITY, closeButton: true })
}

export function dismissSessionExpiredToast(): void {
  toast.dismiss(TOAST_ID)
}
