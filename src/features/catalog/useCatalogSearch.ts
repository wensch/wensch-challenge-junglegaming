/**
 * Catalog state lives in the URL (CAT-1): the route validates it (`catalogSearchSchema`) and every
 * change goes through `update`, which resets the page to 1 unless a page is given (CAT-2).
 */
import { useCallback } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { CatalogSearch, CatalogSearchInput } from '@/api/contracts'

const route = getRouteApi('/')

export function useCatalogSearch() {
  const search: CatalogSearch = route.useSearch()
  const navigate = route.useNavigate()
  const update = useCallback(
    (patch: Partial<CatalogSearchInput>) => navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) }),
    [navigate],
  )
  const clear = useCallback(() => navigate({ search: {} }), [navigate])
  return { search, update, clear }
}

/** True when anything beyond the defaults narrows the result (used for the empty-state copy). */
export function hasActiveFilters(s: CatalogSearch): boolean {
  return Boolean(s.q) || s.tab !== 'all' || s.categories.length > 0 || s.networks.length > 0 || s.priceMin !== undefined || s.priceMax !== undefined
}
