/** Numbered pagination (Figma "Pagination": 35 px squares). Links keep the page in the URL (history). */
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Pages to render: all when few, otherwise first, last and a window around the current one. */
export function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev > 1) out.push('gap')
    out.push(p)
  })
  return out
}

const box = 'grid size-[35px] place-items-center rounded-control border border-line-soft text-body-sm text-text-primary transition-colors hover:border-primary'

export const pageBox = box

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link to="/" search={(prev) => ({ ...prev, page: page - 1 })} aria-label="Página anterior" className={box}>
              <ChevronLeft aria-hidden="true" className="size-[18px]" />
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                to="/"
                search={(prev) => ({ ...prev, page: p })}
                aria-label={`Página ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(box, p === page && 'border-primary bg-primary font-bold text-primary-foreground')}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <Link to="/" search={(prev) => ({ ...prev, page: page + 1 })} aria-label="Próxima página" className={box}>
              <ChevronRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
