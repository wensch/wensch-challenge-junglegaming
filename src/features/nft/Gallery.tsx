/**
 * Gallery (Figma "Product Images": 100 px thumbnails column + 444 px main image with a zoom button).
 * Thumbnails are real buttons (`aria-pressed`); zoom opens a dialog (focus trap, Esc, focus return).
 */
import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Image } from '@/api/contracts'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function Gallery({ images, name }: { images: Image[]; name: string }) {
  const [selected, setSelected] = useState(0)
  const index = selected < images.length ? selected : 0
  const current = images[index]!
  return (
    <div className="flex gap-4 md:gap-7">
      {/* The Figma column is always there (the seed has one image per NFT, so one thumbnail). */}
      <ul aria-label={`Imagens de ${name}`} className="hidden w-[100px] shrink-0 flex-col gap-4 md:flex">
        {images.map((image, i) => (
          <li key={`${image.src}-${i}`}>
            <button
              type="button"
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              aria-pressed={i === index}
              onClick={() => setSelected(i)}
              className={cn('block size-[100px] overflow-hidden rounded-card border-2 bg-surface-card', i === index ? 'border-primary' : 'border-transparent')}
            >
              <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative w-full max-w-[444px] flex-1">
        <div className="grid aspect-square place-items-center rounded-card bg-surface-card p-3 md:p-5">
          <img
            src={current.src}
            alt={current.alt}
            width={current.width}
            height={current.height}
            fetchPriority="high"
            decoding="async"
            className="size-full rounded-[24px] object-cover"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Ampliar imagem"
              className="absolute top-4 right-4 hidden size-[30px] place-items-center rounded-full bg-ink/80 text-text-primary hover:text-text-accent md:grid"
            >
              <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,720px)] bg-surface-card p-4">
            <DialogTitle className="text-body-lg font-bold text-text-primary">{name}</DialogTitle>
            <DialogDescription className="sr-only">Imagem ampliada do NFT.</DialogDescription>
            <img src={current.src} alt={current.alt} className="max-h-[75dvh] w-full rounded-card object-contain" />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export function GallerySkeleton() {
  return (
    <div className="flex gap-4 md:gap-7" aria-hidden="true">
      <div className="hidden shrink-0 flex-col gap-4 md:flex">
        <Skeleton className="size-[100px] rounded-card" />
      </div>
      <Skeleton className="aspect-square w-full max-w-[444px] flex-1 rounded-card" />
    </div>
  )
}
