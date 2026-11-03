/**
 * Collector wallets: at most one `primary` and one `secondary` per user. Fields mirror the
 * "Carteiras" frame. Connection to a wallet provider is simulated by the mock
 * (connect -> connected | rejected; disconnect), no real extension is involved.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { emailSchema, displayNameSchema, usernameSchema } from './auth'
import { ensNameSchema, idSchema, isoDateTimeSchema, isValidAddress, networkSchema, versionSchema } from './common'

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const walletSlotSchema = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof walletSlotSchema>

/** "Tipo de carteira" options (MetaMask · WalletConnect · Coinbase). */
export const WALLET_TYPES = ['metamask', 'walletconnect', 'coinbase'] as const
export const walletTypeSchema = z.enum(WALLET_TYPES)
export type WalletType = z.infer<typeof walletTypeSchema>

const walletFields = {
  displayName: displayNameSchema,
  label: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'), // "Apelido da carteira"
  profileName: usernameSchema, // "Nome do perfil"
  network: networkSchema,
  address: z.string().trim(),
  /** "ENS ou carteira secundária (opcional)". */
  alternateAddress: z.string().trim().max(128).optional(),
  type: walletTypeSchema,
  referralCode: z.string().trim().regex(/^[A-Z0-9-]{4,16}$/, 'Código de indicação inválido'),
  email: emailSchema,
  ensName: ensNameSchema,
}

function refineAddress(v: { network: z.infer<typeof networkSchema>; address: string }, ctx: z.RefinementCtx) {
  if (!isValidAddress(v.network, v.address)) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message: v.network === 'solana' ? 'Endereço Solana inválido' : 'Endereço deve ter o formato 0x seguido de 40 caracteres hexadecimais',
    })
  }
}

/** POST /wallets */
export const createWalletRequestSchema = z.object({ slot: walletSlotSchema, ...walletFields }).superRefine(refineAddress)
export type CreateWalletRequest = z.infer<typeof createWalletRequestSchema>

/** PATCH /wallets/:id — full replacement of editable fields; `version` guards lost updates. */
export const updateWalletRequestSchema = z.object({ ...walletFields, version: versionSchema }).superRefine(refineAddress)
export type UpdateWalletRequest = z.infer<typeof updateWalletRequestSchema>

export const walletSchema = z.object({
  id: idSchema,
  slot: walletSlotSchema,
  ...walletFields,
  alternateAddress: z.string().nullable(),
  version: versionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Wallet = z.infer<typeof walletSchema>

/** GET /wallets */
export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

/** POST /wallets/:id/connect — simulated provider handshake for checkout. */
export const connectWalletRequestSchema = z.object({ network: networkSchema })
export type ConnectWalletRequest = z.infer<typeof connectWalletRequestSchema>

export const walletConnectionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('connected'),
    connectionId: idSchema,
    walletId: idSchema,
    network: networkSchema,
    address: z.string(),
    connectedAt: isoDateTimeSchema,
  }),
  /** User refused in the (simulated) wallet. Not an HTTP error: a valid outcome. */
  z.object({ status: z.literal('rejected'), walletId: idSchema, reason: z.string() }),
])
export type WalletConnection = z.infer<typeof walletConnectionSchema>
/* DELETE /wallets/:id/connection -> 204 (simulated disconnect). */
