/** "Mais desta coleção": other NFTs of the same collection (`collectionId` + `excludeId`). */
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { errorMessageOf } from '@/components/layout/PageStates'
import { nftQueries } from '@/queries/nfts'
import { NftCard, NftCardSkeleton } from './NftCard'

const ROW = 'flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-5 md:gap-[7px] md:overflow-visible [&>li]:w-[190px] [&>li]:shrink-0 [&>li]:snap-start md:[&>li]:w-auto'

export function RelatedNfts({ collectionId, excludeId }: { collectionId: string; excludeId: string }) {
  const related = useQuery(nftQueries.list({ collectionId, excludeId, pageSize: 5 }))
  const items = related.data?.items

  // A collection with nothing else to show leaves no empty heading behind.
  if (related.isSuccess && items?.length === 0) return null

  return (
    <section aria-labelledby="related-title" className="mt-16 md:mt-24">
      <h2 id="related-title" className="border-b border-line pb-[10px] text-body-sm font-bold text-text-accent">
        Mais desta coleção
      </h2>
      <div className="mt-6" aria-busy={related.isPending ? 'true' : undefined}>
        {related.isPending && (
          <ul className={ROW} aria-label="Carregando NFTs da coleção">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton size="related" />
              </li>
            ))}
          </ul>
        )}
        {related.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-surface-card px-4 py-3 text-body-sm text-text-secondary">
            <span>Não foi possível carregar a coleção. {errorMessageOf(related.error)}</span>
            <Button variant="outline" onClick={() => void related.refetch()} className="h-8 rounded-control px-3 text-body-sm">
              Tentar novamente
            </Button>
          </div>
        )}
        {items && items.length > 0 && (
          <ul className={ROW} aria-label="NFTs da mesma coleção">
            {items.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} size="related" priority />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
