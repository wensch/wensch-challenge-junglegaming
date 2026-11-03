/**
 * Session & account contracts.
 * Auth: opaque bearer token in `Authorization: Bearer <token>`; the same token is sent
 * as Socket.IO `auth.token`. Expiry -> 401 SESSION_EXPIRED; bad credentials -> 401 UNAUTHENTICATED.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { idSchema, isoDateTimeSchema, safeRedirectSchema } from './common'

export const emailSchema = z.email('Informe um e-mail válido').max(254)

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres')
  .max(30, 'Máximo de 30 caracteres')
  .regex(/^[a-z0-9_.]+$/, 'Use letras minúsculas, números, "_" ou "."')

export const displayNameSchema = z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres')

/** Password policy (validated on client and mock server). Never stored in clear text by the mock. */
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(128, 'Máximo de 128 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

/** Public view of the authenticated user (no secrets). */
export const userSchema = z.object({
  id: idSchema,
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  avatarUrl: z.string().min(1).nullable(),
})
export type User = z.infer<typeof userSchema>

/** POST /auth/register */
export const registerRequestSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem' })
export type RegisterRequest = z.infer<typeof registerRequestSchema>

/** POST /auth/login */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** Response of register/login/GET /session. */
export const sessionSchema = z.object({
  token: z.string().min(16),
  user: userSchema,
  issuedAt: isoDateTimeSchema,
  /** Absolute expiry. After it every private call returns 401 SESSION_EXPIRED. */
  expiresAt: isoDateTimeSchema,
})
export type Session = z.infer<typeof sessionSchema>

/** Search params of /login and /register (validateSearch). `redirect` is same-origin only. */
export const authSearchSchema = z.object({
  redirect: safeRedirectSchema.optional().catch(undefined),
  /** Set when the user was sent here because the session expired. */
  reason: z.enum(['expired', 'required']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>
