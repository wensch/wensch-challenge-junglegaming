import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { catalogSearchSchema, type CatalogSearch } from '@/api/contracts'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { nftQueries } from '@/queries/nfts'

/** Defaults are stripped from the URL so `/` stays `/` (and links/active states stay stable). */
const CATALOG_SEARCH_DEFAULTS = { tab: 'all', categories: [], networks: [], sort: 'recent', page: 1 } satisfies Partial<CatalogSearch>

// Search params are validated here so every filter/sort/page lives in the URL (CAT-*).
export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(CATALOG_SEARCH_DEFAULTS)] },
  // Preload (hover/intent) warms the cache; the page itself shows skeletons, so navigation is never blocked.
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftQueries.list(deps.search))
    void context.queryClient.prefetchQuery(nftQueries.featured())
  },
  head: () => ({ meta: [{ title: 'KURIO — Mercado de NFTs' }] }),
  component: CatalogPage,
})
