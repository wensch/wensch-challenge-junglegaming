import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, AVATAR_FIELD, type Profile } from '@/api/contracts'
import { hashPassword, newSalt } from '../crypto'
import { db, nowIso, persist, type UserRec } from '../db'
import { fail, route, validationFail } from '../http'
import { isActive } from '../scenario-state'
import { revokeOtherSessions } from '../sessions'

export const profileOf = (u: UserRec): Profile => ({
  userId: u.id,
  displayName: u.displayName,
  username: u.username,
  email: u.email,
  ensName: u.ensName,
  walletAlias: u.walletAlias,
  avatarUrl: u.avatarUrl,
  version: u.version,
  updatedAt: u.updatedAt,
})

/** Re-reads the user from the (cross-tab synced) DB; `auth.user` was captured before awaits and may be orphaned. */
const liveUser = (auth: { user: UserRec | null }): UserRec => db().users.find((u) => u.id === auth.user!.id) ?? auth.user!

function bump(u: UserRec) {
  u.version += 1
  u.updatedAt = nowIso()
  persist()
}

async function toDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${file.type};base64,${btoa(bin)}`
}

export const profileHandlers = [
  route('getProfile', ({ auth }) => profileOf(liveUser(auth))),

  route('updateProfile', ({ auth, body }) => {
    const me = liveUser(auth)
    if (isActive('forms.server-validation')) validationFail({ username: ['Este nome de usuário não está disponível'] })
    if (body.version !== me.version) {
      fail({ code: 'CONFLICT_VERSION', message: 'O perfil foi alterado em outro lugar. Recarregue e tente novamente.', resource: { kind: 'profile', id: me.id }, currentVersion: me.version })
    }
    const email = body.email.trim().toLowerCase()
    if (db().users.some((u) => u.id !== me.id && u.email === email)) {
      fail({ code: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado.', fieldErrors: { email: ['Este e-mail já está cadastrado'] } })
    }
    if (db().users.some((u) => u.id !== me.id && u.username === body.username)) validationFail({ username: ['Este nome de usuário já está em uso'] })
    Object.assign(me, { displayName: body.displayName, username: body.username, email, ensName: body.ensName, walletAlias: body.walletAlias })
    bump(me)
    return profileOf(me)
  }),

  route('uploadAvatar', async ({ auth, body }) => {
    const file = body.get(AVATAR_FIELD)
    if (!(file instanceof File)) validationFail({ [AVATAR_FIELD]: ['Envie um arquivo de imagem'] })
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) validationFail({ [AVATAR_FIELD]: ['Use PNG, JPEG ou WebP'] })
    if (file.size > AVATAR_MAX_BYTES) validationFail({ [AVATAR_FIELD]: ['Imagem maior que 2 MB'] })
    const url = await toDataUrl(file)
    const live = liveUser(auth)
    live.avatarUrl = url
    bump(live)
    return profileOf(live)
  }),

  route('removeAvatar', ({ auth }) => {
    const live = liveUser(auth)
    live.avatarUrl = null
    bump(live)
    return profileOf(live)
  }),

  route('changePassword', async ({ auth, body }) => {
    const me = auth.user!
    if (isActive('forms.server-validation')) validationFail({ newPassword: ['Esta senha é muito comum. Escolha outra'] })
    if ((await hashPassword(body.currentPassword, me.salt)) !== me.passwordHash) validationFail({ currentPassword: ['Senha atual incorreta'] })
    const salt = newSalt()
    const passwordHash = await hashPassword(body.newPassword, salt)
    const live = liveUser(auth)
    Object.assign(live, { salt, passwordHash })
    bump(live)
    // Other sessions of this user are no longer valid after a password change.
    revokeOtherSessions(live.id, auth.session!.tokenHash)
    return undefined
  }),
]
