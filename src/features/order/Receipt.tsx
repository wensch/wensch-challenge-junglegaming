/**
 * Receipt = immutable snapshot (`order.receipt`, PAG-8). Renders ONLY the order's own fields: nothing
 * is read from the catalog or the cart, so later catalog changes cannot alter it. The confirmed panel
 * (Figma "Confirmação de Pedido") is rendered by the caller only when `order.status === 'confirmed'`.
 */
import type { Order, Receipt as ReceiptData } from '@/api/contracts'
import { OrderTotals } from '@/features/shared/OrderTotals'
import { NETWORK_LABELS, WALLET_TYPE_LABELS } from '@/features/checkout/labels'
import { formatEth } from '@/lib/money'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** `29 Jul, 2026` (Figma), from an ISO instant, in UTC so it never depends on the machine zone. */
export function formatReceiptDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()] ?? ''}, ${d.getUTCFullYear()}`
}

/** `0xA91F…E82C` (Figma). */
export function shortHash(hash: string): string {
  return `0x${hash.slice(2, 6).toUpperCase()}…${hash.slice(-4).toUpperCase()}`
}

export function ReceiptLines({ receipt }: { receipt: ReceiptData }) {
  return (
    <ul data-testid="receipt-lines" aria-label="Itens do pedido" className="flex flex-col gap-3">
      {receipt.lines.map((l) => (
        <li key={`${l.cartLineId}-${l.editionId}`} className="flex items-center gap-3">
          <img src={l.image.src} alt={l.image.alt || l.name} width={70} height={70} className="size-[70px] shrink-0 rounded-control object-cover" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-sm font-bold text-text-primary">{l.name}</span>
            <span className="truncate text-caption-sm text-text-secondary">ID do token: {l.tokenId}</span>
          </span>
          <span className="text-caption-sm text-text-secondary">(x {l.quantity})</span>
          <span className="min-w-[88px] text-right text-body-md font-bold text-text-accent">{formatEth(l.lineTotal)}</span>
        </li>
      ))}
    </ul>
  )
}

export function ReceiptTotals({ receipt }: { receipt: ReceiptData }) {
  return (
    <OrderTotals
      testIdPrefix="receipt"
      subtotal={receipt.subtotal}
      discount={receipt.discount}
      discountLabel={receipt.couponCode ? `Cupom ${receipt.couponCode}` : 'Desconto do lançamento'}
      networkFee={receipt.networkFee}
      total={receipt.total}
      feeEstimated={false}
    />
  )
}

export function ConfirmedReceipt({ order }: { order: Order }) {
  const tx = order.transaction
  const { receipt } = order
  return (
    <article data-testid="receipt" aria-labelledby="receipt-title" className="mx-auto w-full max-w-[578px] overflow-hidden bg-surface-card">
      <header className="border-b border-line-soft px-6 pt-8 pb-5 text-center">
        <h1 id="receipt-title" tabIndex={-1} className="text-body-md font-bold text-brand-secondary">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <dl className="grid grid-cols-2 gap-4 border-b border-line-soft px-6 py-4 text-caption sm:grid-cols-4">
        <div>
          <dt className="font-bold text-brand-secondary">ID da transação</dt>
          <dd data-testid="receipt-hash" title={tx?.hash} className="text-text-secondary">
            {tx ? shortHash(tx.hash) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-brand-secondary">Data</dt>
          <dd className="text-text-secondary">{tx ? formatReceiptDate(tx.confirmedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-brand-secondary">Total</dt>
          <dd className="text-text-secondary">{formatEth(receipt.total)}</dd>
        </div>
        <div>
          <dt className="font-bold text-brand-secondary">Carteira</dt>
          <dd className="text-text-secondary">{WALLET_TYPE_LABELS[receipt.wallet.type]}</dd>
        </div>
      </dl>
      <div className="px-6 py-6">
        <h2 className="mb-4 text-body-sm font-bold text-text-primary">Detalhes da transação</h2>
        <ReceiptLines receipt={receipt} />
        <ReceiptTotals receipt={receipt} />
        <p className="mt-5 text-center text-caption text-text-secondary">
          Transação confirmada na {NETWORK_LABELS[receipt.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        {tx ? (
          <div className="mt-5 text-center">
            <a
              href={tx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded-control bg-primary px-4 text-body-md font-bold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              Ver no Etherscan<span className="sr-only"> (abre em nova aba, simulado)</span>
            </a>
          </div>
        ) : null}
      </div>
      <div aria-hidden="true" className="h-2.5 bg-brand" />
    </article>
  )
}
