/** Session & account endpoints (API-1). */
import { buildPath, endpoints, type LoginRequest, type RegisterRequest } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const register = (body: RegisterRequest, opts: CallOptions = {}) =>
  send(endpoints.register, { path: buildPath(endpoints.register.path), body, ...opts })

export const login = (body: LoginRequest, opts: CallOptions = {}) =>
  send(endpoints.login, { path: buildPath(endpoints.login.path), body, ...opts })

export const getSession = (opts: CallOptions = {}) => send(endpoints.getSession, { path: buildPath(endpoints.getSession.path), ...opts })

/**
 * `token` pins the request to a session that is being torn down (the store may already be empty).
 * Always silent: an explicit logout with an already expired token must not start the
 * re-authentication flow (it is the user's own action).
 */
export const logout = (opts: CallOptions & { token?: string } = {}) => {
  const { token, ...rest } = opts
  return send(endpoints.logout, {
    path: buildPath(endpoints.logout.path),
    ...rest,
    silentSessionExpiry: true,
    ...(token ? { as: { token } } : {}),
  })
}
