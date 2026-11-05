/**
 * Hero banner (Figma "Hero", 1200x450; mobile 366x190) with the featured NFTs from
 * `GET /nfts/featured`. The copy is static; the artwork cycles through `hero` via the dots
 * (manual, no auto-rotation: nothing moves on its own, WCAG 2.2.2).
 */
import { useRef, useState } from 'react'
import { useHeadingFocus } from '@/features/nft/useHeadingFocus'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { errorMessageOf } from '@/components/layout/PageStates'
import { nftQueries } from '@/queries/nfts'

const HERO_BOX = 'min-h-[190px] md:min-h-[450px]'

function HeroCopy({ children }: { children?: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useHeadingFocus(headingRef, 'home')
  return (
    <div className="flex min-w-0 flex-1 flex-col max-md:pb-6 justify-between self-stretch md:min-w-0 md:flex-1 md:justify-center wide:w-[600px] wide:flex-none md:gap-8 md:self-center">
      <div className="flex flex-col gap-1.5 md:gap-3">
        <p className="text-body-sm leading-4 text-text-primary">Bem-vindo à Kurio</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-text-primary outline-none max-md:text-[clamp(16px,4.4vw,20px)] max-md:leading-6 md:text-heading wide:text-display">
          <span className="md:hidden">SEJA DONO DA CULTURA DIGITAL</span>
          <span className="hidden md:inline">
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </span>
        </h1>
        <p className="text-caption-sm leading-[18px] text-text-secondary md:max-w-[557px] md:text-caption md:leading-6 md:text-text-secondary">
          <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
          <span className="hidden md:inline">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </span>
        </p>
      </div>
      {children}
    </div>
  )
}

function ExploreLink() {
  return (
    <>
      <Link to="/" hash="mercado" className="inline-flex items-center gap-2 text-caption-sm font-bold text-text-accent md:hidden">
        EXPLORAR <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <Button asChild className="hidden h-10 w-[140px] rounded-control text-body-md font-bold md:inline-flex">
        <Link to="/" hash="mercado">
          EXPLORAR
        </Link>
      </Button>
    </>
  )
}

function HeroFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Destaques"
      className={cn(
        'relative overflow-hidden rounded-card bg-gradient-to-br from-surface-dark to-surface-card px-6 py-[6px] md:rounded-none md:bg-none md:px-8 md:py-0 wide:px-10',
        HERO_BOX,
      )}
    >
      <div className={cn('flex items-center justify-between gap-3 md:gap-8', HERO_BOX)}>{children}</div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <HeroFrame>
      <HeroCopy>
        <div className="flex flex-col gap-4 md:gap-6">
          <ExploreLink />
          <div className="h-6 max-md:hidden" />
        </div>
      </HeroCopy>
      <div aria-hidden="true" className="shrink-0">
        <Skeleton className="size-[clamp(96px,28vw,120px)] rounded-[20px] md:size-[300px] md:rounded-[28px] wide:size-[450px]" />
      </div>
    </HeroFrame>
  )
}

function HeroArtwork({ items, index }: { items: NftSummary[]; index: number }) {
  const current = items[index]!
  const second = items.length > 1 ? items[(index + 1) % items.length]! : null
  return (
    <div className="relative size-[clamp(96px,28vw,120px)] shrink-0 md:size-[300px] wide:size-[450px]">
      <Link to="/nft/$id" params={{ id: current.id }} aria-label={`Ver ${current.name}`} className="block size-full">
        <img
          src={current.image.src}
          alt={current.image.alt}
          width={current.image.width}
          height={current.image.height}
          fetchPriority="high"
          decoding="async"
          className="size-full rounded-[20px] object-cover md:rounded-[28px]"
        />
      </Link>
      {second && (
        <img
          src={second.image.src}
          alt=""
          width={58}
          height={58}
          className="pointer-events-none absolute -bottom-2 left-3 size-[58px] rounded-[14px] border-2 border-surface-dark object-cover md:hidden"
        />
      )}
    </div>
  )
}

export function Hero() {
  const featured = useQuery(nftQueries.featured())
  const [selected, setSelected] = useState(0)

  if (featured.isPending) return <HeroSkeleton />
  if (featured.isError) {
    return (
      <HeroFrame>
        <HeroCopy>
          <ExploreLink />
        </HeroCopy>
        <div role="alert" className="flex w-full max-w-[450px] flex-col items-start gap-3 rounded-card bg-surface-card p-4 text-body-sm text-text-secondary">
          <p>Não foi possível carregar os destaques. {errorMessageOf(featured.error)}</p>
          <Button variant="outline" onClick={() => void featured.refetch()} className="h-8 rounded-control px-3 text-body-sm">
            Tentar novamente
          </Button>
        </div>
      </HeroFrame>
    )
  }

  const items = featured.data.hero
  const index = selected < items.length ? selected : 0
  return (
    <HeroFrame>
      <HeroCopy>
        <div className="flex flex-col gap-4 md:gap-6">
          <ExploreLink />
          {items.length > 1 && (
            <div role="group" aria-label="Escolher destaque" className="flex max-md:absolute max-md:inset-x-0 max-md:bottom-0.5 max-md:justify-center md:-ml-1.5 wide:ml-[519px]">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Destaque ${i + 1} de ${items.length}: ${item.name}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setSelected(i)}
                  className="grid size-6 shrink-0 place-items-center rounded-full"
                >
                  <span className={cn('block size-[7px] rounded-full', i === index ? 'bg-primary' : 'bg-primary/40')} />
                </button>
              ))}
            </div>
          )}
        </div>
      </HeroCopy>
      <HeroArtwork items={items} index={index} />
    </HeroFrame>
  )
}
