/** Wallet endpoints (API-8). */
import { buildPath, endpoints, type ConnectWalletRequest, type CreateWalletRequest, type UpdateWalletRequest } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const listWallets = (opts: CallOptions = {}) => send(endpoints.listWallets, { path: buildPath(endpoints.listWallets.path), ...opts })

export const createWallet = (body: CreateWalletRequest, opts: CallOptions = {}) =>
  send(endpoints.createWallet, { path: buildPath(endpoints.createWallet.path), body, ...opts })

export const updateWallet = (walletId: string, body: UpdateWalletRequest, opts: CallOptions = {}) =>
  send(endpoints.updateWallet, { path: buildPath(endpoints.updateWallet.path, { walletId }), body, ...opts })

export const connectWallet = (walletId: string, body: ConnectWalletRequest, opts: CallOptions = {}) =>
  send(endpoints.connectWallet, { path: buildPath(endpoints.connectWallet.path, { walletId }), body, ...opts })

export const disconnectWallet = (walletId: string, opts: CallOptions = {}) =>
  send(endpoints.disconnectWallet, { path: buildPath(endpoints.disconnectWallet.path, { walletId }), ...opts })
