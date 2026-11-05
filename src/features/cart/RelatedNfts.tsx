/** "Colecionadores também viram": public catalog suggestions (GET /nfts), hidden while loading/failing. */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { formatEth } from '@/lib/money'
import { nftQueries } from '@/queries/nfts'

const SHOWN = 5

export function RelatedNfts({ excludeNftIds }: { excludeNftIds: ReadonlySet<string> }) {
  const list = useQuery(nftQueries.list({ sort: 'recent' }))
  const items = (list.data?.items ?? []).filter((n) => !excludeNftIds.has(n.id) && !n.soldOut).slice(0, SHOWN)
  return (
    <section aria-labelledby="related-title" className="mt-24 hidden md:block" style={{ minHeight: 411 }}>
      <h2 id="related-title" className="border-b border-line pb-2.5 text-body-md font-bold text-text-accent">
        Colecionadores também viram
      </h2>
      {list.isError ? (
        <p className="mt-6 text-body-sm text-text-secondary">Não foi possível carregar as sugestões agora.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-5 gap-[26px]">
          {list.isPending
            ? Array.from({ length: SHOWN }, (_, i) => <li key={i} aria-hidden="true" className="h-[310px] skeleton-shimmer rounded-control bg-muted" />)
            : items.map((n) => (
                <li key={n.id}>
                  <Link to="/nft/$id" params={{ id: n.id }} className="group block outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
                    <span className="relative block h-[255px] overflow-hidden bg-surface-card">
                      <img src={n.image.src} alt={n.image.alt || n.name} width={n.image.width} height={n.image.height} loading="lazy" className="absolute inset-0 size-full object-cover" />
                    </span>
                    <span className="mt-3 block truncate text-body-sm text-text-primary group-hover:underline">{n.name}</span>
                    <span className="mt-1 block text-body-sm font-bold text-text-accent">{formatEth(n.price)}</span>
                  </Link>
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
