/**
 * "Carteira e rede" (PAG-2): choose one of the REGISTERED wallets, pick the network and run the simulated
 * provider handshake: connect (`connected`), refusal (`rejected`, not an HTTP error) and disconnect. The
 * connection is required to confirm the purchase; changing wallet or network drops it (the server ties a
 * connection to one wallet and network and validates it again on `POST /orders`).
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { NETWORKS, type Network, type Wallet } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DraftConnection } from './draft'
import { NETWORK_LABELS, shortAddress, SLOT_LABELS, WALLET_TYPE_LABELS } from './labels'
import { isSameUser, useConnectWallet, useDisconnectWallet } from './wallets'
import { useUserCredential } from '@/queries/orders'

export interface WalletPanelProps {
  wallets: Wallet[]
  walletId: string
  network: Network
  connection: DraftConnection | null
  /** Form error of `connectionId` ("Conecte a carteira para continuar"). */
  error: string | undefined
  onWalletChange: (walletId: string) => void
  onNetworkChange: (network: Network) => void
  onConnection: (connection: DraftConnection | null) => void
  onMessage: (text: string) => void
}

export function WalletPanel({ wallets, walletId, network, connection, error, onWalletChange, onNetworkChange, onConnection, onMessage }: WalletPanelProps) {
  const user = useUserCredential()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [rejection, setRejection] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const selected = wallets.find((w) => w.id === walletId)
  const connected = connection && connection.walletId === walletId && connection.network === network ? connection : null

  if (wallets.length === 0) {
    return (
      <div data-testid="wallet-empty" className="rounded-control border border-line-soft bg-surface-card p-4 text-body-sm text-text-primary">
        <p className="font-bold">Nenhuma carteira cadastrada</p>
        <p className="mt-1 text-text-secondary">Cadastre uma carteira principal para concluir a compra.</p>
        <Button asChild className="mt-3 h-10 rounded-control px-5 text-body-md font-bold">
          <Link to="/wallets">Cadastrar carteira</Link>
        </Button>
      </div>
    )
  }

  const doConnect = () => {
    setRejection(null)
    setFailure(null)
    connect.mutate(
      { walletId, network },
      {
        onSuccess: (result) => {
          if (!isSameUser(user)) return // the session changed while the handshake was in flight: discard the result
          if (result.status === 'connected') {
            onConnection({ connectionId: result.connectionId, walletId: result.walletId, network: result.network, address: result.address })
            onMessage(`Carteira conectada na rede ${NETWORK_LABELS[result.network]}.`)
          } else {
            onConnection(null)
            setRejection(result.reason)
            onMessage(`Conexão recusada: ${result.reason}`)
          }
        },
        onError: () => {
          setFailure('Não foi possível conectar agora. Tente novamente.')
          onMessage('Não foi possível conectar a carteira.')
        },
      },
    )
  }

  const doDisconnect = () => {
    setFailure(null)
    disconnect.mutate(
      { walletId },
      {
        onSuccess: () => {
          if (!isSameUser(user)) return
          onConnection(null)
          onMessage('Carteira desconectada.')
        },
        onError: () => setFailure('Não foi possível desconectar agora. Tente novamente.'),
      },
    )
  }

  const changeWallet = (id: string) => {
    setRejection(null)
    onWalletChange(id)
  }

  return (
    <fieldset data-testid="wallet-panel" className="min-w-0 border-0 p-0">
      <legend className="mb-3 text-body-md font-bold text-text-primary">Carteira e rede</legend>
      <div role="radiogroup" aria-label="Carteira cadastrada" className="flex flex-col gap-3">
        {wallets.map((w) => {
          const checked = w.id === walletId
          return (
            <label
              key={w.id}
              className={cn(
                'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border px-4 py-2 text-body-sm text-text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/60',
                checked ? 'border-text-primary' : 'border-line-soft',
              )}
            >
              <input type="radio" name="wallet" value={w.id} checked={checked} onChange={() => changeWallet(w.id)} className="size-4 shrink-0 accent-brand" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">
                  {SLOT_LABELS[w.slot]} · {WALLET_TYPE_LABELS[w.type]}
                </span>
                <span className="truncate text-caption-sm text-text-secondary">
                  {w.label} · {shortAddress(w.address)}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      <div className="mt-4">
        <label htmlFor="checkout-network" className="text-body-sm text-text-primary">
          Rede
        </label>
        <select
          id="checkout-network"
          value={network}
          onChange={(e) => {
            setRejection(null)
            onNetworkChange(e.target.value as Network)
          }}
          className="mt-1.5 h-10 w-full rounded-control border border-line-soft bg-transparent px-3 text-body-sm text-text-primary outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {NETWORKS.map((n) => (
            <option key={n} value={n} className="bg-surface-card">
              {NETWORK_LABELS[n]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-2" data-testid="wallet-connection">
        <p role="status" data-testid="wallet-status" data-state={connected ? 'connected' : 'disconnected'} className="text-body-sm text-text-primary">
          {connected
            ? `Carteira conectada: ${selected?.label ?? ''} · ${shortAddress(connected.address)} · ${NETWORK_LABELS[connected.network]}`
            : 'Carteira desconectada.'}
        </p>
        {connected ? (
          <Button type="button" variant="outline" onClick={doDisconnect} disabled={disconnect.isPending} className="h-10 rounded-control text-body-md font-bold">
            Desconectar carteira
          </Button>
        ) : (
          <Button
            type="button"
            onClick={doConnect}
            disabled={connect.isPending}
            aria-describedby={error ? 'checkout-connection-error' : undefined}
            className="h-10 rounded-control text-body-md font-bold"
          >
            {connect.isPending ? 'Conectando…' : 'Conectar carteira'}
          </Button>
        )}
        {rejection ? (
          <p role="alert" data-testid="wallet-rejected" className="text-caption-sm text-destructive">
            Conexão recusada: {rejection}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-caption-sm text-destructive">
            {failure}
          </p>
        ) : null}
        {error && !connected ? (
          <p id="checkout-connection-error" role="alert" className="text-caption-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  )
}
