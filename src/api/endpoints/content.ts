/** Editorial endpoints: creators directory and learning articles (public, v1.4.0). */
import { buildPath, endpoints, type ArticleListQuery, type CreatorListQuery } from '@/api/contracts'
import { send, type CallOptions } from '@/api/client'

export const listCreators = (query: Partial<CreatorListQuery>, opts: CallOptions = {}) => {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params[k] = String(v)
  return send(endpoints.listCreators, { path: buildPath(endpoints.listCreators.path), query: params, ...opts })
}

export const listArticles = (query: ArticleListQuery, opts: CallOptions = {}) =>
  send(endpoints.listArticles, { path: buildPath(endpoints.listArticles.path), ...(query.category ? { query: { category: query.category } } : {}), ...opts })

export const getArticle = (slug: string, opts: CallOptions = {}) => send(endpoints.getArticle, { path: buildPath(endpoints.getArticle.path, { slug }), ...opts })
