/**
 * Learning hub (`/aprenda`). No Figma frame (ARCHITECTURE D45). Block 1: the four featured guides
 * ("trilhas"). Block 2: every article, with category chips that live in the URL (`?categoria=`).
 * States per block: skeleton, error (retry), empty.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ARTICLE_CATEGORIES, type ArticleListResponse } from '@/api/contracts'
import { EditorialHero, StateBox } from '@/components/layout/EditorialParts'
import { errorMessageOf } from '@/components/layout/PageStates'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { contentQueries } from '@/queries/content'
import { ArticleCard, ArticleCardSkeleton, CATEGORY_LABELS } from './ArticleCard'

const route = getRouteApi('/aprenda/')
const GRID = 'grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2'

function ArticleList({ query, label, numbered, emptyAction }: { query: UseQueryResult<ArticleListResponse, Error>; label: string; numbered?: boolean; emptyAction?: (() => void) | undefined }) {
  const { data, isPending, isError, isPlaceholderData, isFetching, error, refetch } = query
  if (isPending) {
    return (
      <ul className={GRID} aria-busy="true" aria-label={`Carregando: ${label}`} data-testid="articles-skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <ArticleCardSkeleton />
          </li>
        ))}
      </ul>
    )
  }
  if (isError && !data) {
    return (
      <StateBox title="Não foi possível carregar os artigos" role="alert" className="min-h-[240px]">
        <p className="max-w-md text-body text-text-secondary">{errorMessageOf(error)}</p>
        <Button onClick={() => void refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
          Tentar novamente
        </Button>
      </StateBox>
    )
  }
  const items = numbered ? (data?.items ?? []).filter((a) => a.featured) : (data?.items ?? [])
  if (items.length === 0) {
    return (
      <StateBox title="Nenhum artigo encontrado" role="status" className="min-h-[240px]">
        <p className="max-w-md text-body text-text-secondary">Não há artigos nesta categoria no momento.</p>
        {emptyAction && (
          <Button onClick={emptyAction} className="h-10 rounded-control px-5 text-body-md font-bold">
            Ver todos os artigos
          </Button>
        )}
      </StateBox>
    )
  }
  return (
    <ul className={cn(GRID, 'transition-opacity', isPlaceholderData && 'opacity-60')} aria-label={label} aria-busy={isPlaceholderData || isFetching ? 'true' : undefined} data-testid={numbered ? 'tracks-list' : 'articles-list'}>
      {items.map((a, i) => (
        <li key={a.slug}>
          <ArticleCard article={a} {...(numbered ? { step: i + 1 } : {})} />
        </li>
      ))}
    </ul>
  )
}

const chip =
  'inline-flex h-9 items-center rounded-full border border-line-soft px-4 text-body-sm whitespace-nowrap text-text-primary transition-colors hover:border-primary data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:font-bold data-[status=active]:text-primary-foreground'

export function LearnPage() {
  const { categoria } = route.useSearch()
  const navigate = route.useNavigate()
  const tracks = useQuery(contentQueries.articles())
  const list = useQuery(contentQueries.articles(categoria))

  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-12 xl:px-0">
      <div className="pt-10 md:pt-8">
        <EditorialHero eyebrow="Guias" title="Aprenda">
          Trilhas curtas e diretas para entender NFTs, avaliar uma obra com calma e proteger a sua carteira antes da primeira compra.
        </EditorialHero>
      </div>

      <section aria-labelledby="trilhas-titulo" className="mt-6 md:mt-12">
        <h2 id="trilhas-titulo" className="mb-4 text-heading font-bold text-text-primary">
          Trilhas de aprendizado
        </h2>
        <ArticleList query={tracks} label="Trilhas de aprendizado" numbered />
      </section>

      <section aria-labelledby="artigos-titulo" className="mt-12 md:mt-20">
        <h2 id="artigos-titulo" className="mb-4 text-heading font-bold text-text-primary">
          Todos os artigos
        </h2>
        <nav aria-label="Categorias" className="mb-6">
          <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            <li>
              <Link to="/aprenda" search={{}} activeOptions={{ exact: true, includeSearch: true }} className={chip}>
                Todos
              </Link>
            </li>
            {ARTICLE_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/aprenda" search={{ categoria: c }} activeOptions={{ exact: true, includeSearch: true }} className={chip}>
                  {CATEGORY_LABELS[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p role="status" className="sr-only">
          {list.data ? `${list.data.total} ${list.data.total === 1 ? 'artigo encontrado' : 'artigos encontrados'}.` : ''}
        </p>
        <ArticleList query={list} label="Artigos" emptyAction={categoria ? () => void navigate({ search: {} }) : undefined} />
      </section>
    </div>
  )
}
