/** "NFT EM DESTAQUE / OFERTA LIMITADA" banner under the filters (Figma "Featured NFT Banner", 310x470). */
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { nftQueries } from '@/queries/nfts'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <aside aria-labelledby="spotlight-title" className="flex min-h-[470px] flex-col gap-4 pt-6">
      <div className="flex flex-col gap-4 rounded-t-card bg-surface-dark px-5 pt-3 pb-4">
        <h2 id="spotlight-title" className="text-heading font-bold text-text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="text-body-lg font-bold tracking-figma text-text-primary">OFERTA LIMITADA</p>
      </div>
      {children}
    </aside>
  )
}

export function Spotlight() {
  const featured = useQuery(nftQueries.featured())
  if (featured.isPending) {
    return (
      <Frame>
        <Skeleton className="h-[368px] w-full rounded-card" />
      </Frame>
    )
  }
  if (featured.isError) return null
  const nft = featured.data.spotlight
  return (
    <Frame>
      <Link to="/nft/$id" params={{ id: nft.id }} className="group relative block h-[368px] overflow-hidden rounded-card bg-surface-card">
        <img src={nft.image.src} alt={nft.image.alt} width={nft.image.width} height={nft.image.height} loading="lazy" decoding="async" className="size-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 bg-gradient-to-t from-ink/90 to-transparent px-4 pt-8 pb-3 text-body-sm text-text-primary">
          <span className="truncate font-bold">{nft.name}</span>
          <span className="shrink-0 font-bold text-text-accent">{formatEth(nft.price)}</span>
        </span>
      </Link>
    </Frame>
  )
}
