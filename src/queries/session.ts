/**
 * Session query and lifecycle helpers (ARCHITECTURE §4, §9).
 * `['session']` holds `Session | null`; `null` = visitor. It is the single source for "who is logged".
 *
 * Invariant kept by this module: the token inside the cached `['session']` is the token stored in
 * `kurio.session`. Whenever they diverge (logout/login in another tab, token dropped after a 401)
 * `syncSessionWithStorage` tears the old session down and resolves the new one.
 */
import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { isApiError, type MergeCartResponse, type Session } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { realtime } from '@/realtime/socket'
import { clearGuestId, clearStoredSession, clearUserDrafts, getToken, peekGuestId, setStoredSession } from '@/session/store'
import { STALE } from './client'
import { queryKeys } from './keys'

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session(),
    queryFn: async ({ signal }): Promise<Session | null> => {
      // The token is read ONCE and bound to the request: the cached session always carries the
      // token it was resolved with (compared against storage by syncSessionWithStorage).
      const token = getToken()
      if (!token) return null
      try {
        // Silent: an expired token at boot just means "visitor", not the re-authentication flow.
        return await authApi.getSession({ signal, silentSessionExpiry: true, as: { token } })
      } catch (e) {
        if (isApiError(e) && (e.is('UNAUTHENTICATED') || e.is('SESSION_EXPIRED'))) {
          // Drop only the token that was checked (another tab may have stored a new one meanwhile).
          if (getToken() === token) clearStoredSession()
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

/** Current session from the cache (no fetch). */
export function cachedSession(queryClient: QueryClient): Session | null | undefined {
  return queryClient.getQueryData(sessionQueryOptions().queryKey)
}

/** Current user id from the cache (no fetch). */
export function currentUserId(queryClient: QueryClient): string | null {
  return cachedSession(queryClient)?.user.id ?? null
}

/**
 * - `logout`: explicit action (token dropped, best-effort POST /auth/logout, every draft removed);
 * - `expired`: 401 SESSION_EXPIRED (drafts of the same user kept so the checkout resumes);
 * - `unauthenticated`: 401 UNAUTHENTICATED with a Bearer (token revoked/unknown);
 * - `switch`: another user is about to be stored in this tab;
 * - `external`: storage changed in ANOTHER tab — storage already holds the new state, so it is left alone.
 */
export type TeardownReason = 'logout' | 'expired' | 'unauthenticated' | 'switch' | 'external'

/**
 * Removes every trace of the current user (order matters):
 * socket off -> cancel in-flight private queries -> remove `['u']` -> drop token and `['session']`
 * -> drafts (kept on expiry so the same user resumes the checkout) -> best-effort POST /auth/logout.
 */
export async function teardownSession(queryClient: QueryClient, reason: TeardownReason): Promise<void> {
  const session = cachedSession(queryClient)
  const token = session?.token ?? getToken()
  const userId = session?.user.id ?? null

  realtime.stop()
  await queryClient.cancelQueries({ queryKey: queryKeys.allPrivate() })
  queryClient.removeQueries({ queryKey: queryKeys.allPrivate() })
  if (reason !== 'external' && (!token || getToken() === token)) clearStoredSession()
  queryClient.setQueryData(sessionQueryOptions().queryKey, null)

  if ((reason === 'expired' || reason === 'unauthenticated') && userId) clearUserDrafts(userId)
  else clearUserDrafts()

  if (reason === 'logout' && token) {
    authApi.logout({ token }).catch(() => {
      /* best effort: the local session is already gone */
    })
  }
}

let logoutInFlight: Promise<void> | null = null

/** Explicit logout; concurrent calls (double click, two menus) share the same teardown. */
export function logoutSession(queryClient: QueryClient): Promise<void> {
  logoutInFlight ??= teardownSession(queryClient, 'logout').finally(() => {
    logoutInFlight = null
  })
  return logoutInFlight
}

let syncChain: Promise<unknown> = Promise.resolve()

/**
 * Re-aligns `['session']` (and everything private) with the token in storage. Serialized: changes
 * arriving while a sync runs are handled by the next run. Resolves with the current session.
 */
export function syncSessionWithStorage(queryClient: QueryClient): Promise<Session | null> {
  const run = async (): Promise<Session | null> => {
    const key = sessionQueryOptions().queryKey
    const stored = getToken()
    const cached = cachedSession(queryClient)

    if (cached === undefined) {
      // Boot still resolving. If it is fetching with another token, restart it with the current one.
      if (queryClient.isFetching({ queryKey: key }) > 0) {
        await queryClient.cancelQueries({ queryKey: key })
        return queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }).catch(() => null)
      }
      return null
    }
    if ((cached?.token ?? null) === stored) return cached

    if (cached) await teardownSession(queryClient, 'external')
    if (!stored) return null
    return queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }).catch(() => null)
  }
  const next = syncChain.then(run, run)
  syncChain = next.catch(() => null)
  return next
}

/**
 * Stores a new session (login/register). A different previous user is torn down first, and drafts
 * of any other user are discarded. Prefer `establishSessionAndMergeCart` (used by `useEstablishSession`).
 */
export async function establishSession(queryClient: QueryClient, session: Session): Promise<void> {
  const previous = currentUserId(queryClient)
  if (previous && previous !== session.user.id) await teardownSession(queryClient, 'switch')
  clearUserDrafts(session.user.id)
  setStoredSession({ token: session.token, expiresAt: session.expiresAt })
  queryClient.setQueryData(sessionQueryOptions().queryKey, session)
}

export interface EstablishResult {
  session: Session
  /** Lines reduced by the merge (availability / maxPerOrder), to be announced by the UI. */
  adjusted: MergeCartResponse['adjusted']
  /** Merge failure (the guest id is kept, so the merge can be retried). The session is established anyway. */
  mergeError: unknown
}

/**
 * Login/register completion, shared by both screens (S2):
 * establish the session -> `POST /cart/merge { guestId }` bound to the NEW token -> seed
 * `['u', userId, 'cart']` with the merged cart -> drop the guest id and every `['guest']` query.
 */
export async function establishSessionAndMergeCart(queryClient: QueryClient, session: Session): Promise<EstablishResult> {
  const guestId = peekGuestId()
  await establishSession(queryClient, session)
  if (!guestId) return { session, adjusted: [], mergeError: null }
  try {
    const merged = await cartApi.mergeCart({ guestId }, { as: { token: session.token } })
    queryClient.setQueryData(queryKeys.owner({ kind: 'user', userId: session.user.id }).cart(), merged.cart)
    clearGuestId()
    await queryClient.cancelQueries({ queryKey: queryKeys.allGuest() })
    queryClient.removeQueries({ queryKey: queryKeys.allGuest() })
    return { session, adjusted: merged.adjusted, mergeError: null }
  } catch (mergeError) {
    return { session, adjusted: [], mergeError }
  }
}
