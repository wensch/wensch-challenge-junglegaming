/**
 * Filters sidebar (Figma "Filters", 310 px): collections, price range, network. Filters are
 * combinable and live in the URL; every change resets `page` (useCatalogSearch.update).
 * Facet counts come from the API (computed without the facet's own filter) and stay on screen
 * (keepPreviousData) while a new page loads.
 */
import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { z } from 'zod'
import { CATEGORIES, ETH_PATTERN, NETWORKS, type Category, type Network, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, NETWORK_LABELS } from './labels'
import { useCatalogSearch } from './useCatalogSearch'

const optionalEth = z
  .string()
  .trim()
  .refine((v) => v === '' || ETH_PATTERN.test(v), 'Use ponto decimal, ex.: 0.5')
const priceFormSchema = z.object({ priceMin: optionalEth, priceMax: optionalEth })
type PriceForm = z.infer<typeof priceFormSchema>

type Facets = NftListResponse['facets']

function countOf(list: { value: string; count: number }[] | undefined, value: string): number | undefined {
  return list?.find((f) => f.value === value)?.count
}

function toggle<T extends string>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FacetRow({ label, count, checked, onChange }: { label: string; count: number | undefined; checked: boolean; onChange: () => void }) {
  return (
    <li>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control px-3 text-body-sm text-text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:checked]:font-bold">
        <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
        <Check aria-hidden="true" className={cn('size-3.5 shrink-0', checked ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
        <span className="flex-1">{label}</span>
        {count === undefined ? <Skeleton className="h-4 w-8" /> : <span className="tabular-nums" aria-label={`${count} ${count === 1 ? 'resultado' : 'resultados'}`}>({count})</span>}
      </label>
    </li>
  )
}

function PriceRangeForm({ facets }: { facets: Facets | undefined }) {
  const uid = useId()
  const { search, update } = useCatalogSearch()
  const form = useForm<PriceForm>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: { priceMin: search.priceMin ?? '', priceMax: search.priceMax ?? '' },
  })
  const { register, handleSubmit, reset, formState } = form
  const { errors } = formState

  // The URL is the source of truth (back/forward, clear filters): keep the fields in sync with it.
  useEffect(() => {
    reset({ priceMin: search.priceMin ?? '', priceMax: search.priceMax ?? '' })
  }, [search.priceMin, search.priceMax, reset])

  const onSubmit = handleSubmit((values) => {
    void update({ priceMin: values.priceMin || undefined, priceMax: values.priceMax || undefined })
  })

  const range = facets ? `Preço disponível: ${formatEth(facets.priceRange.min)} a ${formatEth(facets.priceRange.max)}` : null
  return (
    <form onSubmit={onSubmit} noValidate aria-label="Faixa de preço" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {(['priceMin', 'priceMax'] as const).map((name) => (
          <div key={name} className="flex flex-col gap-1">
            <label htmlFor={`${uid}-${name}`} className="text-caption-sm text-text-secondary">
              {name === 'priceMin' ? 'Mínimo (ETH)' : 'Máximo (ETH)'}
            </label>
            <input
              id={`${uid}-${name}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder={name === 'priceMin' ? '0.02' : '12.3'}
              aria-invalid={errors[name] ? true : undefined}
              aria-describedby={errors[name] ? `${uid}-${name}-error` : range ? `${uid}-range` : undefined}
              className="h-9 w-full min-w-0 rounded-control border border-line-soft bg-ink px-2 text-body-sm text-text-primary placeholder:text-text-secondary/60 aria-invalid:border-destructive"
              {...register(name)}
            />
            {errors[name] && (
              <p id={`${uid}-${name}-error`} role="alert" className="text-caption-sm text-destructive">
                {errors[name].message}
              </p>
            )}
          </div>
        ))}
      </div>
      {range && (
        <p id={`${uid}-range`} className="text-caption-sm text-text-secondary">
          {range}
        </p>
      )}
      <Button type="submit" className="h-7 w-[84px] rounded-control text-caption-sm font-bold">
        Aplicar
      </Button>
    </form>
  )
}

export function FilterPanel({ facets, className }: { facets: Facets | undefined; className?: string }) {
  const uid = useId()
  const { search, update } = useCatalogSearch()
  return (
    <div className={cn('flex flex-col gap-0 rounded-control bg-surface-card px-3 py-6', className)}>
      <section aria-labelledby={`${uid}-collections`}>
        <h2 id={`${uid}-collections`}className="px-3 pb-2 text-body-md font-bold text-text-primary">
          Coleções
        </h2>
        <ul>
          {CATEGORIES.map((value: Category) => (
            <FacetRow
              key={value}
              label={CATEGORY_LABELS[value]}
              count={countOf(facets?.categories, value)}
              checked={search.categories.includes(value)}
              onChange={() => void update({ categories: toggle(search.categories, value) })}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby={`${uid}-price`} className="mt-6 px-3">
        <h2 id={`${uid}-price`}className="pb-3 text-body-md font-bold text-text-primary">
          Faixa de preço
        </h2>
        <PriceRangeForm facets={facets} />
      </section>
      <section aria-labelledby={`${uid}-network`} className="mt-6">
        <h2 id={`${uid}-network`}className="px-3 pb-2 text-body-md font-bold text-text-primary">
          Rede
        </h2>
        <ul>
          {NETWORKS.map((value: Network) => (
            <FacetRow
              key={value}
              label={NETWORK_LABELS[value]}
              count={countOf(facets?.networks, value)}
              checked={search.networks.includes(value)}
              onChange={() => void update({ networks: toggle(search.networks, value) })}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
