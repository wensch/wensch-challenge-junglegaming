/** Profile endpoints (API-7). */
import { AVATAR_FIELD, buildPath, endpoints, type ChangePasswordRequest, type UpdateProfileRequest } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const getProfile = (opts: CallOptions = {}) => send(endpoints.getProfile, { path: buildPath(endpoints.getProfile.path), ...opts })

export const updateProfile = (body: UpdateProfileRequest, opts: CallOptions = {}) =>
  send(endpoints.updateProfile, { path: buildPath(endpoints.updateProfile.path), body, ...opts })

/** Multipart upload; type/size are validated by the caller with `avatarFileSchema` and again by the mock. */
export const uploadAvatar = (file: File, opts: CallOptions = {}) => {
  const form = new FormData()
  form.append(AVATAR_FIELD, file)
  return send(endpoints.uploadAvatar, { path: buildPath(endpoints.uploadAvatar.path), body: form, ...opts })
}

export const removeAvatar = (opts: CallOptions = {}) => send(endpoints.removeAvatar, { path: buildPath(endpoints.removeAvatar.path), ...opts })

export const changePassword = (body: ChangePasswordRequest, opts: CallOptions = {}) =>
  send(endpoints.changePassword, { path: buildPath(endpoints.changePassword.path), body, ...opts })
