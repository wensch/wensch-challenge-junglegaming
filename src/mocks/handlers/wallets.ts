import { isValidAddress } from '@/api/contracts'
import { db, nextId, nowIso, persist, type WalletRec } from '../db'
import { fail, route, validationFail } from '../http'
import { isActive } from '../scenario-state'

function owned(walletId: string, userId: string, forbidAny = false): WalletRec {
  if (forbidAny) fail({ code: 'FORBIDDEN', message: 'Você não tem acesso a esta carteira.' })
  const w = db().wallets.find((x) => x.id === walletId)
  if (!w) fail({ code: 'NOT_FOUND', message: 'Carteira não encontrada.', resource: { kind: 'wallet', id: walletId } })
  if (w.userId !== userId) fail({ code: 'FORBIDDEN', message: 'Você não tem acesso a esta carteira.' })
  return w
}

// The contract response schema strips internal fields (userId).
const publicWallet = (w: WalletRec) => w

export const walletHandlers = [
  route('listWallets', ({ auth }) => {
    const mine = db().wallets.filter((w) => w.userId === auth.user!.id)
    const slot = (s: 'primary' | 'secondary') => {
      const w = mine.find((x) => x.slot === s)
      return w ? publicWallet(w) : null
    }
    return { primary: slot('primary'), secondary: slot('secondary') }
  }),

  route('createWallet', ({ auth, body }) => {
    const me = auth.user!
    if (isActive('forms.server-validation')) validationFail({ label: ['Este apelido já está em uso'] })
    const mine = db().wallets.filter((w) => w.userId === me.id)
    if (mine.some((w) => w.slot === body.slot)) validationFail({ slot: ['Já existe uma carteira neste slot'] })
    if (mine.some((w) => w.address.toLowerCase() === body.address.toLowerCase())) validationFail({ address: ['Este endereço já está cadastrado'] })
    const now = nowIso()
    const { alternateAddress, ...rest } = body
    const wallet: WalletRec = { ...rest, id: nextId('wal', 3), userId: me.id, alternateAddress: alternateAddress ?? null, version: 1, createdAt: now, updatedAt: now }
    db().wallets.push(wallet)
    persist()
    return publicWallet(wallet)
  }),

  route('updateWallet', ({ auth, params, body }) => {
    const wallet = owned(params.walletId!, auth.user!.id, isActive('auth.forbidden'))
    if (isActive('forms.server-validation')) validationFail({ label: ['Este apelido já está em uso'] })
    if (body.version !== wallet.version) {
      fail({ code: 'CONFLICT_VERSION', message: 'A carteira foi alterada em outro lugar. Recarregue e tente novamente.', resource: { kind: 'wallet', id: wallet.id }, currentVersion: wallet.version })
    }
    const duplicate = db().wallets.some((w) => w.userId === wallet.userId && w.id !== wallet.id && w.address.toLowerCase() === body.address.toLowerCase())
    if (duplicate) validationFail({ address: ['Este endereço já está cadastrado'] })
    const { alternateAddress, ...fields } = body
    const changedTarget = wallet.address !== body.address || wallet.network !== body.network
    Object.assign(wallet, fields, { alternateAddress: alternateAddress ?? null, version: wallet.version + 1, updatedAt: nowIso() })
    if (changedTarget) db().connections = db().connections.filter((c) => c.walletId !== wallet.id)
    persist()
    return publicWallet(wallet)
  }),

  route('connectWallet', ({ auth, params, body }) => {
    const wallet = owned(params.walletId!, auth.user!.id)
    if (isActive('wallet.reject')) return { status: 'rejected' as const, walletId: wallet.id, reason: 'Conexão recusada na carteira.' }
    if (!isValidAddress(body.network, wallet.address)) {
      return { status: 'rejected' as const, walletId: wallet.id, reason: 'O endereço da carteira não é compatível com a rede escolhida.' }
    }
    db().connections = db().connections.filter((c) => c.walletId !== wallet.id)
    const connection = { connectionId: nextId('con'), userId: auth.user!.id, walletId: wallet.id, network: body.network, address: wallet.address, connectedAt: nowIso() }
    db().connections.push(connection)
    persist()
    return { status: 'connected' as const, connectionId: connection.connectionId, walletId: wallet.id, network: body.network, address: wallet.address, connectedAt: connection.connectedAt }
  }),

  route('disconnectWallet', ({ auth, params }) => {
    const wallet = db().wallets.find((w) => w.id === params.walletId && w.userId === auth.user!.id)
    if (!wallet) fail({ code: 'NOT_FOUND', message: 'Carteira não encontrada.', resource: { kind: 'wallet', id: params.walletId! } })
    db().connections = db().connections.filter((c) => c.walletId !== wallet.id)
    persist()
    return undefined
  }),
]
