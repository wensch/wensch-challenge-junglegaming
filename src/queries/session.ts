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
import { clearGuestId, clearStoredSession, clearUserDrafts, getToken, peekGuestId, readStoredSession, setStoredSession } from '@/session/store'
import { STALE } from './client'
import { queryKeys } from './keys'

// ---------------------------------------------------------------------------
// "The last session of this tab ended by expiry" (ARCHITECTURE §4). Lets the private-route guard
// answer `reason=expired` (instead of `required`) for a visitor whose session just expired — at
// boot or after the teardown — so the login screen explains why and resumes the context.
// Set by the expired teardown and by the boot check; cleared by any other end of session and by login.
// ---------------------------------------------------------------------------
let sessionEndedByExpiry = false

export function sessionExpiredRecently(): boolean {
  return sessionEndedByExpiry
}

/** True when `expiresAt` (ISO) is already in the past for the local clock. */
export function isPastExpiry(expiresAt: string, now: number = Date.now()): boolean {
  return Date.parse(expiresAt) <= now
}

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session(),
    queryFn: async ({ signal }): Promise<Session | null> => {
      // The token is read ONCE and bound to the request: the cached session always carries the
      // token it was resolved with (compared against storage by syncSessionWithStorage).
      const stored = readStoredSession()
      if (!stored) return null
      const { token } = stored
      if (stored.expired) {
        // Locally expired at boot: visitor, no round-trip. Drafts stay (same user resumes after login).
        clearStoredSession()
        sessionEndedByExpiry = true
        return null
      }
      try {
        // Silent: an expired token at boot just means "visitor", not the re-authentication flow.
        const session = await authApi.getSession({ signal, silentSessionExpiry: true, as: { token } })
        // The owner of this tab is now known: drafts of anyone else (e.g. a user whose session
        // expired here before another user logged in) are dropped; this user's drafts are kept.
        clearUserDrafts(session.user.id)
        return session
      } catch (e) {
        if (isApiError(e) && (e.is('UNAUTHENTICATED') || e.is('SESSION_EXPIRED'))) {
          // Drop only the token that was checked (another tab may have stored a new one meanwhile).
          if (getToken() === token) clearStoredSession()
          if (e.is('SESSION_EXPIRED')) sessionEndedByExpiry = true
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
 * - `expired`: 401 SESSION_EXPIRED or local clock past `expiresAt` (drafts of the same user kept so the
 *   checkout resumes);
 * - `unauthenticated`: 401 UNAUTHENTICATED with a Bearer (token revoked/unknown);
 * - `switch`: another user is about to be stored in this tab;
 * - `external`: storage changed in ANOTHER tab — storage already holds the new state, so it is left alone.
 *   If storage now holds a session, the drafts of the user being torn down are kept (it may be the same
 *   user re-logged); `syncSessionWithStorage` drops them once the new owner is known to be someone else.
 *   If storage is empty (logout elsewhere), every draft is removed.
 */
type TeardownReason = 'logout' | 'expired' | 'unauthenticated' | 'switch' | 'external'

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

  // Kept drafts belong to the user being torn down only. Without a known user (no session in cache)
  // nothing is removed here: the next owner is resolved by GET /session or establishSession, which
  // drop the drafts of anyone else.
  const keepDrafts = reason === 'expired' || reason === 'unauthenticated' || (reason === 'external' && getToken() !== null)
  if (!keepDrafts) clearUserDrafts()
  else if (userId) clearUserDrafts(userId)
  sessionEndedByExpiry = reason === 'expired'

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
    const storedState = readStoredSession()
    const stored = storedState?.token ?? null
    const cached = cachedSession(queryClient)

    if (cached === undefined) {
      // Boot still resolving. If it is fetching with another token, restart it with the current one.
      if (queryClient.isFetching({ queryKey: key }) > 0) {
        await queryClient.cancelQueries({ queryKey: key })
        return queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }).catch(() => null)
      }
      return null
    }
    // Natural expiry (local clock past `expiresAt`) of the session in cache: the `expired` flow, not
    // "session missing" — drafts of the user are kept and the guard answers `reason=expired`.
    // Also when the storage was already emptied by another tab's own expiry teardown.
    if (cached && (stored === null || stored === cached.token) && (isPastExpiry(cached.expiresAt) || storedState?.expired === true)) {
      await teardownSession(queryClient, 'expired')
      return null
    }
    if ((cached?.token ?? null) === stored) return cached

    if (cached) await teardownSession(queryClient, 'external')
    if (!stored) return null
    const next = await queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }).catch(() => null)
    // Drafts left in this tab (kept by the external teardown, or by an earlier `expired` teardown when
    // `cached` is already null) belong to the previous user: drop them unless it is the same one.
    // With no resolved owner, drop them only if they were kept by the teardown just above.
    if (next) clearUserDrafts(next.user.id)
    else if (cached) clearUserDrafts()
    return next
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
  sessionEndedByExpiry = false
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
 * Login/register completion, shared by both screens:
 * establish the session -> `POST /cart/merge { guestId }` bound to the NEW token -> seed
 * `['u', userId, 'cart']` with the merged cart -> drop the guest id and every `['guest']` query.
 */
export async function establishSessionAndMergeCart(queryClient: QueryClient, session: Session): Promise<EstablishResult> {
  const guestId = peekGuestId()
  await establishSession(queryClient, session)
  if (!guestId) return { session, adjusted: [], mergeError: null }
  try {
    const merged = await cartApi.mergeCart({ guestId }, { as: { token: session.token } })
    // The identity may have changed while the request was in flight (logout, expiry, another login):
    // then neither the merged cart nor the guest cleanup belong to the current owner.
    if (getToken() !== session.token) return { session, adjusted: [], mergeError: null }
    const cartKey = queryKeys.owner({ kind: 'user', userId: session.user.id }).cart()
    // The header cart may already be fetching for the new user (the session was just stored).
    // Cancel that GET before writing the merged cart so its (older) response cannot overwrite it
    // (the cart query also uses `keepNewest`, which refuses a lower `version`).
    await queryClient.cancelQueries({ queryKey: cartKey })
    if (getToken() !== session.token) return { session, adjusted: [], mergeError: null }
    queryClient.setQueryData(cartKey, merged.cart)
    clearGuestId()
    await queryClient.cancelQueries({ queryKey: queryKeys.allGuest() })
    queryClient.removeQueries({ queryKey: queryKeys.allGuest() })
    return { session, adjusted: merged.adjusted, mergeError: null }
  } catch (mergeError) {
    return { session, adjusted: [], mergeError }
  }
}
