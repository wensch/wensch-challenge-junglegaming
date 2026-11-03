/** Quote endpoint (API-5): the only source of totals shown to the user. */
import { buildPath, endpoints, type CreateQuoteRequest } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const createQuote = (body: CreateQuoteRequest, opts: CallOptions = {}) =>
  send(endpoints.createQuote, { path: buildPath(endpoints.createQuote.path), body, ...opts })
