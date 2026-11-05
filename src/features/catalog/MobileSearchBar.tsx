/**
 * Mobile top bar of the home (Figma "Search Bar": field 313x45 + filter button 45x45). The filter
 * button opens a bottom sheet with the same filters and the sort select (focus trap and Esc by Radix).
 * Below `lg` this is how the filters are reached (the sidebar only exists from `lg`).
 */
import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { FilterPanel } from './FilterPanel'
import { SearchForm } from './SearchForm'
import { SortSelect } from './Toolbar'
import { hasActiveFilters, useCatalogSearch } from './useCatalogSearch'

export function MobileSearchBar({ facets }: { facets: NftListResponse['facets'] | undefined }) {
  const { search, update, clear } = useCatalogSearch()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex gap-2 lg:hidden">
      <SearchForm
        formLabel="Buscar no catálogo"
        inputId="busca"
        value={search.q ?? ''}
        onSearch={(q) => void update({ q })}
        placeholder="Explorar coleções"
        className="min-w-0 flex-1 justify-center rounded-card bg-surface-card px-3 py-[11px]"
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Filtros e ordenação"
            className="grid size-[45px] shrink-0 place-items-center rounded-card bg-gradient-to-br from-text-accent to-primary text-primary-foreground"
          >
            <Settings2 aria-hidden="true" className="size-[22px]" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-panel border-line px-4 pt-6 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-heading font-bold text-text-primary">Filtros</SheetTitle>
            <SheetDescription className="sr-only">Combine coleções, faixa de preço e rede. A lista é atualizada a cada mudança.</SheetDescription>
          </SheetHeader>
          <SortSelect id="sort-mobile" className="justify-between rounded-control bg-surface-card px-3 py-3" />
          <FilterPanel facets={facets} className="px-0" />
          <div className="flex gap-3">
            {hasActiveFilters(search) && (
              <Button variant="outline" onClick={() => void clear()} className="h-10 flex-1 rounded-control text-body-md">
                Limpar filtros
              </Button>
            )}
            <Button onClick={() => setOpen(false)} className="h-10 flex-1 rounded-control text-body-md font-bold">
              Ver resultados
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
