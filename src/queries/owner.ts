/**
 * Credential binding for private/guest queries (ARCHITECTURE §4, §9).
 *
 * A query under `['u', userId, ...]` is fetched with THAT user's token and a query under
 * `['guest', guestId, ...]` with THAT guest id — never with whatever the session store holds at call
 * time. After the response, the owner is checked again: if it is no longer the current identity (logout,
 * user switch in another tab) the response is discarded instead of being cached.
 */
import { ApiError } from '@/api/contracts'
import type { Credential } from '@/api/client'
import { getToken, peekGuestId } from '@/session/store'
import type { CartOwner } from './keys'

/** Owner of a private/guest key together with the credential that proves it. */
export type OwnerCredential = { kind: 'user'; userId: string; token: string } | { kind: 'guest'; guestId: string }

export function credentialOf(owner: OwnerCredential): Credential {
  return owner.kind === 'user' ? { token: owner.token } : { guestId: owner.guestId }
}

/** Key part of the owner (no token in query keys). */
export function ownerKey(owner: OwnerCredential): CartOwner {
  return owner.kind === 'user' ? { kind: 'user', userId: owner.userId } : { kind: 'guest', guestId: owner.guestId }
}

/**
 * True while `owner` is still the current identity. Uses the STORED token even if locally expired:
 * the request then goes out and the server answers SESSION_EXPIRED, which runs the `expired` flow
 * (instead of a silent "owner changed" error that would leave the UI stuck).
 */
export function isCurrentOwner(owner: OwnerCredential): boolean {
  const token = getToken()
  return owner.kind === 'user' ? token === owner.token : token === null && peekGuestId() === owner.guestId
}

/** Thrown (instead of caching) when the identity changed while the request was in flight. */
export function ownerChangedError(): ApiError<'UNAUTHENTICATED'> {
  return new ApiError({ code: 'UNAUTHENTICATED', message: 'A sessão mudou durante a requisição.' }, 0)
}

/**
 * Wraps a queryFn: calls `fn` with the owner's credential and refuses to return data for an owner
 * that is no longer current. Use it in every `['u', ...]` / `['guest', ...]` queryOptions.
 */
export function ownedQueryFn<T>(owner: OwnerCredential, fn: (as: Credential, signal: AbortSignal) => Promise<T>) {
  return async ({ signal }: { signal: AbortSignal }): Promise<T> => {
    if (!isCurrentOwner(owner)) throw ownerChangedError()
    const data = await fn(credentialOf(owner), signal)
    if (!isCurrentOwner(owner)) throw ownerChangedError()
    return data
  }
}
