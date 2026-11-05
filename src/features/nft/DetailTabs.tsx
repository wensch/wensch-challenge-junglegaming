/** "Detalhes do NFT" / "Avaliações de colecionadores (n)" tabs (Radix Tabs: arrows, roving tabindex). */
import { Tabs } from 'radix-ui'
import type { NftDetail } from '@/api/contracts'
import { NETWORK_LABELS } from '@/features/catalog/labels'
import { StarRating } from './StarRating'

const trigger =
  'relative -mb-px border-b-2 border-transparent pb-[10px] text-body-sm text-text-primary transition-colors hover:text-text-accent data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-text-accent'

const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a)

export function DetailTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs.Root defaultValue="details">
      <Tabs.List aria-label="Informações do NFT" className="flex flex-wrap gap-x-8 border-b border-line">
        <Tabs.Trigger value="details" className={trigger}>
          Detalhes do NFT
        </Tabs.Trigger>
        <Tabs.Trigger value="reviews" className={trigger}>
          Avaliações de colecionadores ({nft.rating.count})
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="details" className="mt-4 flex flex-col gap-4 text-caption leading-6 text-text-secondary outline-none">
        {nft.longDescription.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold text-text-primary">Rede:</dt>
            <dd>Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd>
          </div>
          <div>
            <dt className="font-bold text-text-primary">Contrato:</dt>
            <dd>
              {shortAddress(nft.contract.address)} • Contrato inteligente {nft.contract.standard} verificado.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-text-primary">Direitos autorais:</dt>
            <dd>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
          </div>
        </dl>
      </Tabs.Content>

      <Tabs.Content value="reviews" className="mt-4 outline-none">
        {nft.reviews.length === 0 ? (
          <p className="text-caption text-text-secondary">Este NFT ainda não tem avaliações.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {nft.reviews.map((review) => (
              <li key={review.id} className="rounded-control bg-surface-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm font-bold text-text-primary">{review.author}</p>
                  <StarRating value={`${review.rating}.0`} label={`${review.rating} de 5 estrelas`} />
                </div>
                <p className="mt-2 text-caption leading-6 text-text-secondary">{review.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Tabs.Content>
    </Tabs.Root>
  )
}
