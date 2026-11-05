/**
 * Shell of the account area (profile and wallets). Figma: 310 px "Meu perfil" side menu + form column
 * (x = 458 at 1440). Below `md` the menu becomes a horizontal list above the content (no mobile frame).
 * Items outside the challenge scope lead to `/em-breve` (ARCHITECTURE §12).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, type LinkProps } from '@tanstack/react-router'
import { Bell, ChevronDown, Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingBag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { hasClientNavigated } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useLogout } from '@/session/hooks'

const item =
  'flex items-center gap-3 border-l-[6px] border-transparent px-[10px] py-[10px] text-body-sm text-text-accent transition-colors hover:bg-surface-dark data-[status=active]:border-primary data-[status=active]:bg-surface-dark'

type Item = { label: string; icon: typeof User; link: Pick<LinkProps, 'to' | 'search'> }
const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: User, link: { to: '/profile' } },
  { label: 'Carteiras', icon: MapPin, link: { to: '/wallets' } },
  { label: 'Atividade', icon: ShoppingBag, link: { to: '/em-breve', search: { secao: 'atividade' } } },
  { label: 'Lista de interesse', icon: Heart, link: { to: '/favorites' } },
  { label: 'Ofertas', icon: Bell, link: { to: '/em-breve', search: { secao: 'ofertas' } } },
  { label: 'Arquivos baixados', icon: Download, link: { to: '/em-breve', search: { secao: 'arquivos' } } },
  { label: 'Suporte', icon: LifeBuoy, link: { to: '/em-breve', search: { secao: 'suporte' } } },
]

const TABS = ITEMS.slice(0, 2)
const MORE = ITEMS.slice(2)
const tab =
  'flex min-h-11 items-center justify-center gap-2 border-b-[3px] border-transparent px-3 text-body-sm text-text-accent data-[status=active]:border-primary data-[status=active]:bg-surface-dark'

const isCurrent = (link: Item['link'], pathname: string, search: Record<string, unknown>) =>
  pathname === link.to && (!link.search || (link.search as { secao?: string }).secao === search.secao)

/** Below `md`: two tabs + "Mais" menu in a single row (the full list wrapped over several lines). */
function CompactMenu({ logout, isPending }: { logout: () => unknown; isPending: boolean }) {
  const { pathname, search } = useLocation()
  const moreActive = MORE.some(({ link }) => isCurrent(link, pathname, search as Record<string, unknown>))
  return (
    <div className="flex items-stretch md:hidden">
      {TABS.map(({ label, link }) => (
        <Link key={label} {...link} className={cn(tab, 'flex-1')} activeOptions={{ exact: true }}>
          {label}
        </Link>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(tab, 'cursor-pointer', moreActive && 'border-primary bg-surface-dark font-bold')}>
          Mais
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {MORE.map(({ label, icon: Icon, link }) => (
            <DropdownMenuItem key={label} asChild className="min-h-11">
              <Link {...link} aria-current={isCurrent(link, pathname, search as Record<string, unknown>) ? 'page' : undefined}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11 font-bold" disabled={isPending} onSelect={() => void logout()}>
            <LogOut aria-hidden="true" className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AccountLayout({ title, children }: { title: string; children: ReactNode }) {
  const { logout, isPending } = useLogout()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (hasClientNavigated()) headingRef.current?.focus({ preventScroll: true })
  }, [title])
  return (
    <div className="mx-auto grid w-full max-w-page gap-6 px-gutter pt-6 pb-16 md:grid-cols-[minmax(0,310px)_minmax(0,1fr)] md:gap-7 md:pt-8 xl:px-0">
      <nav aria-label="Minha conta" className="self-start bg-surface-card pb-0 md:pb-1">
        <p className="px-[10px] py-3 text-body-lg font-bold text-text-primary max-md:hidden">Meu perfil</p>
        <CompactMenu logout={logout} isPending={isPending} />
        <ul className="flex flex-col max-md:hidden">
          {ITEMS.map(({ label, icon: Icon, link }) => (
            <li key={label}>
              <Link {...link} className={item} activeOptions={{ exact: true }}>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-line">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void logout()}
              className={cn(item, 'cursor-pointer font-bold disabled:opacity-60 w-full')}
            >
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <h1 ref={headingRef} tabIndex={-1} className="mb-6 text-body-md font-bold text-text-primary outline-none">
          {title}
        </h1>
        {children}
      </div>
    </div>
  )
}

/** Error state with retry (shared by profile and wallets). */
export function LoadError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-control border border-line-soft bg-surface-card p-5">
      <p className="text-body-sm text-text-primary">{message}</p>
      <Button onClick={onRetry} disabled={retrying} className="h-10 rounded-control px-5 text-body-sm font-bold">
        {retrying ? 'Tentando…' : 'Tentar novamente'}
      </Button>
    </div>
  )
}

/** Skeleton with the exact grid of the forms (no layout shift when data arrives). */
export function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" role="status" className="grid gap-x-7 gap-y-7 lg:grid-cols-2">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div aria-hidden="true" className="skeleton-shimmer h-4 w-32 rounded-control bg-muted" />
          <div aria-hidden="true" className="skeleton-shimmer h-10 rounded-control bg-muted" />
        </div>
      ))}
    </div>
  )
}
