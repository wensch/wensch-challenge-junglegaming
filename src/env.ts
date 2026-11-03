/**
 * Typed, validated view of the Vite env. Fails fast at boot if a required value is missing,
 * instead of producing requests to `undefined/...`.
 */
import { z } from 'zod'

const envSchema = z.object({
  /** REST base. Relative (`/api`) in every environment: the MSW worker answers on the same origin. */
  VITE_API_URL: z.string().min(1).default('/api'),
  /** Socket.IO origin (no `/socket.io/` path: the MSW binding strips it before matching). */
  VITE_SOCKET_URL: z.url(),
})

const parsed = envSchema.safeParse(import.meta.env)
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
}

export const env = {
  apiUrl: parsed.data.VITE_API_URL,
  socketUrl: parsed.data.VITE_SOCKET_URL,
} as const
