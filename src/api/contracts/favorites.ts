/**
 * Favorites (authenticated only). PUT/DELETE are idempotent, which makes optimistic
 * toggling + rollback safe to retry.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import { z } from 'zod'
import { idSchema } from './common'
import { nftSummarySchema } from './nfts'

/** GET /favorites */
export const favoritesResponseSchema = z.object({
  nftIds: z.array(idSchema),
  items: z.array(nftSummarySchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

/** PUT /favorites/:nftId and DELETE /favorites/:nftId (no body). */
export const favoriteToggleResponseSchema = z.object({
  nftId: idSchema,
  favorited: z.boolean(),
})
export type FavoriteToggleResponse = z.infer<typeof favoriteToggleResponseSchema>
