/**
 * Desktop/tablet header (Figma "Header With Divider", 1200x45 at y=24 of every desktop frame).
 * KURIO | Início · Mercado · Criadores · Aprenda | busca · carrinho (badge) · Entrar / conta.
 * Below `md` the header is replaced by the mobile tab bar (MobileTabBar), as in the mobile frames.
 *
 * Layout (D6, ARCHITECTURE §13): from `xl` (1200 px column) the nav sits where the Figma puts it
 * (x = 376 px inside the column, i.e. "Início" at x = 496 in the 1440 frame). Below `xl` the nav is
 * in the flex flow between logo and actions (`flex-1`, centered in the free space), so it can never
 * overlap the search/cart/account group at tablet widths.
 */
import { lazy, Suspense, type ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { CartIcon, LogoutIcon, UserIcon, type IconProps } from '@/components/icons/figma'
import { Button } from '@/components/ui/button'
import { HeaderSearchBar, HeaderSearchTrigger, useHeaderSearch } from '@/features/catalog/HeaderSearch'
import { useCart } from '@/queries/cart'
import { useSession } from '@/queries/session'
import { cn } from '@/lib/utils'
import { accountButtonClass } from './header-styles'

// The account menu (DropdownMenu) is only needed for logged users: loaded on demand.
const AccountDropdown = lazy(() => import('./AccountDropdown'))

export function CartBadgeIcon({ className, icon: Glyph = CartIcon }: { className?: string; icon?: ComponentType<IconProps> }) {
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  return (
    <span className={cn('relative inline-flex', className)}>
      <Glyph />
      {count > 0 && (
        <span
          key={count}
          aria-hidden="true"
          className="animate-pop absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-micro font-bold text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  )
}

export function cartLabel(count: number) {
  return count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'
}

const navLink =
  'relative flex h-full items-start pt-0.5 text-body-md font-normal whitespace-nowrap text-text-primary transition-colors hover:text-text-accent after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-primary after:opacity-0 data-[status=active]:font-bold data-[status=active]:text-text-accent data-[status=active]:after:opacity-100'

function AccountMenu() {
  const session = useSession()

  if (session.isPending) return <span aria-hidden="true" className="inline-block h-[35px] w-[100px]" />

  if (!session.data) {
    return (
      <Button asChild className="h-[35px] w-[100px] gap-1.5 rounded-control px-2.5 text-body-md font-medium">
        <Link to="/login">
          <LogoutIcon />
          Entrar
        </Link>
      </Button>
    )
  }

  const { user } = session.data
  return (
    <Suspense
      fallback={
        // Same box as the trigger while its chunk loads (no layout shift, not interactive yet).
        <span aria-hidden="true" className={cn('inline-flex items-center rounded-control border px-2.5', accountButtonClass)}>
          <UserIcon />
          <span className="truncate">{user.displayName}</span>
        </span>
      }
    >
      <AccountDropdown user={user} />
    </Suspense>
  )
}

export function SiteHeader() {
  const cart = useCart()
  const { open, toggle, close, triggerRef } = useHeaderSearch()
  return (
    <header className="hidden md:block">
      <div className="mx-auto w-full max-w-page px-gutter pt-6 xl:px-0">
        <div className="relative flex h-header items-start gap-4 border-b border-line">
          <Link to="/" className="flex h-[35px] shrink-0 items-center text-body-sm font-bold tracking-figma text-text-primary">
            KURIO<span className="sr-only"> — página inicial</span>
          </Link>

          <nav aria-label="Principal" className="flex h-full min-w-0 flex-1 justify-center xl:absolute xl:inset-y-0 xl:left-[376px] xl:flex-none">
            <ul className="flex h-full gap-4 lg:gap-10">
              <li>
                <Link to="/" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={navLink}>
                  Início
                </Link>
              </li>
              <li>
                <Link to="/" hash="mercado" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={navLink}>
                  Mercado
                </Link>
              </li>
              <li>
                <Link to="/em-breve" search={{ secao: 'criadores' }} className={navLink}>
                  Criadores
                </Link>
              </li>
              <li>
                <Link to="/em-breve" search={{ secao: 'aprenda' }} className={navLink}>
                  Aprenda
                </Link>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex h-[35px] shrink-0 items-center gap-4 lg:gap-6">
            <HeaderSearchTrigger open={open} onToggle={toggle} triggerRef={triggerRef} />
            <Link to="/cart" aria-label={cartLabel(cart.data?.itemCount ?? 0)} className="grid size-9 place-items-center rounded-control text-text-primary hover:text-text-accent">
              <CartBadgeIcon />
            </Link>
            <AccountMenu />
          </div>
        </div>
      </div>
      <HeaderSearchBar open={open} close={close} />
    </header>
  )
}
