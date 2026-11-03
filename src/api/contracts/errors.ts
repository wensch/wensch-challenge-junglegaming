/**
 * Error contract. Every non-2xx REST response has the body `{ error: ApiErrorPayload }`.
 * The Axios client normalizes HTTP *and* transport failures (offline, timeout) into `ApiError`.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { idSchema, stockSchema } from './common'
import { quoteChangeSchema, quoteSchema } from './quote'

export const API_ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT_AVAILABILITY',
  'QUOTE_STALE',
  'IDEMPOTENCY_CONFLICT',
  'EMAIL_TAKEN',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'TRANSIENT',
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** Canonical HTTP status for each code (TRANSIENT may also arrive as 500/502/504, or 0 for transport failures). */
export const API_ERROR_STATUS = {
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_AVAILABILITY: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  EMAIL_TAKEN: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  TRANSIENT: 503,
} as const satisfies Record<ApiErrorCode, number>

/** Codes where retrying the *same* request may succeed. Only TRANSIENT. */
export const RETRYABLE_CODES: readonly ApiErrorCode[] = ['TRANSIENT']

/** Field -> human messages (pt-BR). Keys are the request body field paths (`collector.email`). */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()).min(1))
export type FieldErrors = z.infer<typeof fieldErrorsSchema>

export const availabilityConflictItemSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  requested: z.int().min(0),
  available: stockSchema,
})

const base = {
  message: z.string(),
  requestId: z.string().optional(),
}

export const apiErrorPayloadSchema = z.discriminatedUnion('code', [
  z.object({ ...base, code: z.literal('VALIDATION'), fieldErrors: fieldErrorsSchema }),
  z.object({ ...base, code: z.literal('UNAUTHENTICATED') }),
  z.object({ ...base, code: z.literal('SESSION_EXPIRED') }),
  z.object({ ...base, code: z.literal('FORBIDDEN') }),
  z.object({ ...base, code: z.literal('NOT_FOUND'), resource: z.object({ kind: z.string(), id: z.string() }).optional() }),
  z.object({ ...base, code: z.literal('CONFLICT_AVAILABILITY'), items: z.array(availabilityConflictItemSchema).min(1) }),
  z.object({ ...base, code: z.literal('QUOTE_STALE'), quote: quoteSchema, changes: z.array(quoteChangeSchema) }),
  z.object({ ...base, code: z.literal('IDEMPOTENCY_CONFLICT'), orderId: idSchema }),
  z.object({ ...base, code: z.literal('EMAIL_TAKEN'), fieldErrors: fieldErrorsSchema }),
  z.object({ ...base, code: z.literal('COUPON_INVALID'), couponCode: z.string() }),
  z.object({ ...base, code: z.literal('COUPON_EXPIRED'), couponCode: z.string(), expiredAt: z.iso.datetime({ offset: true }) }),
  z.object({
    ...base,
    code: z.literal('TRANSIENT'),
    /** server = 5xx; network = offline/DNS; timeout = client timeout. */
    reason: z.enum(['server', 'network', 'timeout']),
    retryAfterMs: z.int().min(0).optional(),
  }),
])
export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>

export const apiErrorBodySchema = z.object({ error: apiErrorPayloadSchema })
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

type PayloadOf<C extends ApiErrorCode> = Extract<ApiErrorPayload, { code: C }>

/** Error thrown by every endpoint function. `status` is 0 for transport failures. */
export class ApiError<C extends ApiErrorCode = ApiErrorCode> extends Error {
  readonly code: C
  readonly status: number
  readonly payload: PayloadOf<C>

  constructor(payload: PayloadOf<C>, status: number = API_ERROR_STATUS[payload.code]) {
    super(payload.message)
    this.name = 'ApiError'
    this.code = payload.code
    this.status = status
    this.payload = payload
  }

  get retryable(): boolean {
    return RETRYABLE_CODES.includes(this.code)
  }

  get fieldErrors(): FieldErrors | undefined {
    return 'fieldErrors' in this.payload ? this.payload.fieldErrors : undefined
  }

  is<K extends ApiErrorCode>(code: K): this is ApiError<K> {
    return (this.code as ApiErrorCode) === code
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** Build the JSON body for an error (used by MSW handlers; keeps body and status in sync). */
export function errorBody<C extends ApiErrorCode>(payload: PayloadOf<C>): { body: ApiErrorBody; status: number } {
  return { body: { error: payload }, status: API_ERROR_STATUS[payload.code] }
}

// Re-exported so consumers of QUOTE_STALE do not need a second import.
export type { Quote, QuoteChange } from './quote'
