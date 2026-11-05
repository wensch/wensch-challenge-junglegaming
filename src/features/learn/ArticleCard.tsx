/** Article card shared by the learning tracks, the filtered list and "Artigos relacionados". */
import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import type { ArticleCategory, ArticleSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  fundamentos: 'Fundamentos',
  arte: 'Arte e criadores',
  seguranca: 'Segurança',
  mercado: 'Mercado',
}

export const readingTime = (minutes: number) => `${minutes} min de leitura`

export function ArticleCard({ article, step }: { article: ArticleSummary; step?: number }) {
  return (
    <article
      className="group/article relative flex min-h-[152px] gap-4 rounded-card bg-surface-card p-4 transition-colors hover:bg-surface-dark md:rounded-control"
      data-testid="article-card"
      data-slug={article.slug}
    >
      <img
        src={article.image.src}
        alt=""
        width={article.image.width}
        height={article.image.height}
        loading="lazy"
        decoding="async"
        className="size-[104px] shrink-0 rounded-control object-cover md:size-[120px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 text-caption-sm text-text-secondary">
          {step !== undefined && <span className="font-bold text-text-accent">Trilha {step}</span>}
          <span>{CATEGORY_LABELS[article.category]}</span>
        </p>
        <h3 className="text-body-md font-bold text-text-primary">
          <Link
            to="/aprenda/$slug"
            params={{ slug: article.slug }}
            className="rounded-control outline-offset-4 after:absolute after:inset-0 group-hover/article:text-text-accent"
          >
            {article.title}
          </Link>
        </h3>
        <p className="text-body-sm text-text-secondary">{article.excerpt}</p>
        <p className="mt-auto flex items-center gap-1.5 pt-1 text-caption-sm text-text-secondary">
          <Clock aria-hidden="true" className="size-3.5" />
          {readingTime(article.readingMinutes)}
        </p>
      </div>
    </article>
  )
}

export function ArticleCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex min-h-[152px] gap-4 rounded-card bg-surface-card p-4 md:rounded-control', className)}>
      <Skeleton className="size-[104px] shrink-0 md:size-[120px]" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-auto h-3.5 w-1/4" />
      </div>
    </div>
  )
}
