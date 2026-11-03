/**
 * Single Axios instance of the app (ARCHITECTURE §1, §2.1, §2.3).
 *
 * Request side: baseURL from env, 10 s timeout, `X-Request-Id` per request and credentials by the
 * endpoint's `auth` mode (`Authorization: Bearer` when a session exists; `X-Guest-Id` for guest
 * endpoints without a session).
 * Response side: every failure is normalized to `ApiError` (validated against the frozen error
 * schema). The only non-ApiError that escapes is Axios' `CanceledError` (an aborted request is not
 * a failure: TanStack Query discards it).
 */
import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { ApiError, apiErrorBodySchema, HEADERS, type EndpointAuth, type EndpointDef, type FieldErrors } from '@/api/contracts'
import { env } from '@/env'
import { getGuestId, getToken } from '@/session/store'

export const REQUEST_TIMEOUT_MS = 10_000

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Credential mode taken from the endpoint table (`auth` is Axios' basic-auth field, hence the name). */
    credentialMode?: EndpointAuth
    /** Do not fire the global session-expired flow (boot-time `GET /session` just falls back to visitor). */
    silentSessionExpiry?: boolean
  }
}

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(
  (config) => {
    const headers = AxiosHeaders.from(config.headers)
    headers.set(HEADERS.requestId, crypto.randomUUID())
    const mode = config.credentialMode ?? 'public'
    if (mode !== 'public' && !headers.has(HEADERS.authorization)) {
      const token = getToken()
      if (token) headers.set(HEADERS.authorization, `Bearer ${token}`)
      else if (mode === 'guest') headers.set(HEADERS.guestId, getGuestId())
    }
    config.headers = headers
    return config
  },
  undefined,
  // Synchronous: headers are computed at call time, so a request started right before a logout
  // still carries the token it was meant for.
  { synchronous: true },
)

// ---------------------------------------------------------------------------
// Session expiry hook (ARCHITECTURE §4): fired once per expired token, even when several
// requests fail in parallel.
// ---------------------------------------------------------------------------
type SessionExpiredHandler = () => void
let sessionExpiredHandler: SessionExpiredHandler | null = null
let lastExpiredToken: string | null = null

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
}

function bearerOf(config: AxiosRequestConfig | undefined): string | null {
  const value = config?.headers ? AxiosHeaders.from(config.headers as AxiosHeaders).get(HEADERS.authorization) : null
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null
}

function notifySessionExpired(config: AxiosRequestConfig | undefined) {
  const token = bearerOf(config)
  if (!token || token === lastExpiredToken) return
  lastExpiredToken = token
  sessionExpiredHandler?.()
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------
function requestIdOf(error: AxiosError): string | undefined {
  const fromResponse = error.response?.headers?.[HEADERS.requestId.toLowerCase()]
  if (typeof fromResponse === 'string') return fromResponse
  const sent = error.config?.headers ? AxiosHeaders.from(error.config.headers as AxiosHeaders).get(HEADERS.requestId) : null
  return typeof sent === 'string' ? sent : undefined
}

/** Converts any Axios failure into ApiError. Exported for unit-level reuse (mutations, tests). */
export function toApiError(error: unknown): unknown {
  if (error instanceof ApiError || axios.isCancel(error)) return error
  if (!(error instanceof AxiosError)) return error
  const requestId = requestIdOf(error)

  if (!error.response) {
    const timedOut = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT
    return new ApiError(
      {
        code: 'TRANSIENT',
        reason: timedOut ? 'timeout' : 'network',
        message: timedOut ? 'O servidor demorou para responder.' : 'Sem conexão com o servidor.',
        ...(requestId ? { requestId } : {}),
      },
      0,
    )
  }

  const { status, data } = error.response
  const parsed = apiErrorBodySchema.safeParse(data)
  if (parsed.success) {
    const payload = { ...parsed.data.error, requestId: parsed.data.error.requestId ?? requestId }
    return new ApiError(payload, status)
  }

  // Body outside the contract: classify by status only. 5xx stays retryable; anything else is not
  // retried by the query policy (see queries/client.ts `shouldRetry`).
  if (status === 401) return new ApiError({ code: 'UNAUTHENTICATED', message: 'Autenticação necessária.', ...(requestId ? { requestId } : {}) }, status)
  if (status === 403) return new ApiError({ code: 'FORBIDDEN', message: 'Acesso não autorizado.', ...(requestId ? { requestId } : {}) }, status)
  if (status === 404) return new ApiError({ code: 'NOT_FOUND', message: 'Recurso não encontrado.', ...(requestId ? { requestId } : {}) }, status)
  return new ApiError({ code: 'TRANSIENT', reason: 'server', message: 'Falha inesperada do servidor.', ...(requestId ? { requestId } : {}) }, status)
}

http.interceptors.response.use(undefined, (error: unknown) => {
  const normalized = toApiError(error)
  if (normalized instanceof ApiError && normalized.is('SESSION_EXPIRED') && error instanceof AxiosError && !error.config?.silentSessionExpiry) {
    notifySessionExpired(error.config)
  }
  return Promise.reject(normalized)
})

// ---------------------------------------------------------------------------
// Typed call helper used by src/api/endpoints/*
// ---------------------------------------------------------------------------
export interface CallOptions {
  signal?: AbortSignal
  headers?: Record<string, string>
  silentSessionExpiry?: boolean
}

type ResponseOf<D extends EndpointDef> = D['response'] extends z.ZodType ? z.output<D['response']> : undefined

interface SendArgs extends CallOptions {
  /** Path already filled with `buildPath` (relative to the API base). */
  path: string
  query?: Record<string, string>
  body?: unknown
}

function zodToFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/**
 * Sends one request described by the endpoint table and validates the success body with the
 * endpoint's response schema. JSON bodies are validated (and normalized) with the request schema
 * first: an invalid body never leaves the client and surfaces as ApiError VALIDATION.
 */
export async function send<D extends EndpointDef>(def: D, args: SendArgs): Promise<ResponseOf<D>> {
  let data: unknown = args.body
  if (def.body && def.body !== 'multipart') {
    const checked = def.body.safeParse(args.body)
    if (!checked.success) {
      throw new ApiError({ code: 'VALIDATION', message: 'Dados inválidos.', fieldErrors: zodToFieldErrors(checked.error) }, 0)
    }
    data = checked.data
  }

  const response = await http.request({
    method: def.method,
    url: args.path,
    data,
    credentialMode: def.auth,
    ...(args.query ? { params: args.query } : {}),
    ...(args.signal ? { signal: args.signal } : {}),
    ...(args.headers ? { headers: args.headers } : {}),
    ...(args.silentSessionExpiry ? { silentSessionExpiry: true } : {}),
  })

  if (def.response === null) return undefined as ResponseOf<D>
  const parsed = def.response.safeParse(response.data)
  if (!parsed.success) {
    // Contract bug (or a non-API response such as the SPA fallback). Logged, surfaced as a
    // non-retryable server failure (status is 2xx, so `shouldRetry` declines it).
    console.error(`[api] ${def.method} ${args.path}: response outside the contract`, parsed.error.issues)
    throw new ApiError({ code: 'TRANSIENT', reason: 'server', message: 'Resposta inesperada do servidor.' }, response.status)
  }
  return parsed.data as ResponseOf<D>
}
