/** Typed queryOptions for the editorial pages (creators, learning articles). Public keys, no session. */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { creatorListQuerySchema, type ArticleCategory, type CreatorListQuery } from '@/api/contracts'
import { contentApi } from '@/api/endpoints'
import { STALE } from './client'
import { queryKeys } from './keys'

export const contentQueries = {
  creators: (query: Partial<CreatorListQuery>) => {
    const normalized = creatorListQuerySchema.parse(query)
    return queryOptions({
      queryKey: queryKeys.creators.list(normalized),
      queryFn: ({ signal }) => contentApi.listCreators(normalized, { signal }),
      staleTime: STALE.catalog,
      placeholderData: keepPreviousData,
    })
  },
  articles: (category?: ArticleCategory) =>
    queryOptions({
      queryKey: queryKeys.articles.list(category),
      queryFn: ({ signal }) => contentApi.listArticles({ category }, { signal }),
      staleTime: STALE.featured,
      placeholderData: keepPreviousData,
    }),
  article: (slug: string) =>
    queryOptions({
      queryKey: queryKeys.articles.detail(slug),
      queryFn: ({ signal }) => contentApi.getArticle(slug, { signal }),
      staleTime: STALE.featured,
    }),
}
