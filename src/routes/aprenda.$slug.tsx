import { createFileRoute } from '@tanstack/react-router'
import { ArticlePage } from '@/features/learn/ArticlePage'
import { contentQueries } from '@/queries/content'

export const Route = createFileRoute('/aprenda/$slug')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(contentQueries.article(params.slug))
  },
  head: () => ({ meta: [{ title: 'Artigo — KURIO' }] }),
  component: ArticlePage,
})
