import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { catalogSearchSchema, type CatalogSearch } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

/** Defaults are stripped from the URL so `/` stays `/` (and links/active states stay stable). */
const CATALOG_SEARCH_DEFAULTS = { tab: 'all', categories: [], networks: [], sort: 'recent', page: 1 } satisfies Partial<CatalogSearch>

// Search params are validated here so every filter/sort/page lives in the URL (CAT-*).
export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(CATALOG_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: 'KURIO — Mercado de NFTs' }] }),
  component: HomePage,
})

function HomePage() {
  return <UnderConstruction title="Mercado de NFTs" slice="S1 — Catálogo" />
}
