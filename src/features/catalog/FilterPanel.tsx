/**
 * Filters sidebar (Figma "Filters", 310 px): collections, price range, network. Filters are
 * combinable and live in the URL; every change resets `page` (useCatalogSearch.update).
 * Facet counts come from the API (computed without the facet's own filter) and stay on screen
 * (keepPreviousData) while a new page loads.
 */
import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { CATEGORIES, NETWORKS, type Category, type Network, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { add, compare, formatEth, normalize, percentOf, sub } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, NETWORK_LABELS } from './labels'
import { useCatalogSearch } from './useCatalogSearch'

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
      <label className="relative flex min-h-10 cursor-pointer items-center gap-2 rounded-control px-3 text-body-sm text-text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:checked]:font-bold">
        <input type="checkbox" checked={checked} onChange={onChange} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        <Check aria-hidden="true" className={cn('size-3.5 shrink-0', checked ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
        <span className="flex-1">{label}</span>
        {count === undefined ? <Skeleton className="h-4 w-8" /> : <span className="tabular-nums" aria-label={`${count} ${count === 1 ? 'resultado' : 'resultados'}`}>({count})</span>}
      </label>
    </li>
  )
}

const STEPS = 100
type Bounds = { min: string; max: string }

/** Price of an integer slider step (0..100): lo + (hi - lo) * step%, at most 4 decimals. ETH stays a string. */
function priceAt({ min, max }: Bounds, step: number): string {
  return normalize(formatEth(add(min, percentOf(sub(max, min), String(step))), { maxDecimals: 4, unit: false }))
}

function distance(a: string, b: string): string {
  return compare(a, b) >= 0 ? sub(a, b) : sub(b, a)
}

/** Nearest slider step for a decimal price (comparison with money.ts, never Number). */
function stepFor(bounds: Bounds, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  let best = fallback
  let bestDist: string | undefined
  for (let step = 0; step <= STEPS; step++) {
    const d = distance(value, priceAt(bounds, step))
    if (bestDist === undefined || compare(d, bestDist) < 0) {
      best = step
      bestDist = d
    }
  }
  return best
}

const RANGE_INPUT = cn(
  'pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent focus-visible:outline-none',
  '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-moz-range-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[6px] [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:bg-clip-content',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[6px] [&::-moz-range-thumb]:border-transparent [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:bg-clip-content',
  'focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-0 focus-visible:[&::-webkit-slider-thumb]:outline-ring',
  'focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-ring',
)

function PriceRangeForm({ facets }: { facets: Facets | undefined }) {
  const uid = useId()
  const { search, update } = useCatalogSearch()
  const bounds: Bounds | undefined = facets ? facets.priceRange : undefined
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(STEPS)

  // The URL is the source of truth (back/forward, clear filters): keep the handles in sync with it.
  const syncKey = bounds ? `${bounds.min}|${bounds.max}|${search.priceMin ?? ''}|${search.priceMax ?? ''}` : ''
  const [syncedKey, setSyncedKey] = useState('')
  if (bounds && syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setLo(stepFor(bounds, search.priceMin, 0))
    setHi(stepFor(bounds, search.priceMax, STEPS))
  }

  const price = (step: number) => (bounds ? priceAt(bounds, step) : '0')
  const loText = formatEth(price(lo), { maxDecimals: 4, unit: false })
  const hiText = formatEth(price(hi), { maxDecimals: 4, unit: false })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bounds) return
    // Handles on the ends mean "no bound" so rounding can never exclude the cheapest/dearest NFT.
    void update({ priceMin: lo === 0 ? undefined : price(lo), priceMax: hi === STEPS ? undefined : price(hi) })
  }

  const thumbStyle = (step: number) => `calc(${step}% + ${12 - step * 0.24}px)`
  return (
    <form onSubmit={onSubmit} aria-label="Faixa de preço" className="flex flex-col gap-3">
      <div className="relative h-6">
        <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-soft" aria-hidden="true" />
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand" style={{ left: thumbStyle(lo), right: `calc(100% - ${thumbStyle(hi)})` }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={lo}
          disabled={!bounds}
          aria-label="Preço mínimo (ETH)"
          aria-valuetext={`${loText} ETH`}
          onChange={(e) => setLo(Math.min(parseInt(e.target.value, 10), hi))}
          className={cn(RANGE_INPUT, lo >= 50 ? 'z-20' : 'z-10')}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={hi}
          disabled={!bounds}
          aria-label="Preço máximo (ETH)"
          aria-valuetext={`${hiText} ETH`}
          onChange={(e) => setHi(Math.max(parseInt(e.target.value, 10), lo))}
          className={cn(RANGE_INPUT, lo >= 50 ? 'z-10' : 'z-20')}
        />
      </div>
      <p id={`${uid}-text`} data-testid="price-range-text" className="text-caption-sm text-text-primary">
        Preço: {loText} – {hiText} ETH
      </p>
      {bounds && (
        <p className="text-caption-sm text-text-secondary">
          Preço disponível: {formatEth(bounds.min)} a {formatEth(bounds.max)}
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
