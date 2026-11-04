/**
 * Checkout form (PAG-1): collector data + wallet/network, validated with zod on the client and again by
 * the API (its `fieldErrors` are mapped back onto these fields). The `collector` sent to the API reuses
 * the field rules of the contract (`collectorSchema`): same schemas, same messages.
 */
import { z } from 'zod'
import { collectorSchema, ensNameSchema, idSchema, networkSchema, type Collector } from '@/api/contracts'

const ENS_SUFFIX = '.eth'

export const checkoutFormSchema = z.object({
  displayName: collectorSchema.shape.displayName,
  username: collectorSchema.shape.username,
  profileName: collectorSchema.shape.profileName,
  email: collectorSchema.shape.email,
  /** Only the label: ".eth" is the single suffix offered by the layout and is appended on submit. */
  ensLabel: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o nome ENS')
    .refine((v) => ensNameSchema.safeParse(`${v}${ENS_SUFFIX}`).success, 'Nome ENS inválido (use letras minúsculas, números e hífen)'),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,16}$/, 'Código de indicação inválido'),
  note: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  walletId: idSchema,
  network: networkSchema,
  /** Present only after a successful simulated connection ("Conectar carteira"). */
  connectionId: z.string().min(1, 'Conecte a carteira para continuar'),
})

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>
export type CheckoutFormValues = z.output<typeof checkoutFormSchema>

/** Names of the fields that exist in the form (API paths are mapped onto these). */
export const CHECKOUT_FIELDS = ['displayName', 'username', 'profileName', 'email', 'ensLabel', 'referralCode', 'note', 'walletId', 'network', 'connectionId'] as const

export function toCollector(values: CheckoutFormValues): Collector {
  return {
    displayName: values.displayName,
    username: values.username,
    profileName: values.profileName,
    email: values.email,
    ensName: `${values.ensLabel}${ENS_SUFFIX}`,
    referralCode: values.referralCode,
    ...(values.note ? { note: values.note } : {}),
  }
}

export const ensLabelOf = (ensName: string) => (ensName.endsWith(ENS_SUFFIX) ? ensName.slice(0, -ENS_SUFFIX.length) : ensName)
export { ENS_SUFFIX }
