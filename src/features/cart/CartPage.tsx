/**
 * Cart page (TEL-3, CAR-1..6). Cart lines come from `GET /cart`; subtotal / discount / fee / total come
 * ONLY from the quote (`POST /quotes`). Price and availability changes pushed by `nft.updated` reach
 * this page through the reconciler (cart + quote invalidated) and are announced in a live region.
 * States: loading (skeleton, same dimensions), empty, error with retry, success, background refetch.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { isApiError, type CartLine, type Quote, type QuoteIssue } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessageOf } from '@/components/layout/PageStates'
import { OrderTotals } from '@/features/shared/OrderTotals'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { PendingOrderBanner } from '@/features/order/PendingOrderBanner'
import { realtime } from '@/realtime/socket'
import { useCart, useCartOwner } from '@/queries/cart'
import { useRemoveLine, useUpdateQuantity } from '@/queries/cart-mutations'
import { useQuote } from '@/queries/quote'
import { useSession } from '@/queries/session'
import { CartLineRow } from './CartLineRow'
import { CouponForm } from './CouponForm'
import { RelatedNfts } from './RelatedNfts'

/** Network of the cart summary estimate (the checkout re-quotes for the wallet's network). */
const CART_NETWORK = 'ethereum' as const

function issueMessage(issue: QuoteIssue): string | null {
  switch (issue.kind) {
    case 'coupon_expired':
      return `O cupom ${issue.code} expirou. Remova-o para continuar.`
    case 'coupon_invalid':
      return `O cupom ${issue.code} não é mais válido. Remova-o para continuar.`
    case 'insufficient':
    case 'sold_out':
      return 'Há itens indisponíveis na quantidade escolhida. Ajuste ou remova-os para continuar.'
    case 'empty_cart':
      return null
  }
}

function blockingMessages(quote: Quote | undefined): string[] {
  if (!quote) return []
  return [...new Set(quote.issues.map(issueMessage).filter((m): m is string => m !== null))]
}

function CartSkeleton() {
  return (
    <div data-testid="cart-skeleton" className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:mt-3 lg:grid-cols-[minmax(0,1fr)_332px] lg:gap-[86px]" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="hidden h-4 w-full lg:block" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-card lg:h-[70px] lg:rounded-none" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:min-h-[423px]">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div data-testid="cart-empty" className="mt-10 flex flex-col items-start gap-4 rounded-card border border-line-soft bg-surface-card p-8">
      <p className="text-body-lg font-bold text-text-primary">Seu carrinho está vazio</p>
      <p className="text-body-sm text-text-secondary">Explore o mercado e adicione NFTs para continuar.</p>
      <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
        <Link to="/" hash="mercado">
          Explorar o mercado
        </Link>
      </Button>
    </div>
  )
}

export function CartPage() {
  const router = useRouter()
  const session = useSession()
  const owner = useCartOwner()
  const cart = useCart()
  const lines = cart.data?.lines ?? []
  const quote = useQuote(owner, CART_NETWORK, lines.length > 0)
  const update = useUpdateQuantity()
  const remove = useRemoveLine()
  const headingRef = usePageHeadingFocus()
  const [announcement, setAnnouncement] = useState('')

  // Live changes (`nft.updated` applied by the reconciler): tell the user what moved.
  const linesRef = useRef<CartLine[]>(lines)
  useEffect(() => {
    linesRef.current = lines
  })
  useEffect(
    () =>
      realtime.onEvent((e) => {
        if (e.type !== 'nft.updated') return
        const line = linesRef.current.find((l) => l.nftId === e.data.nftId)
        if (line) setAnnouncement(`${line.name} foi atualizado: o preço ou a disponibilidade mudou. O resumo foi atualizado.`)
      }),
    [],
  )

  const loading = session.isPending || (owner !== null && cart.isPending)
  const changed = lines.filter((l) => l.status !== 'ok')
  const blocking = blockingMessages(quote.data)
  const orderable = !!quote.data?.orderable && changed.every((l) => l.status === 'price_changed' || l.status === 'ok')
  const refreshing = (cart.isFetching || quote.isFetching) && !loading

  const onQuantity = (line: CartLine, quantity: number) => {
    update.mutate(
      { lineId: line.id, quantity },
      {
        onSuccess: () => setAnnouncement(`Quantidade de ${line.name} atualizada para ${quantity}.`),
        onError: (error) =>
          setAnnouncement(
            isApiError(error) && error.is('CONFLICT_AVAILABILITY')
              ? `Não foi possível alterar ${line.name}: ${error.message} A quantidade anterior foi restaurada.`
              : `Não foi possível alterar a quantidade de ${line.name}. A quantidade anterior foi restaurada.`,
          ),
      },
    )
  }
  const onRemove = (line: CartLine) => {
    remove.mutate(
      { lineId: line.id },
      {
        onSuccess: () => setAnnouncement(`${line.name} removido do carrinho.`),
        onError: () => setAnnouncement(`Não foi possível remover ${line.name}. O item continua no carrinho.`),
      },
    )
  }

  return (
    <section className="mx-auto w-full max-w-page px-gutter pt-6 pb-24 xl:px-0 lg:pb-16" aria-busy={loading || refreshing}>
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
          Carrinho de NFTs
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
        <span aria-current="page">Carrinho</span>
      </nav>

      <p role="status" aria-live="polite" className="sr-only" data-testid="cart-announcer">
        {announcement}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <PendingOrderBanner />
        {changed.length > 0 && (
          <div data-testid="cart-changes" role="status" className="rounded-control border border-line-soft bg-surface-card px-4 py-3 text-body-sm text-text-primary">
            O preço ou a disponibilidade de {changed.length === 1 ? '1 item' : `${changed.length} itens`} mudou. O resumo foi atualizado.
          </div>
        )}
      </div>

      {loading ? (
        <CartSkeleton />
      ) : cart.isError ? (
        <div role="alert" className="mt-10 flex flex-col items-start gap-3 rounded-card border border-line-soft bg-surface-card p-8">
          <p className="text-body text-text-primary">{errorMessageOf(cart.error)}</p>
          <Button onClick={() => void cart.refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
            Tentar novamente
          </Button>
        </div>
      ) : lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:mt-3 lg:grid-cols-[minmax(0,1fr)_332px] lg:gap-[86px]">
          <div>
            <div aria-hidden="true" className="mb-3 hidden grid-cols-[minmax(0,1fr)_110px_75px_110px_24px] gap-x-6 xl:gap-x-10 border-b border-line pr-6 pb-3 text-body-sm font-bold text-text-primary lg:grid">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            <ul data-testid="cart-lines" className="flex flex-col gap-5 lg:gap-3" aria-label="Itens do carrinho">
              {lines.map((line) => (
                <CartLineRow key={line.id} line={line} onQuantity={onQuantity} onRemove={onRemove} onAcknowledge={(l) => onQuantity(l, l.quantity)} />
              ))}
            </ul>
          </div>

          <aside aria-label="Resumo da carteira" data-testid="cart-summary" className="rounded-t-[40px] bg-surface-card p-6 lg:rounded-none lg:bg-transparent lg:p-0">
            <h2 className="hidden border-b border-line pb-2.5 text-body-md font-bold text-text-primary lg:block">Resumo da carteira</h2>
            <div className="lg:mt-6">
              <CouponForm appliedCode={cart.data?.couponCode ?? null} appliedLabel={quote.data?.coupon?.label ?? null} onMessage={setAnnouncement} />
            </div>

            <div className="mt-6" style={{ minHeight: 168 }}>
              {quote.isPending && quote.fetchStatus !== 'idle' ? (
                <div data-testid="quote-skeleton" aria-hidden="true" className="flex flex-col gap-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : quote.isError ? (
                <div role="alert" className="flex flex-col items-start gap-3 text-body-sm text-text-primary">
                  <p>{errorMessageOf(quote.error)}</p>
                  <Button variant="outline" onClick={() => void quote.refetch()} className="h-9 rounded-control px-4 text-body-sm font-bold">
                    Tentar novamente
                  </Button>
                </div>
              ) : quote.data ? (
                <OrderTotals
                  testIdPrefix="cart"
                  subtotal={quote.data.subtotal}
                  discount={quote.data.discount}
                  discountLabel={quote.data.coupon?.label ?? 'Desconto do lançamento'}
                  networkFee={quote.data.networkFee}
                  total={quote.data.total}
                  feeEstimated={quote.data.networkFeeEstimated}
                />
              ) : null}
            </div>

            {blocking.length > 0 && (
              <ul id="cart-blocking" data-testid="cart-blocking" role="alert" className="mt-4 flex list-none flex-col gap-1 text-caption-sm text-destructive">
                {blocking.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-col items-stretch gap-3">
              {orderable ? (
                <Button asChild className="h-12 rounded-control text-body-md font-bold lg:h-10">
                  <Link to="/checkout">Conectar e finalizar</Link>
                </Button>
              ) : (
                <Button disabled aria-describedby={blocking.length > 0 ? 'cart-blocking' : undefined} className="h-12 rounded-control text-body-md font-bold lg:h-10">
                  Conectar e finalizar
                </Button>
              )}
              <Link to="/" hash="mercado" className="py-1 text-center text-body-md text-text-accent underline-offset-4 hover:underline">
                Continuar explorando
              </Link>
            </div>
          </aside>
        </div>
      )}

      {loading ? <div aria-hidden="true" className="mt-24 hidden md:block" style={{ minHeight: 411 }} /> : <RelatedNfts excludeNftIds={new Set(lines.map((l) => l.nftId))} />}
    </section>
  )
}
