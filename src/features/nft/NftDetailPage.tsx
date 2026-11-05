/**
 * NFT detail (`/nft/$id`). States: skeleton (same boxes as the content, no layout shift), unknown NFT
 * (404 from the API), error with retry, success; real-time `nft.updated` patches the cached detail,
 * so price/availability change on screen and are announced in a `role="status"` region (RT-1, A11Y-6).
 */
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { ArrowLeftIcon, LinkedinIcon, StarIcon, TwitterIcon } from '@/components/icons/figma'
import { isApiError, type Edition, type NftDetail } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessageOf, PageFrame } from '@/components/layout/PageStates'
import { nftQueries } from '@/queries/nfts'
import { toSummary } from '@/queries/favorites'
import { cn } from '@/lib/utils'
import { DetailTabs } from './DetailTabs'
import { FavoriteButton } from './FavoriteButton'
import { Gallery, GallerySkeleton } from './Gallery'
import { NftCardSkeleton, NftPrice } from './NftCard'
import { EditionChips, PurchasePanel } from './PurchasePanel'
import { RelatedNfts } from './RelatedNfts'
import { StarRating } from './StarRating'
import { useHeadingFocus } from './useHeadingFocus'
import { useNftUpdateMessage } from './useNftUpdateMessage'

const route = getRouteApi('/nft/$id')

/** Edition shown: the requested one (even if sold out, so the page can explain it), else the default one, else the first in stock. */
function pickEdition(nft: NftDetail, requestedId: string | undefined): Edition {
  const requested = requestedId ? nft.editions.find((e) => e.id === requestedId) : undefined
  if (requested) return requested
  const fallback = nft.editions.find((e) => e.id === nft.defaultEditionId) ?? nft.editions[0]!
  return fallback.available > 0 ? fallback : (nft.editions.find((e) => e.available > 0) ?? fallback)
}

function shareLinks(name: string) {
  const url = encodeURIComponent(window.location.href)
  const text = encodeURIComponent(`${name} na KURIO`)
  return [
    { label: 'Compartilhar no LinkedIn (abre em nova aba)', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, icon: <LinkedinIcon className="size-6" />, external: true },
    { label: 'Compartilhar por e-mail', href: `mailto:?subject=${text}&body=${url}`, icon: <Mail aria-hidden="true" className="size-[18px]" />, external: false },
    { label: 'Compartilhar no Twitter (abre em nova aba)', href: `https://twitter.com/intent/tweet?url=${url}&text=${text}`, icon: <TwitterIcon className="size-6" />, external: true },
  ]
}

function Breadcrumb() {
  return (
    <nav aria-label="Você está em" className="hidden text-body-sm font-bold text-text-primary md:block">
      <Link to="/" className="hover:text-text-accent">
        Início
      </Link>
      {' / '}
      <Link to="/" hash="mercado" className="hover:text-text-accent">
        Mercado
      </Link>
    </nav>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-page px-gutter pt-0 pb-16 md:pt-8 xl:px-0">{children}</div>
}

function DetailSkeleton() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Carregando detalhes do NFT" role="status">
        <Skeleton className="hidden h-4 w-36 md:block" />
        <div className="flex flex-col md:mt-7 md:gap-8 lg:min-h-[582px] lg:flex-row">
          <div className="max-md:-mx-6 max-md:rounded-t-[40px] max-md:bg-surface-card max-md:px-7 max-md:pt-[23px] max-md:pb-4 lg:w-[573px] lg:shrink-0">
            <Skeleton className="mb-2 size-[35px] rounded-full md:hidden" />
            <GallerySkeleton />
          </div>
          <div className="flex min-h-[549px] flex-1 flex-col gap-6 lg:min-h-0" aria-hidden="true">
            <Skeleton className="h-[37px] w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-[72px] w-full" />
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-[50px] w-full" />
            <Skeleton className="h-[84px] w-1/2" />
          </div>
        </div>
        {/* Tabs + "Mais desta coleção": reserved so the footer does not move when the content lands. */}
        <div className="mt-12 md:mt-[96px]" aria-hidden="true">
          <Skeleton className="h-[34px] w-full" />
          <Skeleton className="mt-4 h-[507px] w-full md:h-[237px]" />
        </div>
        <div className="mt-16 md:mt-24" aria-hidden="true">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 flex gap-4 overflow-hidden md:grid md:grid-cols-5 md:gap-[7px]">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-[190px] shrink-0 md:w-auto">
                <NftCardSkeleton size="related" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function BackBar({ nft }: { nft: NftDetail }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className="mb-2 flex items-center justify-between md:hidden">
      {canGoBack ? (
        <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className="grid size-[35px] place-items-center rounded-full border border-line-soft text-text-primary">
          <ArrowLeftIcon />
        </button>
      ) : (
        <Link to="/" aria-label="Voltar ao catálogo" className="grid size-[35px] place-items-center rounded-full border border-line-soft text-text-primary">
          <ArrowLeftIcon />
        </Link>
      )}
      <FavoriteButton nft={toSummary(nft)} variant="icon" className="size-[35px] border border-line-soft bg-transparent" />
    </div>
  )
}

function DetailContent({ nft, requestedEdition }: { nft: NftDetail; requestedEdition: string | undefined }) {
  const navigate = route.useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useHeadingFocus(headingRef, nft.id)
  const liveMessage = useNftUpdateMessage((id) => (id === nft.id ? nft.name : undefined))
  const edition = pickEdition(nft, requestedEdition)
  const attributes = nft.attributes.join(', ')

  return (
    <Frame>
      <Breadcrumb />
      <div className="md:mt-7 lg:flex lg:gap-8">
        <div className="max-md:-mx-6 max-md:rounded-t-[40px] max-md:bg-surface-card max-md:px-7 max-md:pt-[23px] max-md:pb-4 lg:w-[573px] lg:shrink-0">
          <BackBar nft={nft} />
          <Gallery images={nft.gallery} name={nft.name} />
        </div>

        <div className="mt-6 flex min-w-0 flex-1 flex-col gap-3 max-md:-mx-6 max-md:bg-surface-card max-md:px-6 max-md:pt-2 md:mt-6 md:gap-5 lg:mt-0">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 ref={headingRef} tabIndex={-1} className="text-body-lg leading-7 font-bold text-text-primary outline-none md:text-[28px] md:leading-[37px]">
                {nft.name}
              </h1>
              <p className="flex h-[27px] shrink-0 items-center gap-1.5 rounded-full border border-primary px-3 text-caption-sm font-bold text-text-accent md:hidden">
                <StarIcon />
                <span className="sr-only">Avaliação </span>
                {nft.rating.average}
                <span className="font-normal">({nft.rating.count})</span>
              </p>
            </div>
            <div className="mt-3 hidden items-center justify-between gap-4 border-b border-line pb-4 md:flex">
              <NftPrice price={edition.price} compareAtPrice={edition.compareAtPrice} className="text-body-lg" />
              <p className="flex items-center gap-1 text-body-sm text-text-secondary">
                <StarRating value={nft.rating.average} label={`Avaliação ${nft.rating.average} de 5`} />
                <span>{nft.rating.count} avaliações de colecionadores</span>
              </p>
            </div>
            <p role="status" data-testid="nft-live-updates" className={cn('text-caption-sm text-text-accent max-md:sr-only md:mt-2 md:min-h-5')}>
              {liveMessage}
            </p>
          </div>

          <div>
            <h2 className="text-body-sm font-bold text-text-primary">Sobre este NFT:</h2>
            <p className="mt-2 text-body-sm leading-[22px] text-text-secondary">{nft.description}</p>
          </div>

          <EditionChips editions={nft.editions} selectedId={edition.id} onSelect={(id) => void navigate({ search: (prev) => ({ ...prev, edition: id }), replace: true })} />

          <ul className="flex flex-col gap-3 text-body-sm text-text-secondary md:order-2">
            <li>ID do token: {nft.tokenId}</li>
            <li>Coleção: {nft.collection.name}</li>
            <li>Atributos: {attributes}</li>
          </ul>

          <PurchasePanel key={nft.id} nft={nft} edition={edition} />

          <div className="flex items-center gap-2 text-caption-sm font-bold text-text-primary max-md:hidden md:order-3">
            <span>Compartilhar este NFT:</span>
            {shareLinks(nft.name).map((link) => (
              <a
                key={link.label}
                href={link.href}
                aria-label={link.label}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="grid size-6 place-items-center hover:text-text-accent"
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 md:mt-[96px]">
        <DetailTabs nft={nft} />
      </div>
      <RelatedNfts collectionId={nft.collection.id} excludeId={nft.id} />
    </Frame>
  )
}

export function NftDetailPage() {
  const { id } = route.useParams()
  const { edition } = route.useSearch()
  const query = useQuery(nftQueries.detail(id))

  if (query.isPending) return <DetailSkeleton />

  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.is('NOT_FOUND')
    if (notFound) {
      return (
        <PageFrame title="NFT não encontrado" eyebrow="Erro 404">
          <p className="text-body text-text-secondary">Este NFT não existe ou foi removido do catálogo.</p>
          <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
            <Link to="/" hash="mercado">
              Explorar o mercado
            </Link>
          </Button>
        </PageFrame>
      )
    }
    return (
      <PageFrame title="Não foi possível carregar o NFT" eyebrow="Erro">
        <p role="alert" className="text-body text-text-secondary">
          {errorMessageOf(query.error)}
        </p>
        <Button onClick={() => void query.refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
          Tentar novamente
        </Button>
      </PageFrame>
    )
  }

  return <DetailContent nft={query.data} requestedEdition={edition} />
}
