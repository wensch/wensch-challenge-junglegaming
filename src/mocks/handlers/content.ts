import { findArticle, listArticles, listCreators } from '../content'
import { fail, route } from '../http'
import { isActive } from '../scenario-state'

export const contentHandlers = [
  route('listCreators', ({ query }) => listCreators(query, isActive('catalog.empty'))),
  route('listArticles', ({ query }) => listArticles(query, isActive('catalog.empty'))),
  route('getArticle', ({ params }) => {
    const article = findArticle(params.slug!)
    return article ?? fail({ code: 'NOT_FOUND', message: 'Artigo não encontrado.', resource: { kind: 'article', id: params.slug! } })
  }),
]
