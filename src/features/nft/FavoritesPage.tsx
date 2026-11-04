/**
 * "Lista de interesse" (`/favorites`, FAV-1). No Figma frame: composed from the catalog card and the
 * page tokens (ARCHITECTURE §13, D40). Data: `GET /favorites` (`useFavorites`, private key).
 * States: loading (skeleton with the card boxes), empty (call to the catalog), error with retry,
 * success, background refetch (`aria-busy`). Removing is optimistic with rollback (`useToggleFavorite`);
 * the count is announced in a `role="status"` region and the failure by the toast region.
 */
import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessageOf } from '@/components/layout/PageStates'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { useFavorites, useToggleFavorite, type UserOwner } from '@/queries/favorites'
import { NftCard, NftCardSkeleton } from './NftCard'

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-[34px] md:gap-y-12 lg:grid-cols-4 max-md:[&>li:nth-child(even)]:mt-8'
const STATE_MIN_HEIGHT = 'min-h-[320px] md:min-h-[420px]'

function FavoriteItem({ nft, owner, onRemoved }: { nft: NftSummary; owner: UserOwner; onRemoved: () => void }) {
  const toggle = useToggleFavorite(`${owner.userId}:${nft.id}`)
  return (
    <li data-testid="favorite-item">
      <NftCard nft={nft} />
      <Button
        type="button"
        variant="outline"
        aria-label={`Remover ${nft.name} da lista de interesse`}
        onClick={() => {
          toggle.mutate({ nft, favorited: false, owner })
          onRemoved()
        }}
        className="mt-3 h-9 w-full rounded-control border-line-soft bg-transparent text-body-sm font-medium text-text-primary hover:bg-surface-dark"
      >
        Remover
      </Button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <ul className={GRID} aria-busy="true" aria-label="Carregando lista de interesse" data-testid="favorites-skeleton">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <NftCardSkeleton />
          <Skeleton className="mt-3 h-9 w-full" />
        </li>
      ))}
    </ul>
  )
}

function StateMessage({ title, role, children }: { title: string; role?: 'alert'; children: React.ReactNode }) {
  return (
    <div role={role} className={`flex flex-col items-center justify-center gap-4 rounded-card bg-surface-card px-6 py-12 text-center ${STATE_MIN_HEIGHT}`}>
      <h2 className="text-heading font-bold text-text-primary">{title}</h2>
      {children}
    </div>
  )
}

export function FavoritesPage() {
  const { data, owner, isPending, isError, isFetching, error, refetch } = useFavorites()
  const headingRef = usePageHeadingFocus()
  const items = data?.items ?? []
  const count = `${items.length} ${items.length === 1 ? 'NFT' : 'NFTs'} na lista de interesse.`

  let body: React.ReactNode
  if (isPending || !owner) {
    body = <ListSkeleton />
  } else if (isError && !data) {
    body = (
      <StateMessage title="Não foi possível carregar a lista de interesse" role="alert">
        <p className="max-w-md text-body text-text-secondary">{errorMessageOf(error)}</p>
        <Button onClick={() => void refetch()} className="h-10 rounded-control px-5 text-body-md font-bold">
          Tentar novamente
        </Button>
      </StateMessage>
    )
  } else if (items.length === 0) {
    body = (
      <StateMessage title="Sua lista de interesse está vazia">
        <p className="max-w-md text-body text-text-secondary">Toque no coração de um NFT para guardá-lo aqui e acompanhar preço e disponibilidade.</p>
        <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
          <Link to="/" hash="mercado">
            Explorar o mercado
          </Link>
        </Button>
      </StateMessage>
    )
  } else {
    body = (
      <ul className={`${GRID} ${isFetching ? 'opacity-70' : ''}`} aria-busy={isFetching ? 'true' : undefined} aria-label="NFTs na lista de interesse" data-testid="favorites-list">
        {items.map((nft) => (
          <FavoriteItem key={nft.id} nft={nft} owner={owner} onRemoved={() => headingRef.current?.focus({ preventScroll: true })} />
        ))}
      </ul>
    )
  }

  return (
    <section className="mx-auto w-full max-w-page px-gutter pt-8 pb-16 md:pt-12 xl:px-0">
      <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-text-primary outline-none md:text-display">
        Lista de interesse
      </h1>
      <p role="status" data-testid="favorites-count" className="mt-2 mb-8 min-h-[22px] text-body-sm text-text-secondary">
        {data && !isError ? count : ''}
      </p>
      {body}
    </section>
  )
}
