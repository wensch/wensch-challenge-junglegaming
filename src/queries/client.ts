/**
 * QueryClient and its global policy (ARCHITECTURE §7).
 * - Retries: queries retry at most 2x and ONLY for retryable failures (TRANSIENT) that really are
 *   transport/5xx failures (status 0 or >= 500). 4xx — and contract violations on a 2xx — never retry.
 * - Backoff: 500 ms, 1 s, 2 s ... capped at 4 s; honours `retryAfterMs` sent by the server.
 * - Mutations never retry by default (createOrder opts in explicitly, with the same Idempotency-Key).
 * Per-resource staleTime lives next to each queryOptions; the default here is the catalog's 30 s.
 */
import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/contracts'

export const MAX_QUERY_RETRIES = 2
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 4_000

export const STALE = {
  catalog: 30_000,
  featured: 5 * 60_000,
  cart: 10_000,
  quote: 0,
  account: 5 * 60_000,
  session: Number.POSITIVE_INFINITY,
} as const

function isRetryableError(error: unknown): boolean {
  return isApiError(error) && error.retryable && (error.status === 0 || error.status >= 500)
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetryableError(error)
}

export function retryDelay(attempt: number, error: unknown): number {
  const backoff = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  const hinted = isApiError(error) && error.is('TRANSIENT') ? (error.payload.retryAfterMs ?? 0) : 0
  return Math.min(Math.max(backoff, hinted), MAX_DELAY_MS)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE.catalog,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
}
