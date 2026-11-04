/** Lists what changed between the accepted quote and the current one and asks for an explicit confirmation. */
import type { Quote, QuoteChange } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/money'

function describe(change: QuoteChange, quote: Quote): string {
  const name = (lineId: string) => quote.lines.find((l) => l.lineId === lineId)?.name ?? 'Item'
  switch (change.kind) {
    case 'price':
      return `${name(change.lineId)}: o preço mudou de ${formatEth(change.from)} para ${formatEth(change.to)}.`
    case 'availability':
      return `${name(change.lineId)}: a disponibilidade mudou de ${change.from} para ${change.to} unidade(s).`
    case 'coupon':
      return change.reason === 'expired'
        ? `O cupom ${change.code} expirou.`
        : change.reason === 'invalid'
          ? `O cupom ${change.code} não é mais válido.`
          : 'O desconto do cupom mudou.'
    case 'fee':
      return `A taxa de rede mudou de ${formatEth(change.from)} para ${formatEth(change.to)}.`
    case 'total':
      return `O total mudou de ${formatEth(change.from)} para ${formatEth(change.to)}.`
  }
}

export function StaleChanges({ changes, quote, onAccept, disabled }: { changes: QuoteChange[]; quote: Quote; onAccept: () => void; disabled?: boolean }) {
  return (
    <div data-testid="stale-changes" role="alert" className="rounded-control border border-brand bg-surface-card p-4 text-body-sm text-text-primary">
      <p className="font-bold text-text-accent">Os valores do seu pedido mudaram.</p>
      <p className="mt-1 text-text-secondary">Revise as alterações abaixo e confirme novamente para continuar.</p>
      {changes.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {changes.map((c, i) => (
            <li key={`${c.kind}-${i}`}>{describe(c, quote)}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3">
        Novo total: <strong className="text-text-accent">{formatEth(quote.total)}</strong>
      </p>
      <Button type="button" onClick={onAccept} disabled={disabled} className="mt-3 h-10 rounded-control px-5 text-body-md font-bold">
        Aceitar novos valores
      </Button>
    </div>
  )
}
