import type { Session } from '@/api/contracts'
import { newToken, sha256Hex } from './crypto'
import { db, persist, type SessionRec, type UserRec } from './db'
import { expiredBefore } from './scenario-state'

/** Token lifetime. Expiry is simulated by scenarios (`session.expired`, `session.expire-on-checkout`). */
export const SESSION_TTL_MS = 8 * 3_600_000

export const toPublicUser = (u: UserRec) => ({ id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl })

export async function issueSession(user: UserRec): Promise<Session> {
  const token = newToken()
  const issued = Date.now()
  const rec: SessionRec = {
    tokenHash: await sha256Hex(token),
    userId: user.id,
    issuedAt: new Date(issued).toISOString(),
    expiresAt: new Date(issued + SESSION_TTL_MS).toISOString(),
  }
  db().sessions.push(rec)
  // Keep the table small: drop long-expired sessions.
  db().sessions = db().sessions.filter((s) => Date.parse(s.expiresAt) > issued - SESSION_TTL_MS)
  persist()
  return { token, user: toPublicUser(user), issuedAt: rec.issuedAt, expiresAt: rec.expiresAt }
}

export type SessionLookup =
  | { status: 'ok'; session: SessionRec; user: UserRec; token: string }
  | { status: 'expired' }
  | { status: 'unknown' }

export async function findSession(token: string | null | undefined): Promise<SessionLookup> {
  if (!token) return { status: 'unknown' }
  const hash = await sha256Hex(token)
  const session = db().sessions.find((s) => s.tokenHash === hash)
  if (!session) return { status: 'unknown' }
  const user = db().users.find((u) => u.id === session.userId)
  if (!user) return { status: 'unknown' }
  const cutoff = expiredBefore()
  if (Date.parse(session.expiresAt) <= Date.now() || (cutoff !== null && Date.parse(session.issuedAt) <= cutoff)) return { status: 'expired' }
  return { status: 'ok', session, user, token }
}

const sessionListeners = new Set<() => void>()
/** Realtime subscribes here to drop sockets of revoked or expired sessions. */
export function onSessionsChanged(fn: () => void): void {
  sessionListeners.add(fn)
}
function notifySessionsChanged(): void {
  for (const fn of sessionListeners) fn()
}

// Sessions are matched by token hash (not identity): the DB object may have been replaced by another tab's write.
export function revokeSession(session: SessionRec): void {
  db().sessions = db().sessions.filter((s) => s.tokenHash !== session.tokenHash)
  persist()
  notifySessionsChanged()
}

/** Revokes every session of the user except the one identified by `keepTokenHash`. */
export function revokeOtherSessions(userId: string, keepTokenHash: string): void {
  db().sessions = db().sessions.filter((s) => s.userId !== userId || s.tokenHash === keepTokenHash)
  persist()
  notifySessionsChanged()
}

/** Marks a session as expired right now (simulated). */
export function expireSession(session: SessionRec): void {
  const live = db().sessions.find((s) => s.tokenHash === session.tokenHash) ?? session
  live.expiresAt = new Date(Date.now() - 1000).toISOString()
  persist()
  notifySessionsChanged()
}
