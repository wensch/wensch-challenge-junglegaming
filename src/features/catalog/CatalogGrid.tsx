/**
 * Product grid with every data state (UI-3, CAT-4):
 * - loading: 9 skeleton cards with the same box as the real ones (no layout shift);
 * - success: cards; a refetch/new page keeps the old cards on screen (`aria-busy`, dimmed);
 * - empty: message with "Limpar filtros";
 * - error: message with "Tentar novamente" (`refetch`), previous cards stay if there are any.
 */
import type { UseQueryResult } from '@tanstack/react-query'
import { CATALOG_PAGE_SIZE, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { errorMessageOf } from '@/components/layout/PageStates'
import { NftCard, NftCardSkeleton } from '@/features/nft/NftCard'
import { hasActiveFilters, useCatalogSearch } from './useCatalogSearch'

export const GRID_CLASS = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px] lg:grid-cols-2 xl:grid-cols-3 max-md:[&>li:nth-child(even)]:mt-8'

/** Same height as a full 3x3 desktop grid, so message states do not make the footer jump. */
const STATE_MIN_HEIGHT = 'min-h-[320px] md:min-h-[560px]'

function StateMessage({ title, children, role }: { title: string; children: React.ReactNode; role?: 'alert' | 'status' }) {
  return (
    <div role={role} className={cn('flex flex-col items-center justify-center gap-4 rounded-card bg-surface-card px-6 py-12 text-center', STATE_MIN_HEIGHT)}>
      <h3 className="text-heading font-bold text-text-primary">{title}</h3>
      {children}
    </div>
  )
}

export function CatalogGrid({ query }: { query: UseQueryResult<NftListResponse, Error> }) {
  const { search, clear, update } = useCatalogSearch()
  const { data, isPending, isError, isPlaceholderData, isFetching, error, refetch } = query

  if (isPending) {
    return (
      <ul className={GRID_CLASS} aria-busy="true" aria-label="Carregando NFTs" data-testid="catalog-skeleton">
        {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
          <li key={i}>
            <NftCardSkeleton />
          </li>
        ))}
      </ul>
    )
  }

  if (isError && !data) {
    return (
      <StateMessage title="Não foi possível carregar o catálogo" role="alert">
        <p className="max-w-md text-body text-text-secondary">{errorMessageOf(error)}</p>
        <Button onClick={() => void refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
          Tentar novamente
        </Button>
      </StateMessage>
    )
  }

  const items = data?.items ?? []
  if (items.length === 0) {
    const beyond = (data?.meta.totalPages ?? 0) > 0 && search.page > (data?.meta.totalPages ?? 0)
    return (
      <StateMessage title={beyond ? 'Esta página não existe' : 'Nenhum NFT encontrado'} role="status">
        <p className="max-w-md text-body text-text-secondary">
          {beyond ? 'Os resultados terminam antes desta página.' : hasActiveFilters(search) ? 'Nenhum resultado para esta combinação de busca e filtros.' : 'O catálogo não tem NFTs no momento.'}
        </p>
        {beyond ? (
          <Button onClick={() => void update({ page: 1 })} className="h-10 rounded-control px-5 text-body-md font-bold">
            Ir para a primeira página
          </Button>
        ) : (
          hasActiveFilters(search) && (
            <Button onClick={() => void clear()} className="h-10 rounded-control px-5 text-body-md font-bold">
              Limpar filtros
            </Button>
          )
        )}
      </StateMessage>
    )
  }

  const stale = isPlaceholderData
  return (
    <div>
      {isError && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-control border border-destructive/60 bg-surface-card px-4 py-3 text-body-sm text-text-primary">
          <span>Não foi possível atualizar os resultados. {errorMessageOf(error)}</span>
          <Button variant="outline" onClick={() => void refetch()} className="h-8 rounded-control px-3 text-body-sm">
            Tentar novamente
          </Button>
        </div>
      )}
      <ul
        className={cn(GRID_CLASS, 'transition-opacity', stale && 'opacity-60')}
        aria-busy={stale || isFetching ? 'true' : undefined}
        aria-label="NFTs"
        data-testid="catalog-grid"
        data-stale={stale ? 'true' : undefined}
      >
        {items.map((nft, i) => (
          <li key={nft.id}>
            <NftCard nft={nft} priority={i < 3} />
          </li>
        ))}
      </ul>
    </div>
  )
}
