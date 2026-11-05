/**
 * Article detail (`/aprenda/$slug`): title, meta, sections with subtitles and related articles.
 * The `h1` takes focus after a client-side navigation. Unknown slug: honest "não encontrado" page.
 */
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Clock } from 'lucide-react'
import { isApiError } from '@/api/contracts'
import { errorMessageOf, PageFrame } from '@/components/layout/PageStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { contentQueries } from '@/queries/content'
import { ArticleCard, CATEGORY_LABELS, readingTime } from './ArticleCard'

const route = getRouteApi('/aprenda/$slug')
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

function ArticleSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4" data-testid="article-skeleton">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-6 h-6 w-1/3" />
      <Skeleton className="h-[120px]" />
      <Skeleton className="h-[120px]" />
    </div>
  )
}

export function ArticlePage() {
  const { slug } = route.useParams()
  const { data, isPending, isError, error, refetch } = useQuery(contentQueries.article(slug))
  const headingRef = usePageHeadingFocus(data?.slug)

  useEffect(() => {
    if (data) document.title = `${data.title} — KURIO`
  }, [data])

  if (isError && !data) {
    const missing = isApiError(error) && error.is('NOT_FOUND')
    return (
      <PageFrame title={missing ? 'Artigo não encontrado' : 'Não foi possível carregar o artigo'} eyebrow={missing ? 'Erro 404' : 'Erro'}>
        <p role="alert" className="text-body text-text-secondary">
          {missing ? 'Este artigo não existe ou foi removido.' : errorMessageOf(error)}
        </p>
        {missing ? (
          <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
            <Link to="/aprenda">Ver todos os artigos</Link>
          </Button>
        ) : (
          <Button onClick={() => void refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
            Tentar novamente
          </Button>
        )}
      </PageFrame>
    )
  }

  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-12 pt-10 md:pt-8 xl:px-0">
      <nav aria-label="Você está em" className="mb-6">
        <Link to="/aprenda" className="inline-flex items-center gap-2 text-body-sm text-text-accent underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Aprenda
        </Link>
      </nav>

      {isPending || !data ? (
        <div className="max-w-[720px]" aria-busy="true">
          <p role="status" className="sr-only">
            Carregando artigo…
          </p>
          <ArticleSkeleton />
        </div>
      ) : (
        <>
          <article className="max-w-[720px]" data-testid="article">
            <header className="flex flex-col gap-3">
              <p className="text-caption-sm tracking-figma text-text-secondary uppercase">{CATEGORY_LABELS[data.category]}</p>
              <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-text-primary outline-none wide:text-display">
                {data.title}
              </h1>
              <p className="text-body text-text-secondary">{data.excerpt}</p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
                <span>Por {data.author}</span>
                <time dateTime={data.publishedAt}>{date.format(new Date(data.publishedAt))}</time>
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="size-3.5" />
                  {readingTime(data.readingMinutes)}
                </span>
              </p>
            </header>
            <div className="mt-8 flex flex-col gap-8">
              {data.sections.map((s) => (
                <section key={s.heading} className="flex flex-col gap-3">
                  <h2 className="text-body-lg font-bold text-text-primary">{s.heading}</h2>
                  {s.paragraphs.map((p, i) => (
                    <p key={i} className="text-body leading-7 text-foreground">
                      {p}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>

          {data.related.length > 0 && (
            <section aria-labelledby="relacionados-titulo" className="mt-16">
              <h2 id="relacionados-titulo" className="mb-4 text-heading font-bold text-text-primary">
                Artigos relacionados
              </h2>
              <ul className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3" aria-label="Artigos relacionados">
                {data.related.map((a) => (
                  <li key={a.slug}>
                    <ArticleCard article={a} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
