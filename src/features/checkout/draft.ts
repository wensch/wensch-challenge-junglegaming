/**
 * Collector draft (rascunho do colecionador), kept in `sessionStorage` under `kurio.u.<userId>.checkout`.
 *
 * Isolation (ELIM-4): the key carries the user id, a draft is only written while that
 * user is the session owner, and `clearUserDrafts` (logout, user switch, teardown of another user)
 * removes everything under the prefix. A draft kept after an EXPIRED session belongs to the same user and
 * resumes after login. Read values are validated: an entry that does not match the schema is ignored (and
 * left untouched until the user edits the form), never trusted.
 */
import { z } from 'zod'
import { idSchema, networkSchema } from '@/api/contracts'
import { userDraftKey } from '@/session/store'
import { checkoutFormSchema } from './form'

const connectionSchema = z.object({ connectionId: idSchema, walletId: idSchema, network: networkSchema, address: z.string().max(128) })
export type DraftConnection = z.infer<typeof connectionSchema>

const draftSchema = z.object({
  values: z
    .object({
      displayName: z.string().max(200),
      username: z.string().max(200),
      profileName: z.string().max(200),
      email: z.string().max(300),
      ensLabel: z.string().max(200),
      referralCode: z.string().max(100),
      note: z.string().max(600),
      walletId: z.string().max(100),
      network: checkoutFormSchema.shape.network,
    })
    .partial(),
  connection: connectionSchema.nullable(),
})
export type CheckoutDraft = z.infer<typeof draftSchema>

const slot = (userId: string) => userDraftKey(userId, 'checkout')

export function readDraft(userId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(slot(userId))
    if (!raw) return null
    const parsed = draftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeDraft(userId: string, draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(slot(userId), JSON.stringify(draft))
  } catch {
    /* storage unavailable or full: the form simply does not resume */
  }
}

export function clearDraft(userId: string): void {
  try {
    sessionStorage.removeItem(slot(userId))
  } catch {
    /* nothing to clear */
  }
}
