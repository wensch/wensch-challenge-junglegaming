/**
 * Review before sending (PAG-1): collector data, wallet/network, items and the totals of the CURRENT quote.
 * "Enviar pedido" is the only action that creates the order. While the quote changed (event or
 * `409 QUOTE_STALE`) the diff is shown and sending stays disabled until the user accepts the new values.
 */
import type { RefObject } from 'react'
import type { CartLine, Quote, QuoteChange, Wallet } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrderTotals } from '@/features/shared/OrderTotals'
import type { CheckoutFormValues } from './form'
import { ENS_SUFFIX } from './form'
import { ItemsSummary } from './ItemsSummary'
import { NETWORK_LABELS, shortAddress, WALLET_TYPE_LABELS } from './labels'
import { StaleChanges } from './StaleChanges'

export interface ReviewDialogProps {
  open: boolean
  /** Button that opened the dialog; receives focus on close while it is still mounted and enabled. */
  returnFocusRef?: RefObject<HTMLElement | null>
  onOpenChange: (open: boolean) => void
  values: CheckoutFormValues | null
  wallet: Wallet | undefined
  quote: Quote | undefined
  refreshing: boolean
  cartLines: CartLine[]
  /** Non-empty (or `needsReconfirm`) while the quote differs from the one the user accepted. */
  changes: QuoteChange[]
  needsReconfirm: boolean
  onAccept: () => void
  onSubmit: () => void
  submitting: boolean
  /** Why the last attempt failed (unavailable items, timeout...). */
  error: string | null
  blockedReasons: string[]
}

export function ReviewDialog({ open, returnFocusRef, onOpenChange, values, wallet, quote, refreshing, cartLines, changes, needsReconfirm, onAccept, onSubmit, submitting, error, blockedReasons }: ReviewDialogProps) {
  const canSend = !!quote && quote.orderable && !needsReconfirm && !refreshing && !submitting
  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto border border-line-soft bg-surface-card p-6 sm:max-w-[560px]"
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          const el = returnFocusRef?.current
          if (el && el.isConnected && !(el as HTMLButtonElement).disabled) {
            e.preventDefault()
            el.focus()
          }
        }}
        data-testid="review-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-body-lg font-bold text-text-primary">Revisar pedido</DialogTitle>
          <DialogDescription className="text-body-sm text-text-secondary">Confira os dados e os valores antes de enviar. A compra só é concluída quando a carteira confirmar.</DialogDescription>
        </DialogHeader>

        {values && wallet ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm" data-testid="review-collector">
            <dt className="text-text-secondary">Colecionador</dt>
            <dd className="truncate text-text-primary">{values.displayName}</dd>
            <dt className="text-text-secondary">E-mail</dt>
            <dd className="truncate text-text-primary">{values.email}</dd>
            <dt className="text-text-secondary">ENS</dt>
            <dd className="truncate text-text-primary">
              {values.ensLabel}
              {ENS_SUFFIX}
            </dd>
            <dt className="text-text-secondary">Carteira</dt>
            <dd className="truncate text-text-primary">
              {WALLET_TYPE_LABELS[wallet.type]} · {shortAddress(wallet.address)}
            </dd>
            <dt className="text-text-secondary">Rede</dt>
            <dd className="text-text-primary">{NETWORK_LABELS[values.network]}</dd>
          </dl>
        ) : null}

        {quote ? <ItemsSummary quote={quote} cartLines={cartLines} compact /> : null}

        {needsReconfirm && quote ? <StaleChanges changes={changes} quote={quote} onAccept={onAccept} disabled={submitting} /> : null}

        {quote && !needsReconfirm ? (
          <OrderTotals
            testIdPrefix="review"
            subtotal={quote.subtotal}
            discount={quote.discount}
            discountLabel={quote.coupon?.label ?? 'Desconto do lançamento'}
            networkFee={quote.networkFee}
            total={quote.total}
            feeEstimated={quote.networkFeeEstimated}
          />
        ) : null}

        {blockedReasons.length > 0 ? (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-caption-sm text-destructive">
            {blockedReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p role="alert" data-testid="review-error" className="text-body-sm text-destructive">
            {error}
          </p>
        ) : null}

        <p role="status" aria-live="polite" className="min-h-5 text-caption-sm text-text-secondary">
          {submitting ? 'Enviando pedido… não feche esta janela.' : refreshing ? 'Atualizando valores…' : ''}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)} className="h-11 rounded-control px-5 text-body-md font-bold">
            Voltar e editar
          </Button>
          <Button type="button" disabled={!canSend} onClick={onSubmit} data-testid="send-order" className="h-11 rounded-control px-5 text-body-md font-bold">
            {submitting ? 'Enviando…' : 'Enviar pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
