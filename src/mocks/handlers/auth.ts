import { db, nextId, nowIso, persist, type UserRec } from '../db'
import { hashPassword, newSalt } from '../crypto'
import { fail, route, validationFail } from '../http'
import { isActive } from '../scenario-state'
import { issueSession, revokeSession, toPublicUser } from '../sessions'

const ensFrom = (username: string) => {
  const base = username.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
  return `${base.length >= 3 ? base : `${base}nft`.slice(0, 20)}.eth`
}

export const authHandlers = [
  route('register', async ({ body }) => {
    const email = body.email.trim().toLowerCase()
    if (isActive('register.email-taken') || db().users.some((u) => u.email === email)) {
      fail({ code: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado.', fieldErrors: { email: ['Este e-mail já está cadastrado'] } })
    }
    if (db().users.some((u) => u.username === body.username)) validationFail({ username: ['Este nome de usuário já está em uso'] })
    const salt = newSalt()
    const now = nowIso()
    const user: UserRec = {
      id: nextId('usr', 3),
      email,
      username: body.username,
      displayName: body.username,
      avatarUrl: null,
      ensName: ensFrom(body.username),
      walletAlias: `Carteira de ${body.username}`,
      salt,
      passwordHash: await hashPassword(body.password, salt),
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    db().users.push(user)
    persist()
    return issueSession(user)
  }),

  route('login', async ({ body }) => {
    const user = db().users.find((u) => u.email === body.email.trim().toLowerCase())
    const ok = user !== undefined && (await hashPassword(body.password, user.salt)) === user.passwordHash
    if (!user || !ok) fail({ code: 'UNAUTHENTICATED', message: 'E-mail ou senha incorretos.' })
    return issueSession(user)
  }),

  route('getSession', ({ auth }) => {
    const session = auth.session!
    return { token: auth.token!, user: toPublicUser(auth.user!), issuedAt: session.issuedAt, expiresAt: session.expiresAt }
  }),

  route('logout', ({ auth }) => {
    revokeSession(auth.session!)
    return undefined
  }),
]
