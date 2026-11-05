import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { creatorsSearchSchema, type CreatorsSearch } from '@/api/contracts'
import { CreatorsPage } from '@/features/creators/CreatorsPage'
import { contentQueries } from '@/queries/content'

/** Defaults are stripped so `/criadores` stays clean in the URL. */
const DEFAULTS = { ordem: 'nfts', page: 1 } satisfies Partial<CreatorsSearch>

export const Route = createFileRoute('/criadores')({
  validateSearch: creatorsSearchSchema,
  search: { middlewares: [stripSearchParams(DEFAULTS)] },
  loaderDeps: ({ search }) => ({ search }),
  // Preload only warms the cache; the page shows skeletons, so navigation is never blocked.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(contentQueries.creators({ q: deps.search.q, sort: deps.search.ordem, page: deps.search.page }))
  },
  head: () => ({ meta: [{ title: 'Criadores — KURIO' }] }),
  component: CreatorsPage,
})
