/**
 * Wallet access for the checkout (PAG-2): registered wallets + the simulated provider handshake
 * (connect -> `connected` | `rejected`, disconnect). The list uses the same private key the wallets slice
 * uses (`['u', userId, 'wallets']`) and `keepNewest` (versioned resources). Connection state is NOT cached:
 * it belongs to the checkout form (draft) and the server validates it again on `POST /orders`.
 */
import { skipToken, useMutation, useQuery, type QueryKey } from '@tanstack/react-query'
import type { ApiError, Network, Wallet, WalletConnection, WalletsResponse } from '@/api/contracts'
import { walletsApi } from '@/api/endpoints'
import { STALE } from '@/queries/client'
import { queryKeys } from '@/queries/keys'
import { isCurrentOwner, ownedQueryFn } from '@/queries/owner'
import { useUserCredential, type UserCredential } from '@/queries/orders'
import { keepNewest } from '@/queries/versioned'

const NO_WALLETS_KEY = ['wallets', 'none'] as const

const fetchWallets = (user: UserCredential) => ownedQueryFn({ kind: 'user', ...user }, (as, signal) => walletsApi.listWallets({ signal, as }))

export function useWallets() {
  const user = useUserCredential()
  return useQuery<WalletsResponse, ApiError, WalletsResponse, QueryKey>({
    queryKey: user ? queryKeys.user(user.userId).wallets() : NO_WALLETS_KEY,
    queryFn: user ? fetchWallets(user) : skipToken,
    staleTime: STALE.account,
    structuralSharing: keepNewest,
  })
}

/** Registered wallets as a list (primary first). */
export function walletList(data: WalletsResponse | undefined): Wallet[] {
  return [data?.primary, data?.secondary].filter((w): w is Wallet => !!w)
}

export function useConnectWallet() {
  const user = useUserCredential()
  return useMutation<WalletConnection, ApiError, { walletId: string; network: Network }>({
    mutationFn: ({ walletId, network }) => {
      if (!user) throw new Error('Sem sessão.')
      return walletsApi.connectWallet(walletId, { network }, { as: { token: user.token } })
    },
    // No cache writes: the caller applies the result after checking it is still the same user (F8).
  })
}

export function useDisconnectWallet() {
  const user = useUserCredential()
  return useMutation<undefined, ApiError, { walletId: string }>({
    mutationFn: async ({ walletId }) => {
      if (!user) throw new Error('Sem sessão.')
      await walletsApi.disconnectWallet(walletId, { as: { token: user.token } })
      return undefined
    },
  })
}

/** True while `user` is still the logged identity (a connect that resolves after a logout is dropped). */
export const isSameUser = (user: UserCredential | null) => !!user && isCurrentOwner({ kind: 'user', ...user })
