/**
 * Editorial contracts (v1.4.0): creators directory (`/criadores`) and learning articles (`/aprenda`).
 * Public data, no session. FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { idSchema, imageSchema, isoDateTimeSchema, paginationMetaSchema } from './common'

const searchText = z.string().trim().max(100)

// --- Creators ---------------------------------------------------------------

export const CREATOR_SORTS = ['nfts', 'followers'] as const
export const creatorSortSchema = z.enum(CREATOR_SORTS)
export type CreatorSort = z.infer<typeof creatorSortSchema>

export const CREATORS_PAGE_SIZE = 9

/** `/criadores` search params (route validateSearch). Invalid values fall back to defaults. */
export const creatorsSearchSchema = z.object({
  q: searchText.optional().catch(undefined),
  ordem: creatorSortSchema.default('nfts').catch('nfts'),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
})
export type CreatorsSearch = z.infer<typeof creatorsSearchSchema>

/** GET /creators query. */
export const creatorListQuerySchema = z.object({
  q: searchText.optional(),
  sort: creatorSortSchema.default('nfts'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(CREATORS_PAGE_SIZE),
})
export type CreatorListQuery = z.infer<typeof creatorListQuerySchema>

export const creatorSchema = z.object({
  id: idSchema,
  name: z.string(),
  handle: z.string().regex(/^[a-z0-9_.-]{3,30}$/),
  bio: z.string(),
  verified: z.boolean(),
  followers: z.int().min(0),
  nftCount: z.int().min(0),
  mainCollection: z.object({ id: idSchema, name: z.string() }),
  /** Generated `data:image/svg+xml` avatar (allowed by the CSP `img-src`). */
  avatar: z.string().startsWith('data:image/'),
})
export type Creator = z.infer<typeof creatorSchema>

export const creatorListResponseSchema = z.object({ items: z.array(creatorSchema), meta: paginationMetaSchema })
export type CreatorListResponse = z.infer<typeof creatorListResponseSchema>

// --- Articles ---------------------------------------------------------------

export const ARTICLE_CATEGORIES = ['fundamentos', 'arte', 'seguranca', 'mercado'] as const
export const articleCategorySchema = z.enum(ARTICLE_CATEGORIES)
export type ArticleCategory = z.infer<typeof articleCategorySchema>

export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Slug inválido')

/** `/aprenda` search params. */
export const learnSearchSchema = z.object({
  categoria: articleCategorySchema.optional().catch(undefined),
})
export type LearnSearch = z.infer<typeof learnSearchSchema>

/** GET /articles query. */
export const articleListQuerySchema = z.object({ category: articleCategorySchema.optional() })
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>

export const articleSummarySchema = z.object({
  slug: slugSchema,
  title: z.string(),
  excerpt: z.string(),
  category: articleCategorySchema,
  readingMinutes: z.int().min(1),
  publishedAt: isoDateTimeSchema,
  /** Featured guides open the learning tracks block. */
  featured: z.boolean(),
  image: imageSchema,
})
export type ArticleSummary = z.infer<typeof articleSummarySchema>

export const articleListResponseSchema = z.object({ items: z.array(articleSummarySchema), total: z.int().min(0) })
export type ArticleListResponse = z.infer<typeof articleListResponseSchema>

export const articleDetailSchema = articleSummarySchema.extend({
  author: z.string(),
  sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()).min(1) })).min(1),
  related: z.array(articleSummarySchema),
})
export type ArticleDetail = z.infer<typeof articleDetailSchema>
