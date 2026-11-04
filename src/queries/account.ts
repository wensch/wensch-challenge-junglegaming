/**
 * Profile and wallets (ARCHITECTURE §7): private queries under `['u', userId, ...]`, fetched with the
 * owner's token (`ownedQueryFn`) and written through `keepNewest`, so a late response can never
 * move `version` backwards. Mutations carry the token of the user that started them (`as`) and only
 * write to the cache while that user is still the current one (a logout or user switch in between
 * must not resurrect a removed `['u', ...]` entry).
 */
import { queryOptions, skipToken, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type {
  ApiError,
  ChangePasswordRequest,
  CreateWalletRequest,
  Profile,
  Session,
  UpdateProfileRequest,
  UpdateWalletRequest,
  Wallet,
  WalletsResponse,
} from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/endpoints'
import { STALE } from './client'
import { queryKeys } from './keys'
import { ownedQueryFn, ownerChangedError } from './owner'
import type { UserCredential } from './orders'
import { cachedSession, currentUserId, sessionQueryOptions, useSession } from './session'
import { keepNewest } from './versioned'

export const accountQueries = {
  profile: (user: UserCredential) =>
    queryOptions({
      queryKey: queryKeys.user(user.userId).profile(),
      queryFn: ownedQueryFn({ kind: 'user', ...user }, (as, signal) => profileApi.getProfile({ signal, as })),
      staleTime: STALE.account,
      structuralSharing: keepNewest,
    }),
  wallets: (user: UserCredential) =>
    queryOptions({
      queryKey: queryKeys.user(user.userId).wallets(),
      queryFn: ownedQueryFn({ kind: 'user', ...user }, (as, signal) => walletsApi.listWallets({ signal, as })),
      staleTime: STALE.account,
      structuralSharing: keepNewest,
    }),
}

const NO_USER_KEY = ['account', 'none'] as const

/** Logged user + token (the credential every private query is bound to), or null for a visitor. */
export function useAccountUser(): UserCredential | null {
  const session = useSession()
  return session.data ? { userId: session.data.user.id, token: session.data.token } : null
}

export function useProfile() {
  const user = useAccountUser()
  return useQuery<Profile, ApiError, Profile, QueryKey>({
    queryKey: user ? queryKeys.user(user.userId).profile() : NO_USER_KEY,
    queryFn: user ? ownedQueryFn({ kind: 'user', ...user }, (as, signal) => profileApi.getProfile({ signal, as })) : skipToken,
    staleTime: STALE.account,
    structuralSharing: keepNewest,
  })
}

export function useWallets() {
  const user = useAccountUser()
  return useQuery<WalletsResponse, ApiError, WalletsResponse, QueryKey>({
    queryKey: user ? queryKeys.user(user.userId).wallets() : NO_USER_KEY,
    queryFn: user ? ownedQueryFn({ kind: 'user', ...user }, (as, signal) => walletsApi.listWallets({ signal, as })) : skipToken,
    staleTime: STALE.account,
    structuralSharing: keepNewest,
  })
}

/** Reflects name/e-mail/avatar changes in the header (`['session']`), only if it is still the same session. */
function patchSessionUser(qc: QueryClient, token: string, profile: Profile) {
  const current = cachedSession(qc)
  if (!current || current.token !== token) return
  const next: Session = {
    ...current,
    user: { ...current.user, displayName: profile.displayName, username: profile.username, email: profile.email, avatarUrl: profile.avatarUrl },
  }
  qc.setQueryData(sessionQueryOptions().queryKey, next)
}

function useProfileWriter() {
  const qc = useQueryClient()
  const user = useAccountUser()
  return {
    user,
    write(profile: Profile) {
      if (!user || currentUserId(qc) !== user.userId) return
      qc.setQueryData(queryKeys.user(user.userId).profile(), profile)
      patchSessionUser(qc, user.token, profile)
    },
    refetch() {
      if (user) void qc.invalidateQueries({ queryKey: queryKeys.user(user.userId).profile() })
    },
  }
}

function requireUser(user: UserCredential | null): UserCredential {
  if (!user) throw ownerChangedError()
  return user
}

export function useUpdateProfile() {
  const w = useProfileWriter()
  return useMutation<Profile, ApiError, UpdateProfileRequest>({
    mutationFn: (body) => profileApi.updateProfile(body, { as: { token: requireUser(w.user).token } }),
    onSuccess: (p) => w.write(p),
    onError: (e) => {
      if (e.is('CONFLICT_VERSION')) w.refetch()
    },
  })
}

export function useUploadAvatar() {
  const w = useProfileWriter()
  return useMutation<Profile, ApiError, File>({
    mutationFn: (file) => profileApi.uploadAvatar(file, { as: { token: requireUser(w.user).token } }),
    onSuccess: (p) => w.write(p),
  })
}

export function useRemoveAvatar() {
  const w = useProfileWriter()
  return useMutation<Profile, ApiError, undefined>({
    mutationFn: () => profileApi.removeAvatar({ as: { token: requireUser(w.user).token } }),
    onSuccess: (p) => w.write(p),
  })
}

export function useChangePassword() {
  const user = useAccountUser()
  return useMutation<undefined, ApiError, ChangePasswordRequest>({
    mutationFn: (body) => profileApi.changePassword(body, { as: { token: requireUser(user).token } }),
  })
}

export type SaveWalletInput =
  | { mode: 'create'; body: CreateWalletRequest }
  | { mode: 'update'; walletId: string; body: UpdateWalletRequest }

export function useSaveWallet() {
  const qc = useQueryClient()
  const user = useAccountUser()
  return useMutation<Wallet, ApiError, SaveWalletInput>({
    mutationFn: (input) => {
      const as = { token: requireUser(user).token }
      return input.mode === 'create' ? walletsApi.createWallet(input.body, { as }) : walletsApi.updateWallet(input.walletId, input.body, { as })
    },
    onSuccess: (wallet) => {
      if (!user || currentUserId(qc) !== user.userId) return
      qc.setQueryData(queryKeys.user(user.userId).wallets(), (old) => ({
        primary: old?.primary ?? null,
        secondary: old?.secondary ?? null,
        [wallet.slot]: wallet,
      }))
    },
    onError: (e) => {
      if (user && (e.is('CONFLICT_VERSION') || e.is('NOT_FOUND'))) void qc.invalidateQueries({ queryKey: queryKeys.user(user.userId).wallets() })
    },
  })
}
