/**
 * Order page (TEL-5, PAG-5..8, RT-2, RT-9). Three states: pending, confirmed, declined.
 * - The confirmation panel appears ONLY when `order.status === 'confirmed'`, a value that comes from the
 *   simulation (REST `GET /orders/:id` or a validated `order.updated` event) — never inferred here.
 * - Recovery: the order is read from REST on every load/focus/reconnect while pending; with the socket
 *   down it is polled every 5 s (fallback). Terminal states never change.
 * - On `confirmed`: cart re-read (the server removed exactly the bought quantities), draft and attempt cleared.
 * - On `declined`: cart untouched; "Tentar novamente" starts a NEW attempt (new Idempotency-Key).
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessageOf } from '@/components/layout/PageStates'
import { clearAttempt, readAttempt } from '@/features/checkout/attempt'
import { clearDraft } from '@/features/checkout/draft'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { formatEth } from '@/lib/money'
import { useRealtimeState } from '@/realtime/RealtimeBridge'
import { invalidateCartAndQuote, useCartOwner } from '@/queries/cart'
import { isCurrentOwner } from '@/queries/owner'
import { useOrder, useUserCredential } from '@/queries/orders'
import { ConfirmedReceipt, ReceiptLines, ReceiptTotals } from './Receipt'

function OrderSkeleton() {
  return (
    <div data-testid="order-skeleton" aria-hidden="true" className="mx-auto flex w-full max-w-[578px] flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[70px] w-full" />
      <Skeleton className="h-[70px] w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export function OrderPage({ orderId }: { orderId: string }) {
  const qc = useQueryClient()
  const user = useUserCredential()
  const owner = useCartOwner()
  const socket = useRealtimeState()
  const order = useOrder(orderId, { poll: socket.status !== 'connected' })
  const headingRef = usePageHeadingFocus(order.data?.status)
  const settledFor = useRef<string | null>(null)

  const status = order.data?.status
  useEffect(() => {
    if (!user || !status || status === 'pending' || settledFor.current === `${orderId}:${status}`) return
    settledFor.current = `${orderId}:${status}`
    if (!isCurrentOwner({ kind: 'user', ...user })) return // the session changed during the call: discard the result
    if (readAttempt(user.userId)?.orderId === orderId) clearAttempt(user.userId)
    if (status === 'confirmed') {
      clearDraft(user.userId)
      if (owner) void invalidateCartAndQuote(qc, owner)
    }
  }, [status, orderId, user, owner, qc])

  const data = order.data
  return (
    <section className="mx-auto w-full max-w-page px-gutter py-10 xl:px-0" aria-busy={order.isFetching && !data}>
      <p role="status" aria-live="polite" className="sr-only" data-testid="order-announcer">
        {status === 'confirmed' ? 'Pedido confirmado.' : status === 'declined' ? 'Pagamento recusado.' : status === 'pending' ? 'Pedido aguardando confirmação.' : ''}
      </p>

      {order.isPending && order.fetchStatus !== 'idle' ? (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            Pedido
          </h1>
          <OrderSkeleton />
        </>
      ) : order.isError ? (
        <div role="alert" className="mx-auto flex max-w-[578px] flex-col items-start gap-3 rounded-card border border-line-soft bg-surface-card p-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-body-lg font-bold text-text-primary outline-none">
            Pedido indisponível
          </h1>
          <p className="text-body text-text-primary">{errorMessageOf(order.error)}</p>
          <div className="flex gap-3">
            <Button onClick={() => void order.refetch()} className="h-10 rounded-control px-5 text-body-md font-bold max-lg:rounded-full">
              Tentar novamente
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-control px-5 text-body-md font-bold max-lg:rounded-full">
              <Link to="/">Ir para o início</Link>
            </Button>
          </div>
        </div>
      ) : data?.status === 'confirmed' ? (
        <div className="relative mx-auto max-w-[578px]" data-testid="order-confirmed" data-status="confirmed">
          <Link to="/" aria-label="Fechar e voltar ao início" className="absolute top-4 right-4 z-10 text-text-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
            <X aria-hidden="true" className="size-5" />
          </Link>
          <ConfirmedReceipt order={data} headingRef={headingRef} />
          <p className="mt-6 text-center">
            <Link to="/" hash="mercado" className="text-body-md text-text-accent underline-offset-4 hover:underline">
              Continuar explorando
            </Link>
          </p>
        </div>
      ) : data?.status === 'declined' ? (
        <div data-testid="order-declined" data-status="declined" className="mx-auto max-w-[578px] rounded-card border border-line-soft bg-surface-card p-6">
          <h1 ref={headingRef} tabIndex={-1} className="text-body-lg font-bold text-text-primary outline-none">
            Pagamento recusado
          </h1>
          <p role="alert" className="mt-2 text-body-sm text-destructive">
            {data.declineReason ?? 'A carteira recusou o pagamento.'}
          </p>
          <p className="mt-2 text-body-sm text-text-secondary">Nada foi cobrado e seus itens continuam no carrinho.</p>
          <h2 className="mt-6 mb-3 text-body-sm font-bold text-text-primary">Itens do pedido</h2>
          <ReceiptLines receipt={data.receipt} />
          <ReceiptTotals receipt={data.receipt} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 rounded-control px-5 text-body-md font-bold max-lg:rounded-full">
              <Link to="/checkout">Tentar novamente</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-control px-5 text-body-md font-bold max-lg:rounded-full">
              <Link to="/cart">Voltar ao carrinho</Link>
            </Button>
          </div>
        </div>
      ) : data ? (
        <div data-testid="order-pending" data-status="pending" className="mx-auto max-w-[578px] rounded-card border border-line-soft bg-surface-card p-6">
          <h1 ref={headingRef} tabIndex={-1} className="text-body-lg font-bold text-text-primary outline-none">
            Aguardando confirmação
          </h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Seu pedido foi enviado e aguarda a confirmação da carteira ({formatEth(data.receipt.total)}). Esta tela se atualiza sozinha; se você recarregar a página, o pedido continua aqui e nada é comprado de novo.
          </p>
          <p data-testid="order-connection" className="mt-2 text-caption-sm text-text-secondary">
            {socket.status === 'connected' ? 'Acompanhando em tempo real.' : 'Sem conexão em tempo real: verificando o pedido a cada 5 segundos.'}
          </p>
          <h2 className="mt-6 mb-3 text-body-sm font-bold text-text-primary">Itens do pedido</h2>
          <ReceiptLines receipt={data.receipt} />
          <ReceiptTotals receipt={data.receipt} />
        </div>
      ) : null}
    </section>
  )
}
