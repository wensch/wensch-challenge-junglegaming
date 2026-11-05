/**
 * Mobile navigation (Figma "Tab Bar", node 70395:245, 414x126 at the bottom of Mobile / Início):
 * Início · Favoritos · [botão central elevado] · Carrinho · Perfil.
 * The central button opens the full menu (Sheet with focus trap, Esc, focus return) so every
 * desktop destination stays reachable below `md`. Deviation: the Figma glyph of the central
 * button is a scan icon with no defined action; it is rendered as a ScanLine glyph (the button still opens the menu) (ARCHITECTURE §13).
 * The Sheet itself is loaded on demand (first open, or prefetched on hover/focus/touch).
 */
import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { HomeIcon, ScanIcon, ShopIcon, UserIcon } from '@/components/icons/figma'
import { useCart } from '@/queries/cart'
import { CartBadgeIcon, cartLabel } from './SiteHeader'

const loadSheet = () => import('./MobileMenuSheet')
const MobileMenuSheet = lazy(loadSheet)

const tab =
  'grid size-11 place-items-center rounded-full text-text-secondary transition-colors hover:text-text-accent data-[status=active]:text-primary'

function MobileMenu() {
  const [open, setOpen] = useState(false)
  // Mounted after the first open and kept mounted, so the close animation and focus return run.
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const prefetch = () => void loadSheet()

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...(mounted ? { 'aria-controls': 'menu-mobile' } : {})}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onTouchStart={prefetch}
        onClick={() => {
          setMounted(true)
          setOpen(true)
        }}
        className="absolute -top-8 left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full border-[6px] border-background bg-gradient-to-br from-text-accent to-primary text-primary-foreground shadow-lg"
      >
        <ScanIcon />
      </button>
      {mounted && (
        <Suspense fallback={null}>
          <MobileMenuSheet open={open} onOpenChange={setOpen} returnFocusRef={triggerRef} />
        </Suspense>
      )}
    </>
  )
}

export function MobileTabBar() {
  const cart = useCart()
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto h-tabbar max-w-[480px] rounded-t-[40px] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <ul className="grid h-full grid-cols-5 items-center px-4">
          <li className="grid place-items-center">
            <Link to="/" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} aria-label="Início" className={tab}>
              <HomeIcon />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/favorites" aria-label="Favoritos" className={tab}>
              <Heart aria-hidden="true" className="size-5" fill="currentColor" strokeWidth={1.5} />
            </Link>
          </li>
          <li className="grid place-items-center">
            <MobileMenu />
          </li>
          <li className="grid place-items-center">
            <Link to="/cart" aria-label={cartLabel(cart.data?.itemCount ?? 0)} className={tab}>
              <CartBadgeIcon icon={ShopIcon} />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/profile" aria-label="Perfil" className={tab}>
              <UserIcon />
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}
