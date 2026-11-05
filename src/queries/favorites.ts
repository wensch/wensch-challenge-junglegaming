/**
 * Favorites (FAV-1, INT-8): `['u', userId, 'favorites']`, authenticated only.
 * The toggle is optimistic: `onMutate` snapshots and writes the new membership, `onError` rolls back
 * and announces the failure (sonner region = `aria-live="polite"`), `onSettled` re-syncs with the
 * server. Every write checks that the owner is still the current identity.
 */
import { queryOptions, skipToken, useMutation, type QueryKey, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nftSummarySchema, type ApiError, type FavoriteToggleResponse, type FavoritesResponse, type NftSummary } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { STALE } from './client'
import { queryKeys } from './keys'
import { isCurrentOwner, ownedQueryFn, type OwnerCredential } from './owner'
import { useSession } from './session'
import { keepNewest } from './versioned'

const NO_FAVORITES_KEY = ['favorites', 'none'] as const

export type UserOwner =Extract<OwnerCredential, { kind: 'user' }>

const favoritesQueryOptions = (owner: UserOwner) =>
  queryOptions({
    queryKey: queryKeys.user(owner.userId).favorites(),
    queryFn: ownedQueryFn(owner, (as, signal) => favoritesApi.listFavorites({ signal, as })),
    staleTime: STALE.account,
    structuralSharing: keepNewest,
  })

/** Logged user as a cache owner (`null` for visitors and while the session is resolving). */
function useUserOwner(): UserOwner | null {
  const session = useSession()
  return session.data ? { kind: 'user', userId: session.data.user.id, token: session.data.token } : null
}

/** Favorites of the logged user. Without a session no request is made. */
export function useFavorites() {
  const owner = useUserOwner()
  // Without an owner the observer sits on a non-private placeholder key (never fetched), so nothing
  // is created under `['u', ...]` after a teardown (same pattern as `useCart`).
  const query = useQuery<FavoritesResponse, ApiError, FavoritesResponse, QueryKey>({
    queryKey: owner ? favoritesQueryOptions(owner).queryKey : NO_FAVORITES_KEY,
    queryFn: owner ? ownedQueryFn(owner, (as, signal) => favoritesApi.listFavorites({ signal, as })) : skipToken,
    staleTime: STALE.account,
    structuralSharing: keepNewest,
  })
  return { ...query, owner }
}

/** Membership helper for hearts: `isFavorite(id)`, `ready` once the list is known. */
export function useFavoriteState() {
  const { data, owner, isError, refetch } = useFavorites()
  const ids = data ? new Set(data.nftIds) : null
  return { owner, ready: ids !== null, isError, refetch, isFavorite: (nftId: string) => ids?.has(nftId) ?? false }
}

/** Summary stripped of detail-only fields (what the favorites list stores). */
export const toSummary = (nft: NftSummary): NftSummary => nftSummarySchema.parse(nft)

function withMembership(data: FavoritesResponse, nft: NftSummary, favorited: boolean): FavoritesResponse {
  const nftIds = data.nftIds.filter((id) => id !== nft.id)
  const items = data.items.filter((item) => item.id !== nft.id)
  return favorited ? { nftIds: [nft.id, ...nftIds], items: [toSummary(nft), ...items] } : { nftIds, items }
}

interface ToggleFavoriteVars {
  nft: NftSummary
  /** Desired state after the click. */
  favorited: boolean
  owner: UserOwner
}

interface ToggleContext {
  previous: FavoritesResponse | undefined
}

const MUTATION_KEY = ['favorites', 'toggle'] as const

/** Rollback: the snapshot wins unless a newer toggle is pending; then only this NFT is reverted. */
function rollback(queryClient: QueryClient, owner: UserOwner, previous: FavoritesResponse | undefined, nft: NftSummary, favorited: boolean) {
  const key = queryKeys.user(owner.userId).favorites()
  if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) > 1) {
    const current = queryClient.getQueryData<FavoritesResponse>(key)
    if (current) queryClient.setQueryData<FavoritesResponse>(key, withMembership(current, nft, !favorited))
    return
  }
  if (previous) queryClient.setQueryData<FavoritesResponse>(key, previous)
}

/** `scopeId` (userId + nftId) makes toggles of the same NFT run serially, so clicks reach the server in order. */
export function useToggleFavorite(scopeId: string) {
  const queryClient = useQueryClient()
  return useMutation<FavoriteToggleResponse, ApiError, ToggleFavoriteVars, ToggleContext>({
    mutationKey: MUTATION_KEY,
    scope: { id: `favorite:${scopeId}` },
    mutationFn: ({ nft, favorited, owner }) => {
      const as = { token: owner.token }
      return favorited ? favoritesApi.addFavorite(nft.id, { as }) : favoritesApi.removeFavorite(nft.id, { as })
    },
    onMutate: async ({ nft, favorited, owner }) => {
      const key = queryKeys.user(owner.userId).favorites()
      // An in-flight refetch must not overwrite the optimistic value when it lands.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      if (previous && isCurrentOwner(owner)) queryClient.setQueryData<FavoritesResponse>(key, withMembership(previous, nft, favorited))
      return { previous }
    },
    onError: (_error, { nft, favorited, owner }, context) => {
      if (isCurrentOwner(owner)) rollback(queryClient, owner, context?.previous, nft, favorited)
      toast.error(favorited ? 'Não foi possível adicionar aos favoritos. A alteração foi desfeita.' : 'Não foi possível remover dos favoritos. A alteração foi desfeita.')
    },
    onSuccess: (_data, { nft, favorited }) => {
      toast.success(favorited ? `${nft.name} foi adicionado aos favoritos.` : `${nft.name} foi removido dos favoritos.`)
    },
    onSettled: (_data, _error, { owner }) => {
      // With several toggles in flight only the last one re-syncs, so it cannot undo a newer click.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) > 1 || !isCurrentOwner(owner)) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.user(owner.userId).favorites() })
    },
  })
}
