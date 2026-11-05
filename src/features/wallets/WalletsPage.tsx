/**
 * Carteiras (Figma 9:1670): primary and secondary wallet. Server state through `useWallets` (private
 * query, keepNewest). Empty secondary slot = honest empty state with "Adicionar".
 */
import { useRef, useState } from 'react'
import type { Wallet } from '@/api/contracts'
import { errorMessageOf } from '@/components/layout/PageStates'
import { AccountLayout, FormSkeleton, LoadError } from '@/features/profile/AccountLayout'
import { useWallets } from '@/queries/account'
import { BLANK_WALLET, WalletForm, walletToValues } from './WalletForm'

const addButton = 'rounded-control px-1 text-body-md font-bold text-text-accent underline-offset-4 hover:underline disabled:opacity-50'

export function WalletsPage() {
  const wallets = useWallets()
  return (
    <AccountLayout title="Carteiras">
      {wallets.isPending ? (
        <FormSkeleton rows={10} />
      ) : wallets.isError ? (
        <LoadError message={errorMessageOf(wallets.error)} onRetry={() => void wallets.refetch()} retrying={wallets.isFetching} />
      ) : (
        <>
          <p role="status" className="mb-4 min-h-4 text-caption-sm text-text-secondary">
            {wallets.isFetching ? 'Atualizando carteiras…' : ''}
          </p>
          <PrimarySection wallet={wallets.data.primary} />
          <SecondarySection wallet={wallets.data.secondary} primary={wallets.data.primary} />
        </>
      )}
    </AccountLayout>
  )
}

function PrimarySection({ wallet }: { wallet: Wallet | null }) {
  const first = useRef<HTMLInputElement | null>(null)
  return (
    <section aria-labelledby="primary-title">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="primary-title" className="text-body-md font-bold text-text-primary">
            Carteira principal
          </h2>
          <p className="mt-1 text-caption-sm text-text-secondary">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </div>
        {!wallet && (
          <button type="button" className={addButton} onClick={() => first.current?.focus()}>
            Adicionar
          </button>
        )}
      </div>
      <WalletForm slot="primary" wallet={wallet} initial={BLANK_WALLET} title="Carteira principal" firstFieldRef={first} />
    </section>
  )
}

function SecondarySection({ wallet, primary }: { wallet: Wallet | null; primary: Wallet | null }) {
  const [adding, setAdding] = useState(false)
  const [same, setSame] = useState(false)
  const showForm = wallet !== null || adding
  // "Igual à carteira principal" copies the data of the primary one except the address (the API rejects a duplicated address).
  const initial = same && primary ? { ...walletToValues(primary), address: '' } : BLANK_WALLET
  return (
    <section aria-labelledby="secondary-title" className="mt-12">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="secondary-title" className="text-body-md font-bold text-text-primary">
            Carteira secundária
          </h2>
          {!showForm && <p className="mt-1 text-caption-sm text-text-secondary">Você ainda não adicionou uma carteira secundária.</p>}
        </div>
        {!showForm && (
          <div className="flex items-center gap-4 max-lg:ml-auto">
            <label className="flex items-center gap-2 text-caption-sm text-text-primary">
              <input
                type="checkbox"
                checked={same}
                disabled={!primary}
                onChange={(e) => setSame(e.target.checked)}
                className="size-4 accent-primary"
              />
              Igual à carteira principal
            </label>
            <button type="button" className={addButton} onClick={() => setAdding(true)}>
              Adicionar
            </button>
          </div>
        )}
      </div>
      {showForm && <WalletForm slot="secondary" wallet={wallet} initial={initial} title="Carteira secundária" />}
    </section>
  )
}
