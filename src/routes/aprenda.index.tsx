import { createFileRoute } from '@tanstack/react-router'
import { learnSearchSchema } from '@/api/contracts'
import { LearnPage } from '@/features/learn/LearnPage'
import { contentQueries } from '@/queries/content'

export const Route = createFileRoute('/aprenda/')({
  validateSearch: learnSearchSchema,
  loaderDeps: ({ search }) => ({ categoria: search.categoria }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(contentQueries.articles())
    if (deps.categoria) void context.queryClient.prefetchQuery(contentQueries.articles(deps.categoria))
  },
  head: () => ({ meta: [{ title: 'Aprenda — KURIO' }] }),
  component: LearnPage,
})
