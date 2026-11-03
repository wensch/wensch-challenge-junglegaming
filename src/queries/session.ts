/**
 * Session query and lifecycle helpers (ARCHITECTURE §4, §9).
 * `['session']` holds `Session | null`; `null` = visitor. It is the single source for "who is logged".
 */
import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { isApiError, type Session } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { realtime } from '@/realtime/socket'
import { clearStoredSession, clearUserDrafts, getToken, setStoredSession } from '@/session/store'
import { STALE } from './client'
import { queryKeys } from './keys'

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session(),
    queryFn: async ({ signal }): Promise<Session | null> => {
      if (!getToken()) return null
      try {
        // Silent: an expired token at boot just means "visitor", not the re-authentication flow.
        return await authApi.getSession({ signal, silentSessionExpiry: true })
      } catch (e) {
        if (isApiError(e) && (e.is('UNAUTHENTICATED') || e.is('SESSION_EXPIRED'))) {
          clearStoredSession()
          return null
        }
        throw e
      }
    },
    staleTime: STALE.session,
    gcTime: Number.POSITIVE_INFINITY,
  })

export function useSession() {
  return useQuery(sessionQueryOptions())
}

/** Current user id from the cache (no fetch). */
export function currentUserId(queryClient: QueryClient): string | null {
  return queryClient.getQueryData(sessionQueryOptions().queryKey)?.user.id ?? null
}

export type TeardownReason = 'logout' | 'expired' | 'switch'

/**
 * Removes every trace of the current user (order matters):
 * socket off -> cancel in-flight private queries -> remove `['u']` -> drop token and `['session']`
 * -> drafts (kept on expiry so the same user resumes the checkout) -> best-effort POST /auth/logout.
 */
export async function teardownSession(queryClient: QueryClient, reason: TeardownReason): Promise<void> {
  const token = getToken()
  const userId = currentUserId(queryClient)

  realtime.stop()
  await queryClient.cancelQueries({ queryKey: queryKeys.allPrivate() })
  queryClient.removeQueries({ queryKey: queryKeys.allPrivate() })
  clearStoredSession()
  queryClient.setQueryData(sessionQueryOptions().queryKey, null)

  if (reason === 'expired' && userId) clearUserDrafts(userId)
  else clearUserDrafts()

  if (reason === 'logout' && token) {
    authApi.logout({ token }).catch(() => {
      /* best effort: the local session is already gone */
    })
  }
}

/**
 * Stores a new session (login/register). A different previous user is torn down first, and drafts
 * of any other user are discarded. Guest-cart merge is the caller's responsibility (POST /cart/merge).
 */
export async function establishSession(queryClient: QueryClient, session: Session): Promise<void> {
  const previous = currentUserId(queryClient)
  if (previous && previous !== session.user.id) await teardownSession(queryClient, 'switch')
  clearUserDrafts(session.user.id)
  setStoredSession({ token: session.token, expiresAt: session.expiresAt })
  queryClient.setQueryData(sessionQueryOptions().queryKey, session)
}
