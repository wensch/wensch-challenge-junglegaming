/** Tabs ("Todos os NFTs" / "Novos lançamentos" / "Em alta") and the sort select of the grid toolbar. */
import { Link } from '@tanstack/react-router'
import { CATALOG_SORTS, CATALOG_TABS, catalogSortSchema, type CatalogSort } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SORT_LABELS, TAB_LABELS } from './labels'
import { useCatalogSearch } from './useCatalogSearch'

export function CatalogTabs({ className }: { className?: string }) {
  const { search } = useCatalogSearch()
  return (
    <nav aria-label="Seções do catálogo" className={className}>
      <ul className="flex gap-x-3 overflow-x-auto md:flex-wrap md:gap-x-5 md:gap-y-2 md:overflow-visible">
        {CATALOG_TABS.map((tab) => {
          const active = search.tab === tab
          return (
            <li key={tab}>
              <Link
                to="/"
                search={(prev) => ({ ...prev, tab, page: 1 })}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'block border-b-2 pb-1 text-body-sm leading-4 whitespace-nowrap max-md:text-sm transition-colors',
                  active ? 'border-primary font-bold text-text-accent' : 'border-transparent text-text-primary hover:text-text-accent',
                )}
              >
                {TAB_LABELS[tab]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SortSelect({ className, id }: { className?: string; id?: string }) {
  const { search, update } = useCatalogSearch()
  return (
    <div className={cn('flex items-center gap-1.5 text-body-sm', className)}>
      <span aria-hidden="true" className="text-text-primary">
        Ordenar por:
      </span>
      <Select
        value={search.sort}
        onValueChange={(value) => {
          const sort = catalogSortSchema.safeParse(value)
          if (sort.success) void update({ sort: sort.data satisfies CatalogSort })
        }}
      >
        <SelectTrigger
          id={id}
          aria-label="Ordenar por"
          className="h-auto min-w-0 gap-2 border-0 bg-transparent p-0 text-body-sm text-text-primary shadow-none hover:text-text-accent dark:bg-transparent dark:hover:bg-transparent"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {CATALOG_SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
