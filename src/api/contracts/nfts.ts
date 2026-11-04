/**
 * NFT catalog contracts: list (search/filters/sort/pagination), featured, detail, editions.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import {
  ethSchema,
  idSchema,
  imageSchema,
  isoDateTimeSchema,
  networkSchema,
  NETWORKS,
  paginationMetaSchema,
  stockSchema,
  compareEthStrings,
  versionSchema,
} from './common'

/** Collections sidebar of the home frame ("Coleções"). */
export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const categorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof categorySchema>

/** Tabs above the grid: "Todos os NFTs" / "Novos lançamentos" / "Em alta". */
export const CATALOG_TABS = ['all', 'new', 'trending'] as const
export const catalogTabSchema = z.enum(CATALOG_TABS)
export type CatalogTab = z.infer<typeof catalogTabSchema>

/** "Ordenar por:" — default "Listados recentemente". */
export const CATALOG_SORTS = ['recent', 'price_asc', 'price_desc', 'name_asc'] as const
export const catalogSortSchema = z.enum(CATALOG_SORTS)
export type CatalogSort = z.infer<typeof catalogSortSchema>

export const CATALOG_PAGE_SIZE = 9

/** Edition chips "1/1", "1/10", "1/50", "ABERTA". `supply: null` = open edition. */
export const EDITION_KINDS = ['1/1', '1/10', '1/50', 'open'] as const
export const editionSchema = z.object({
  id: idSchema,
  kind: z.enum(EDITION_KINDS),
  label: z.string(),
  supply: z.int().min(1).nullable(),
  /** Units still purchasable right now. 0 = sold out ("edição indisponível"). */
  available: stockSchema,
  /** Max units a single order may contain for this edition (limit of the quantity stepper). */
  maxPerOrder: z.int().min(1),
  price: ethSchema,
  /** Original price shown struck-through when on sale. */
  compareAtPrice: ethSchema.nullable(),
})
export type Edition = z.infer<typeof editionSchema>

/** Card in grids/carousels. `price` = price of `defaultEditionId`. */
export const nftSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  tokenId: z.string(), // display form, e.g. "#0042"
  collection: z.object({ id: idSchema, name: z.string() }),
  category: categorySchema,
  network: networkSchema,
  image: imageSchema,
  defaultEditionId: idSchema,
  price: ethSchema,
  compareAtPrice: ethSchema.nullable(),
  /** Sum of `available` over all editions. */
  available: stockSchema,
  soldOut: z.boolean(),
  listedAt: isoDateTimeSchema,
  isNew: z.boolean(),
  isTrending: z.boolean(),
  /** Monotonic version shared with `nft.updated` events. */
  version: versionSchema,
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  gallery: z.array(imageSchema).min(1),
  attributes: z.array(z.string()),
  contract: z.object({ address: z.string(), standard: z.enum(['ERC-721', 'ERC-1155', 'SPL']) }),
  royaltyPercent: z.string().regex(/^\d+(\.\d{1,2})?$/),
  rating: z.object({ average: z.string().regex(/^\d(\.\d)?$/), count: z.int().min(0) }),
  /** "Avaliações de colecionadores" tab (read-only; most recent first). */
  reviews: z.array(
    z.object({ id: idSchema, author: z.string(), rating: z.int().min(1).max(5), text: z.string(), createdAt: isoDateTimeSchema }),
  ),
  provenance: z.string(),
  editions: z.array(editionSchema).min(1),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

// ---------------------------------------------------------------------------
// Search params: URL (route validateSearch) and API query.
// ---------------------------------------------------------------------------

const searchText = z.string().trim().max(100)
const priceParam = ethSchema

/** Accepts `a`, `a,b` or `['a','b']` and keeps only known values (unique, sorted for stable keys). */
function enumList<T extends string>(values: readonly [T, ...T[]]) {
  const allowed = new Set<string>(values)
  return z.preprocess((v) => {
    const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
    const kept = raw.filter((x): x is T => typeof x === 'string' && allowed.has(x))
    return [...new Set(kept)].sort()
  }, z.array(z.enum(values)))
}

/**
 * Home route search params (`/` validateSearch). Invalid values fall back to defaults
 * (`.catch`) so a hand-edited URL never crashes the page. Any filter change must reset `page` to 1.
 */
export const catalogSearchSchema = z
  .object({
    q: searchText.optional().catch(undefined),
    tab: catalogTabSchema.default('all').catch('all'),
    categories: enumList(CATEGORIES).default([]).catch([]),
    networks: enumList(NETWORKS).default([]).catch([]),
    priceMin: priceParam.optional().catch(undefined),
    priceMax: priceParam.optional().catch(undefined),
    sort: catalogSortSchema.default('recent').catch('recent'),
    page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  })
  .transform((s) => {
    // Swap an inverted range instead of producing an always-empty result.
    if (s.priceMin !== undefined && s.priceMax !== undefined && compareEthStrings(s.priceMin, s.priceMax) > 0) {
      return { ...s, priceMin: s.priceMax, priceMax: s.priceMin }
    }
    return s
  })
export type CatalogSearch = z.infer<typeof catalogSearchSchema>
export type CatalogSearchInput = z.input<typeof catalogSearchSchema>

/** GET /nfts query, as parsed by the MSW handler from URLSearchParams. */
export const nftListQuerySchema = z.object({
  q: searchText.optional(),
  tab: catalogTabSchema.default('all'),
  categories: enumList(CATEGORIES).default([]),
  networks: enumList(NETWORKS).default([]),
  priceMin: priceParam.optional(),
  priceMax: priceParam.optional(),
  sort: catalogSortSchema.default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(CATALOG_PAGE_SIZE),
  collectionId: idSchema.optional(),
  excludeId: idSchema.optional(),
})
export type NftListQuery = z.infer<typeof nftListQuerySchema>

/** Serialize a parsed query to flat string params (Axios `params`). Arrays become comma lists. */
export function toNftListParams(q: Partial<NftListQuery>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.join(',')
    } else out[k] = String(v)
  }
  return out
}

export const facetCountSchema = z.object({ value: z.string(), count: z.int().min(0) })

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  meta: paginationMetaSchema,
  /** Counts for the sidebar, computed over the query *without* that facet's own filter. */
  facets: z.object({
    categories: z.array(facetCountSchema),
    networks: z.array(facetCountSchema),
    priceRange: z.object({ min: ethSchema, max: ethSchema }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

/** GET /nfts/featured — hero carousel + "NFT em destaque / oferta limitada". */
export const featuredResponseSchema = z.object({
  hero: z.array(nftSummarySchema).min(1),
  spotlight: nftSummarySchema,
})
export type FeaturedResponse = z.infer<typeof featuredResponseSchema>

/** `/nft/$id` search params: selected edition and quantity. */
export const nftDetailSearchSchema = z.object({
  edition: idSchema.optional().catch(undefined),
})
export type NftDetailSearch = z.infer<typeof nftDetailSearchSchema>
