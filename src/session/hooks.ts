/**
 * Session actions for components (ARCHITECTURE §4). Presentation components call these hooks and
 * never orchestrate teardown/merge/navigation themselves. Both actions are protected against double
 * submission: concurrent calls share the same in-flight promise.
 */
import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import type { Session } from '@/api/contracts'
import { establishSessionAndMergeCart, logoutSession, type EstablishResult } from '@/queries/session'

export { useGuestId } from './useGuestId'

/** Explicit logout: teardown (socket, private cache, token, drafts) and back to the home page. */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isPending, setPending] = useState(false)
  const inflight = useRef<Promise<void> | null>(null)

  const logout = useCallback(() => {
    inflight.current ??= (async () => {
      setPending(true)
      try {
        await logoutSession(queryClient)
        await navigate({ to: '/' })
      } finally {
        inflight.current = null
        setPending(false)
      }
    })()
    return inflight.current
  }, [queryClient, navigate])

  return { logout, isPending }
}

/**
 * Login/register completion: stores the session, merges the visitor cart into the user's cart
 * (`POST /cart/merge`), drops the guest id and `['guest']` queries, then `router.invalidate()` so
 * guards and loaders re-run with the new identity. The caller navigates (to the safe `redirect`).
 */
export function useEstablishSession() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isPending, setPending] = useState(false)
  const inflight = useRef<Promise<EstablishResult> | null>(null)

  const establish = useCallback(
    (session: Session) => {
      inflight.current ??= (async () => {
        setPending(true)
        try {
          const result = await establishSessionAndMergeCart(queryClient, session)
          await router.invalidate()
          return result
        } finally {
          inflight.current = null
          setPending(false)
        }
      })()
      return inflight.current
    },
    [queryClient, router],
  )

  return { establish, isPending }
}
