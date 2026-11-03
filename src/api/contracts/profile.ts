/**
 * Collector profile ("Perfil do colecionador"), avatar and password change.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from './auth'
import { ensNameSchema, idSchema, isoDateTimeSchema, versionSchema } from './common'

export const profileSchema = z.object({
  userId: idSchema,
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema,
  walletAlias: z.string().min(2).max(40),
  avatarUrl: z.string().min(1).nullable(),
  version: versionSchema,
  updatedAt: isoDateTimeSchema,
})
export type Profile = z.infer<typeof profileSchema>

/** PATCH /profile — `version` guards lost updates. EMAIL_TAKEN (409) or VALIDATION (username taken). */
export const updateProfileRequestSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema,
  walletAlias: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  version: versionSchema,
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

/** PUT /profile/avatar — multipart/form-data with field `file`. DELETE /profile/avatar removes it. */
export const AVATAR_FIELD = 'file'
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const avatarFileSchema = z
  .instanceof(File)
  .refine((f) => (AVATAR_MIME_TYPES as readonly string[]).includes(f.type), 'Use PNG, JPEG ou WebP')
  .refine((f) => f.size <= AVATAR_MAX_BYTES, 'Imagem maior que 2 MB')

/** POST /profile/password -> 204. Wrong current password -> VALIDATION fieldErrors.currentPassword. */
export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' })
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
