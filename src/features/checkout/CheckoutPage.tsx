/**
 * Checkout page shell (TEL-4): resolves who/what (session, cart, registered wallets) and renders the
 * state: loading skeleton (same dimensions), error with retry, empty cart, or the form.
 */
import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessageOf } from '@/components/layout/PageStates'
import { PendingOrderBanner } from '@/features/order/PendingOrderBanner'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { useCart } from '@/queries/cart'
import { useUserCredential } from '@/queries/orders'
import { useSession } from '@/queries/session'
import { CheckoutForm } from './CheckoutForm'
import { walletList, useWallets } from './wallets'

function CheckoutSkeleton() {
  return (
    <div data-testid="checkout-page-skeleton" aria-hidden="true" className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_405px] lg:gap-[46px]">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[66px] w-full" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[45px] w-full" />
      </div>
    </div>
  )
}

export function CheckoutPage() {
  const router = useRouter()
  const session = useSession()
  const credential = useUserCredential()
  const cart = useCart()
  const wallets = useWallets()
  const headingRef = usePageHeadingFocus()
  const [announcement, setAnnouncement] = useState('')

  const user = session.data?.user
  const lines = cart.data?.lines ?? []
  const loading = session.isPending || cart.isPending || wallets.isPending
  const failed = cart.isError ? cart.error : wallets.isError ? wallets.error : null

  return (
    <section className="mx-auto w-full max-w-page px-gutter pt-6 pb-24 xl:px-0 lg:pb-16">
      <div className="relative flex items-center justify-center lg:block">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Voltar"
          className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface-card text-text-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:hidden"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 ref={headingRef} tabIndex={-1} className="text-body-lg font-bold text-text-primary outline-none lg:sr-only">
          Pagamento
        </h1>
      </div>
      <nav aria-label="Trilha de navegação" className="hidden text-body-sm font-bold text-text-primary lg:block">
        <Link to="/" className="hover:underline">
          Início
        </Link>
        {' / '}
        <Link to="/" hash="mercado" className="hover:underline">
          Mercado
        </Link>
        {' / '}
        <span aria-current="page">Pagamento</span>
      </nav>

      <p role="status" aria-live="polite" className="sr-only" data-testid="checkout-announcer">
        {announcement}
      </p>

      <div className="mt-4">
        <PendingOrderBanner />
      </div>

      {loading ? (
        <CheckoutSkeleton />
      ) : failed ? (
        <div role="alert" className="mt-10 flex flex-col items-start gap-3 rounded-card border border-line-soft bg-surface-card p-8">
          <p className="text-body text-text-primary">{errorMessageOf(failed)}</p>
          <Button
            onClick={() => {
              if (cart.isError) void cart.refetch()
              if (wallets.isError) void wallets.refetch()
            }}
            className="h-10 rounded-control px-5 text-body-md font-bold"
          >
            Tentar novamente
          </Button>
        </div>
      ) : lines.length === 0 ? (
        <div data-testid="checkout-empty" className="mt-10 flex flex-col items-start gap-4 rounded-card border border-line-soft bg-surface-card p-8">
          <p className="text-body-lg font-bold text-text-primary">Seu carrinho está vazio</p>
          <p className="text-body-sm text-text-secondary">Adicione NFTs ao carrinho para concluir uma compra.</p>
          <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
            <Link to="/" hash="mercado">
              Explorar o mercado
            </Link>
          </Button>
        </div>
      ) : user && credential ? (
        <CheckoutForm user={user} credential={credential} cartLines={lines} wallets={walletList(wallets.data)} onAnnounce={setAnnouncement} />
      ) : null}
    </section>
  )
}
