/**
 * NFT card (Figma "Product Grid": 258x300 tile + name + price; mobile 175x200 tile with heart and
 * badge). The tile keeps a fixed height so the grid never shifts between skeleton and content.
 */
import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './FavoriteButton'

export function NftPrice({ price, compareAtPrice, className }: { price: string; compareAtPrice: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-3 text-body-md', className)}>
      <span className="sr-only">Preço: </span>
      <span className="font-bold text-text-accent" data-testid="nft-price">
        {formatEth(price)}
      </span>
      {compareAtPrice && (
        <>
          <span className="sr-only">, antes </span>
          <span className="font-normal text-text-secondary line-through">{formatEth(compareAtPrice)}</span>
        </>
      )}
    </p>
  )
}

interface NftCardProps {
  nft: NftSummary
  /** `related` = the smaller card of "Mais desta coleção" (219 px). */
  size?: 'grid' | 'related'
  priority?: boolean
}

export function NftCard({ nft, size = 'grid', priority = false }: NftCardProps) {
  const related = size === 'related'
  const badge = nft.soldOut ? 'Esgotado' : nft.isNew ? 'Novo' : null
  return (
    <article className="group/card relative flex min-w-0 flex-col" data-testid="nft-card" data-nft-id={nft.id}>
      <Link
        to="/nft/$id"
        params={{ id: nft.id }}
        className="flex min-w-0 flex-col rounded-card outline-offset-4 md:rounded-control"
      >
        <span
          className={cn(
            'relative grid place-items-center overflow-hidden rounded-card bg-surface-card md:rounded-control',
            related ? 'h-[255px]' : 'h-[200px] md:h-[300px]',
          )}
        >
          <img
            src={nft.image.src}
            srcSet={nft.image.srcset}
            sizes="(min-width: 48rem) 250px, 168px"
            alt={nft.image.alt}
            width={nft.image.width}
            height={nft.image.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(
              'h-auto w-auto rounded-[20px] object-contain',
              related ? 'max-h-[243px] max-w-[min(190px,100%)]' : 'max-h-[168px] max-w-[min(168px,100%)] md:max-h-[288px] md:max-w-[min(250px,100%)]',
            )}
          />
          {badge && (
            <span
              className={cn(
                'absolute top-4 left-0 rounded-r-control px-2 py-1 text-caption-sm font-bold tracking-figma uppercase',
                nft.soldOut ? 'bg-destructive text-primary-foreground' : 'bg-primary text-primary-foreground md:hidden',
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="mt-3 block px-2 md:px-0">
          <span className="block truncate text-body-sm text-text-primary md:text-caption-sm md:leading-4">{nft.tokenId ? `${nft.name} ${nft.tokenId}` : nft.name}</span>
          <NftPrice price={nft.price} compareAtPrice={nft.compareAtPrice} className="mt-0.5 md:mt-1.5 md:text-body-md" />
        </span>
      </Link>
      {!related && <FavoriteButton nft={nft} variant="icon" className="absolute top-3 right-3 md:hidden" />}
    </article>
  )
}

export function NftCardSkeleton({ size = 'grid' }: { size?: 'grid' | 'related' }) {
  const related = size === 'related'
  return (
    <div className="flex min-w-0 flex-col" aria-hidden="true">
      <Skeleton className={cn('rounded-card md:rounded-control', related ? 'h-[255px]' : 'h-[200px] md:h-[300px]')} />
      <div className="mt-3 flex flex-col gap-0.5 px-2 md:gap-1.5 md:px-0">
        <Skeleton className="h-[22px] w-3/5 md:h-4" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  )
}
