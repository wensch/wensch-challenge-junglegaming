/**
 * Creators directory (`/criadores`). No Figma frame (ARCHITECTURE D45): built from the app's own
 * tokens and cards. Search, sort and page live in the URL (`creatorsSearchSchema`); the list query
 * key is the normalized URL state. States: skeleton, error (retry), empty (clear search).
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { CREATOR_SORTS, CREATORS_PAGE_SIZE, creatorSortSchema, type Creator, type CreatorSort } from '@/api/contracts'
import { EditorialHero, StateBox } from '@/components/layout/EditorialParts'
import { errorMessageOf } from '@/components/layout/PageStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { pageBox, pageWindow } from '@/features/catalog/Pagination'
import { Avatar } from '@/features/profile/avatar'
import { cn } from '@/lib/utils'
import { contentQueries } from '@/queries/content'

const route = getRouteApi('/criadores')

const SORT_LABELS: Record<CreatorSort, string> = { nfts: 'Mais NFTs', followers: 'Mais seguidos' }
const GRID = 'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7 xl:grid-cols-3'
const count = new Intl.NumberFormat('pt-BR')

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <article className="flex min-h-[300px] flex-col gap-4 rounded-card bg-surface-card p-6 md:rounded-control" data-testid="creator-card" data-creator-id={creator.id}>
      <div className="flex items-center gap-4">
        <Avatar url={creator.avatar} name={creator.name} decorative className="size-16" />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-body-lg font-bold text-text-primary">
            <span className="truncate">{creator.name}</span>
            {creator.verified && (
              <>
                <BadgeCheck aria-hidden="true" className="size-[18px] shrink-0 text-text-accent" />
                <span className="sr-only">(criador verificado)</span>
              </>
            )}
          </h3>
          <p className="truncate text-caption text-text-secondary">@{creator.handle}</p>
        </div>
      </div>
      <p className="text-body-sm text-text-primary">{creator.bio}</p>
      <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-line pt-4 text-body-sm">
        <div>
          <dt className="text-caption text-text-secondary">NFTs</dt>
          <dd className="font-bold text-text-primary">{count.format(creator.nftCount)}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-secondary">Seguidores</dt>
          <dd className="font-bold text-text-primary">{count.format(creator.followers)}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-caption text-text-secondary">Coleção principal</dt>
          <dd className="truncate text-text-primary">{creator.mainCollection.name}</dd>
        </div>
      </dl>
      <Button asChild className="h-10 rounded-control text-body-md font-bold">
        <Link to="/" search={{ q: creator.mainCollection.name }} hash="mercado" aria-label={`Ver coleção ${creator.mainCollection.name}`}>
          Ver coleção
        </Link>
      </Button>
    </article>
  )
}

function CreatorCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-[300px] flex-col gap-4 rounded-card bg-surface-card p-6 md:rounded-control">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-[66px]" />
      <Skeleton className="mt-auto h-[84px]" />
      <Skeleton className="h-10" />
    </div>
  )
}

function Toolbar({ q, sort }: { q: string | undefined; sort: CreatorSort }) {
  const navigate = route.useNavigate()
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <form
        key={q ?? ''}
        role="search"
        aria-label="Buscar criadores"
        className="flex flex-1 gap-2 md:max-w-[460px]"
        onSubmit={(e) => {
          e.preventDefault()
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim()
          void navigate({ search: (prev) => ({ ...prev, q: value || undefined, page: 1 }) })
        }}
      >
        <label htmlFor="criadores-busca" className="sr-only">
          Buscar criadores
        </label>
        <Input
          id="criadores-busca"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={100}
          defaultValue={q ?? ''}
          placeholder="Nome ou coleção"
          className="h-10 rounded-control border-line-soft px-3 text-body-md text-text-primary placeholder:text-text-secondary"
        />
        <Button type="submit" className="h-10 rounded-control px-5 text-body-md font-bold">
          Buscar
        </Button>
      </form>
      <div className="flex items-center gap-1.5 text-body-sm">
        <span aria-hidden="true" className="text-text-primary">
          Ordenar por:
        </span>
        <Select
          value={sort}
          onValueChange={(value) => {
            const next = creatorSortSchema.safeParse(value)
            if (next.success) void navigate({ search: (prev) => ({ ...prev, ordem: next.data, page: 1 }) })
          }}
        >
          <SelectTrigger
            aria-label="Ordenar criadores por"
            className="h-auto min-w-0 gap-2 border-0 bg-transparent p-0 text-body-sm text-text-primary shadow-none hover:text-text-accent dark:bg-transparent dark:hover:bg-transparent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {CREATOR_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function CreatorsPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end md:mt-12">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link to="/criadores" search={(prev) => ({ ...prev, page: page - 1 })} aria-label="Página anterior" className={pageBox}>
              <ChevronLeft aria-hidden="true" className="size-[18px]" />
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                to="/criadores"
                search={(prev) => ({ ...prev, page: p })}
                aria-label={`Página ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(pageBox, p === page && 'border-primary bg-primary font-bold text-primary-foreground')}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <Link to="/criadores" search={(prev) => ({ ...prev, page: page + 1 })} aria-label="Próxima página" className={pageBox}>
              <ChevronRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

export function CreatorsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const query = useQuery(contentQueries.creators({ q: search.q, sort: search.ordem, page: search.page }))
  const { data, isPending, isError, isPlaceholderData, isFetching, error, refetch } = query
  const items = data?.items ?? []
  const total = data?.meta.total

  let body
  if (isPending) {
    body = (
      <ul className={GRID} aria-busy="true" aria-label="Carregando criadores" data-testid="creators-skeleton">
        {Array.from({ length: CREATORS_PAGE_SIZE }, (_, i) => (
          <li key={i}>
            <CreatorCardSkeleton />
          </li>
        ))}
      </ul>
    )
  } else if (isError && !data) {
    body = (
      <StateBox title="Não foi possível carregar os criadores" role="alert">
        <p className="max-w-md text-body text-text-secondary">{errorMessageOf(error)}</p>
        <Button onClick={() => void refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
          Tentar novamente
        </Button>
      </StateBox>
    )
  } else if (items.length === 0) {
    const beyond = (data?.meta.totalPages ?? 0) > 0
    body = (
      <StateBox title={beyond ? 'Esta página não existe' : 'Nenhum criador encontrado'} role="status">
        <p className="max-w-md text-body text-text-secondary">
          {beyond ? 'Os resultados terminam antes desta página.' : search.q ? `Nenhum resultado para "${search.q}".` : 'Ainda não há criadores listados.'}
        </p>
        {(beyond || search.q) && (
          <Button onClick={() => void navigate({ search: (prev) => (beyond ? { ...prev, page: 1 } : { ordem: prev.ordem }) })} className="h-10 rounded-control px-5 text-body-md font-bold">
            {beyond ? 'Ir para a primeira página' : 'Limpar busca'}
          </Button>
        )}
      </StateBox>
    )
  } else {
    body = (
      <ul
        className={cn(GRID, 'transition-opacity', isPlaceholderData && 'opacity-60')}
        aria-label="Criadores"
        aria-busy={isPlaceholderData || isFetching ? 'true' : undefined}
        data-testid="creators-grid"
      >
        {items.map((c) => (
          <li key={c.id}>
            <CreatorCard creator={c} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-12 xl:px-0">
      <div className="pt-10 md:pt-8">
        <EditorialHero eyebrow="Comunidade" title="Criadores">
          Conheça artistas, estúdios e comunidades que moldam a cultura digital. Siga quem você admira e explore a coleção principal de cada um.
        </EditorialHero>
      </div>
      <section aria-labelledby="criadores-titulo" className="mt-6 md:mt-12">
        <h2 id="criadores-titulo" className="sr-only">
          Lista de criadores
        </h2>
        <Toolbar q={search.q} sort={search.ordem} />
        <p role="status" className="sr-only">
          {isFetching && !isPending ? 'Atualizando resultados…' : total === undefined ? '' : `${total} ${total === 1 ? 'criador encontrado' : 'criadores encontrados'}.`}
        </p>
        <div className="mt-6">{body}</div>
        {data && <CreatorsPagination page={data.meta.page} totalPages={data.meta.totalPages} />}
      </section>
    </div>
  )
}
