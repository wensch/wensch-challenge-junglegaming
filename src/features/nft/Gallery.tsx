/**
 * Gallery (Figma "Product Images": 100 px thumbnails column + 444 px main image with a zoom button).
 * Thumbnails are real buttons (`aria-current`); zoom opens a dialog (focus trap, Esc, focus return).
 */
import { useState } from 'react'
import { SearchIcon } from '@/components/icons/figma'
import type { Image } from '@/api/contracts'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function Gallery({ images, name }: { images: Image[]; name: string }) {
  const [selected, setSelected] = useState(0)
  const index = selected < images.length ? selected : 0
  const current = images[index]!
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-7">
      {/* Figma column of thumbnails (desktop); on mobile the same buttons become a row under the main image. */}
      <ul aria-label={`Imagens de ${name}`} className="order-2 flex shrink-0 flex-row gap-3 md:order-1 md:w-[100px] md:flex-col md:gap-4">
        {images.map((image, i) => (
          <li key={`${image.src}-${i}`}>
            <button
              type="button"
              aria-label={`Imagem ${i + 1} de ${images.length}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setSelected(i)}
              className={cn('block size-[64px] overflow-hidden md:size-[100px] rounded-card border-2 bg-surface-card', i === index ? 'border-primary' : 'border-transparent')}
            >
              <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative order-1 w-full max-w-[444px] flex-1 md:order-2">
        <div className="grid aspect-square place-items-center md:rounded-card md:bg-surface-card md:p-5">
          <img
            src={current.src}
            srcSet={current.srcset}
            sizes="(min-width: 48rem) 444px, 100vw"
            alt={current.alt}
            width={current.width}
            height={current.height}
            fetchPriority="high"
            decoding="async"
            className="aspect-square w-full rounded-[24px] object-cover"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Ampliar imagem"
              className="absolute top-4 right-4 hidden size-[30px] place-items-center rounded-full bg-ink/80 text-text-primary hover:text-text-accent md:grid"
            >
              <SearchIcon />
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
    <div className="flex flex-col gap-4 md:flex-row md:gap-7" aria-hidden="true">
      <div className="order-2 flex shrink-0 flex-row gap-3 md:order-1 md:flex-col md:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="size-[64px] rounded-card md:size-[100px]" />
        ))}
      </div>
      <Skeleton className="order-1 aspect-square w-full max-w-[444px] flex-1 rounded-card md:order-2" />
    </div>
  )
}
