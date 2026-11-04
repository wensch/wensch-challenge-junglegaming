/**
 * Favorite toggle (FAV-1). Visitors are sent to the login with a return path; logged users toggle
 * optimistically (`useToggleFavorite`). Used as a round icon on mobile cards/detail and as the
 * "Favoritar" button of the desktop detail.
 */
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFavoriteState, useToggleFavorite } from '@/queries/favorites'

interface FavoriteButtonProps {
  nft: NftSummary
  variant: 'icon' | 'button'
  className?: string
}

export function FavoriteButton({ nft, variant, className }: FavoriteButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { owner, ready, isFavorite } = useFavoriteState()
  const toggle = useToggleFavorite(owner ? `${owner.userId}:${nft.id}` : nft.id)
  const active = isFavorite(nft.id)

  const onClick = () => {
    if (!owner) {
      void navigate({ to: '/login', search: { redirect: location.href, reason: 'required' } })
      return
    }
    toggle.mutate({ nft, favorited: !active, owner })
  }

  // Logged users wait for the list (membership unknown); visitors can always click (login prompt).
  const disabled = owner !== null && !ready
  const common = { type: 'button' as const, onClick, disabled, 'aria-pressed': owner ? active : false }

  if (variant === 'icon') {
    return (
      <button
        {...common}
        aria-label={`Favoritar ${nft.name}`}
        className={cn(
          'grid size-7 place-items-center rounded-full bg-surface-dark/90 text-text-accent transition-colors hover:bg-surface-dark disabled:opacity-60',
          className,
        )}
      >
        <Heart aria-hidden="true" className="size-4" fill={active ? 'currentColor' : 'none'} strokeWidth={1.75} />
      </button>
    )
  }
  return (
    <Button
      {...common}
      variant="outline"
      className={cn('h-10 w-[130px] gap-2 rounded-control border-primary bg-transparent px-0 text-body-md font-medium text-text-primary hover:bg-surface-dark', className)}
    >
      <Heart aria-hidden="true" className="size-5" fill={active ? 'currentColor' : 'none'} strokeWidth={1.75} />
      Favoritar
    </Button>
  )
}
