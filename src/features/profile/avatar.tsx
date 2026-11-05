/**
 * Avatar rendering. The CSP only allows `img-src 'self' data: blob:`, while the contract also
 * accepts `https:` avatars. The UI renders an image only for sources the CSP lets through (inline
 * raster `data:` or a same-origin path); anything else falls back to the initials, never a broken image.
 */
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

export function renderableAvatarSrc(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('data:image/') || (url.startsWith('/') && !url.startsWith('//')) ? url : null
}

export function Avatar({ url, name, className, decorative }: { url: string | null | undefined; name: string; className?: string; decorative?: boolean }) {
  const src = renderableAvatarSrc(url)
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full border border-line-soft bg-surface-card text-text-accent', className)}
    >
      {src ? <img src={src} alt={decorative ? '' : `Avatar de ${name}`} className="size-full object-cover" /> : <UserRound aria-hidden="true" className="size-1/2" />}
    </span>
  )
}
