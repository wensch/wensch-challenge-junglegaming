/**
 * Home (`/`): hero + sidebar (filters, spotlight) + grid with tabs/sort/pagination + promos.
 * Everything that narrows the list lives in the URL (CAT-1); the list query key is the normalized
 * URL state, so a late response of an old URL can never replace the current one (CAT-4).
 */
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useNftUpdateMessage } from '@/features/nft/useNftUpdateMessage'
import { nftQueries } from '@/queries/nfts'
import { cn } from '@/lib/utils'
import { CatalogGrid } from './CatalogGrid'
import { FilterPanel } from './FilterPanel'
import { Hero } from './Hero'
import { MobileSearchBar } from './MobileSearchBar'
import { Pagination } from './Pagination'
import { Promos } from './Promos'
import { Spotlight } from './Spotlight'
import { CatalogTabs, SortSelect } from './Toolbar'
import { useCatalogSearch } from './useCatalogSearch'

export function CatalogPage() {
  const { search } = useCatalogSearch()
  const query = useQuery(nftQueries.list(search))
  const hash = useRouterState({ select: (s) => s.location.hash })

  // `/#busca` (mobile menu link): move focus to the visible search field, if the layout has one.
  useEffect(() => {
    if (hash !== 'busca') return
    const field = document.getElementById('busca')
    if (field && field.offsetParent !== null) field.focus()
  }, [hash])

  const items = query.data?.items
  const updateMessage = useNftUpdateMessage((id) => items?.find((n) => n.id === id)?.name)
  const background = query.isFetching && !query.isPending
  const total = query.data?.meta.total

  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-12 xl:px-0">
      <div className="flex flex-col gap-4 pt-10 md:pt-8">
        <MobileSearchBar facets={query.data?.facets} />
        <Hero />
      </div>

      <section id="mercado" aria-labelledby="mercado-titulo" className="mt-6 scroll-mt-6 md:mt-24 lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
        <h2 id="mercado-titulo" className="sr-only">
          Mercado de NFTs
        </h2>
        <div className="hidden lg:block">
          <FilterPanel facets={query.data?.facets} />
          <Spotlight />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-6 md:mb-4">
            <CatalogTabs className="min-w-0" />
            <SortSelect className="hidden shrink-0 md:flex" />
          </div>
          {/* Reserved 2 px line: background refetches show a shimmer without moving anything. */}
          <div aria-hidden="true" className={cn('mb-6 h-0.5 rounded-full bg-line', background && 'skeleton-shimmer')} />
          <p role="status" className="sr-only">
            {background ? 'Atualizando resultados…' : total === undefined ? '' : `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}.`}
          </p>
          <p role="status" className="sr-only" data-testid="nft-live-updates">
            {updateMessage}
          </p>

          <CatalogGrid query={query} />

          {query.data && (
            <div className="mt-10 md:mt-12">
              <Pagination page={query.data.meta.page} totalPages={query.data.meta.totalPages} />
            </div>
          )}
        </div>
      </section>

      <Promos />
    </div>
  )
}
