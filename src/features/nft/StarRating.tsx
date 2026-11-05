/** Five stars for a rating string such as "4.8" (rounded to the nearest whole star; text is the label). */
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

function starsOf(average: string): number {
  const [whole = '0', fraction = '0'] = average.split('.')
  return Math.min(5, parseInt(whole, 10) + (parseInt(fraction.charAt(0) || '0', 10) >= 5 ? 1 : 0))
}

export function StarRating({ value, label, className }: { value: string; label: string; className?: string }) {
  const filled = starsOf(value)
  return (
    <span role="img" aria-label={label} className={cn('inline-flex gap-1 text-text-accent', className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className="size-[15px]" fill={i < filled ? 'currentColor' : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  )
}
