/**
 * Route factory: turns an entry of the shared `endpoints` table into an MSW handler that
 *  1. applies network scenarios (latency, offline, timeout, one-shot 5xx);
 *  2. resolves auth (Bearer session / X-Guest-Id) per the endpoint's `auth` mode;
 *  3. validates query and body with the contract schemas (422 VALIDATION with fieldErrors);
 *  4. runs the domain handler and validates its output with the contract response schema.
 */
import { delay, http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw'
import type { z } from 'zod'
import {
  endpoints,
  errorBody,
  HEADERS,
  uuidSchema,
  type ApiErrorCode,
  type ApiErrorPayload,
  type Endpoint,
  type EndpointDef,
  type EndpointName,
} from '@/api/contracts'
import type { SessionRec, UserRec } from './db'
import { nextLatency } from './latency'
import { fireOnce, isActive } from './scenario-state'
import { findSession } from './sessions'

export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

/** Thrown by handlers to answer with a contract error. */
export class HttpFail extends Error {
  readonly result: { body: { error: ApiErrorPayload }; status: number }
  constructor(payload: ApiErrorPayload, status?: number) {
    super(payload.message)
    const built = errorBody<ApiErrorCode>(payload)
    this.result = status === undefined ? built : { ...built, status }
  }
}

export function fail(payload: ApiErrorPayload, status?: number): never {
  throw new HttpFail(payload, status)
}

export function validationFail(fieldErrors: Record<string, string[]>, message = 'Dados inválidos'): never {
  return fail({ code: 'VALIDATION', message, fieldErrors })
}

export interface AuthCtx {
  user: UserRec | null
  session: SessionRec | null
  token: string | null
  guestId: string | null
}

export const ownerKeyOf = (auth: AuthCtx): string => (auth.user ? `u:${auth.user.id}` : `g:${auth.guestId ?? 'none'}`)

type BodyOf<N extends EndpointName> = Endpoint<N> extends { body: infer B } ? (B extends z.ZodType ? z.output<B> : FormData) : undefined
type QueryOf<N extends EndpointName> = Endpoint<N> extends { query: infer Q extends z.ZodType } ? z.output<Q> : undefined
type ResultOf<N extends EndpointName> = Endpoint<N> extends { response: infer R extends z.ZodType } ? z.input<R> : undefined

export interface Ctx<N extends EndpointName> {
  request: Request
  params: Record<string, string>
  body: BodyOf<N>
  query: QueryOf<N>
  auth: AuthCtx
  /** Override the success status (e.g. 200 on idempotent replay). */
  status: number
  /** Never answer (used by the "timeout after create" scenario). */
  hang: () => never
}

export class HangSignal extends Error {
  constructor() {
    super('hang')
  }
}

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

function queryObject(url: URL): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [k, v] of url.searchParams) {
    const prev = out[k]
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v]
  }
  return out
}

function respondError(result: { body: unknown; status: number }, requestId: string | null) {
  const body = result.body as { error: Record<string, unknown> }
  return HttpResponse.json(requestId ? { error: { ...body.error, requestId } } : body, { status: result.status })
}

async function resolveAuth(mode: 'public' | 'guest' | 'session', request: Request): Promise<AuthCtx> {
  const header = request.headers.get(HEADERS.authorization)
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null
  const none: AuthCtx = { user: null, session: null, token: null, guestId: null }
  if (mode === 'public') return none

  if (token) {
    const found = await findSession(token)
    if (found.status === 'expired') fail({ code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Entre novamente.' })
    if (found.status === 'unknown') fail({ code: 'UNAUTHENTICATED', message: 'Sessão inválida. Entre novamente.' })
    if (found.status === 'ok') return { user: found.user, session: found.session, token, guestId: null }
  }
  if (mode === 'session') fail({ code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' })

  const guest = request.headers.get(HEADERS.guestId)
  const parsed = uuidSchema.safeParse(guest)
  if (!parsed.success) validationFail({ [HEADERS.guestId]: ['Identificador de visitante ausente ou inválido'] })
  return { ...none, guestId: parsed.data }
}

function scenarioFailure(name: EndpointName): ApiErrorPayload | null {
  if (name === 'listNfts' || name === 'getNft') {
    if (isActive('http.503')) return { code: 'TRANSIENT', message: 'Serviço indisponível.', reason: 'server', retryAfterMs: 1000 }
  }
  if ((name === 'addFavorite' || name === 'removeFavorite') && isActive('favorites.fail')) {
    return { code: 'TRANSIENT', message: 'Não foi possível atualizar os favoritos.', reason: 'server' }
  }
  return null
}

export function route<N extends EndpointName>(name: N, handler: (ctx: Ctx<N>) => Promise<ResultOf<N>> | ResultOf<N>): HttpHandler {
  const def: EndpointDef = endpoints[name]
  const factory = http[def.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete']

  return factory(`${API_BASE}${def.path}`, async ({ request, params }) => {
    const requestId = request.headers.get(HEADERS.requestId)

    // --- network scenarios ---
    if (isActive('network.offline')) return HttpResponse.error()
    const wait = nextLatency(name)
    if (wait === 'infinite') {
      await delay('infinite')
      return HttpResponse.error()
    }
    await delay(wait)
    // Re-check: the scenario may have changed while waiting.
    if (isActive('network.offline')) return HttpResponse.error()

    try {
      if (fireOnce('http.500.once')) fail({ code: 'TRANSIENT', message: 'Erro interno simulado.', reason: 'server' }, 500)
      const scenarioError = scenarioFailure(name)
      if (scenarioError) fail(scenarioError)

      const auth = await resolveAuth(def.auth, request)

      let query: unknown
      if (def.query) {
        const parsed = def.query.safeParse(queryObject(new URL(request.url)))
        if (!parsed.success) validationFail(fieldErrorsOf(parsed.error))
        query = parsed.data
      }

      let body: unknown
      if (def.body === 'multipart') {
        try {
          body = await request.formData()
        } catch {
          validationFail({ file: ['Envie o arquivo como multipart/form-data'] })
        }
      } else if (def.body) {
        let json: unknown
        try {
          json = await request.json()
        } catch {
          validationFail({ _: ['Corpo JSON inválido'] })
        }
        const parsed = def.body.safeParse(json)
        if (!parsed.success) validationFail(fieldErrorsOf(parsed.error))
        body = parsed.data
      }

      const ctx: Ctx<N> = {
        request,
        params: params as Record<string, string>,
        body: body as BodyOf<N>,
        query: query as QueryOf<N>,
        auth,
        status: def.status,
        hang: () => {
          throw new HangSignal()
        },
      }
      const data = await handler(ctx)

      if (def.response === null) return new HttpResponse(null, { status: 204 })
      const out = def.response.safeParse(data)
      if (!out.success) {
        console.error(`[mock] response of ${name} violates its contract`, out.error.issues, data)
        return HttpResponse.json({ error: { code: 'TRANSIENT', message: 'Resposta simulada inválida (contrato).', reason: 'server' } }, { status: 500 })
      }
      return HttpResponse.json(out.data as JsonBodyType, { status: ctx.status })
    } catch (e) {
      if (e instanceof HangSignal) {
        await delay('infinite')
        return HttpResponse.error()
      }
      if (e instanceof HttpFail) return respondError(e.result, requestId)
      console.error(`[mock] unexpected error in ${name}`, e)
      return respondError(errorBody<ApiErrorCode>({ code: 'TRANSIENT', message: 'Erro interno simulado.', reason: 'server' }), requestId)
    }
  })
}
