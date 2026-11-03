/**
 * Mobile navigation (Figma "Tab Bar", node 70395:245, 414x126 at the bottom of Mobile / Início):
 * Início · Favoritos · [botão central elevado] · Carrinho · Perfil.
 * The central button opens the full menu (Sheet with focus trap, Esc, focus return) so every
 * desktop destination stays reachable below `md`. Deviation: the Figma glyph of the central
 * button is a scan icon with no defined action; it is rendered as a menu icon (ARCHITECTURE §13).
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Heart, House, LogIn, LogOut, Menu, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCart } from '@/queries/cart'
import { useSession } from '@/queries/session'
import { CartBadgeIcon, cartLabel, useLogout } from './SiteHeader'

const tab =
  'grid size-11 place-items-center rounded-full text-text-secondary transition-colors hover:text-text-accent data-[status=active]:text-primary'

const menuLink =
  'flex min-h-11 items-center gap-3 rounded-control px-3 text-body-md text-text-primary hover:bg-secondary data-[status=active]:font-bold data-[status=active]:text-text-accent'

function MobileMenu() {
  const [open, setOpen] = useState(false)
  const session = useSession()
  const logout = useLogout()
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu"
          className="absolute -top-8 left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full border-[6px] border-background bg-gradient-to-br from-text-accent to-primary text-primary-foreground shadow-lg"
        >
          <Menu aria-hidden="true" className="size-6" strokeWidth={2} />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-panel border-line bg-card px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="p-0">
          <SheetTitle className="text-body-lg font-bold tracking-figma text-text-primary">KURIO</SheetTitle>
          <SheetDescription className="text-caption text-text-secondary">Menu de navegação</SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu">
          <ul className="flex flex-col gap-1">
            <li>
              <Link to="/" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <House aria-hidden="true" className="size-5" /> Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="mercado" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <ShoppingCart aria-hidden="true" className="size-5" /> Mercado
              </Link>
            </li>
            <li>
              <Link to="/" hash="busca" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <Search aria-hidden="true" className="size-5" /> Buscar NFTs
              </Link>
            </li>
            <li>
              <Link to="/em-breve" search={{ secao: 'criadores' }} className={menuLink} onClick={close}>
                Criadores <span className="text-caption text-text-secondary">(em breve)</span>
              </Link>
            </li>
            <li>
              <Link to="/em-breve" search={{ secao: 'aprenda' }} className={menuLink} onClick={close}>
                Aprenda <span className="text-caption text-text-secondary">(em breve)</span>
              </Link>
            </li>
          </ul>
          <Separator className="my-3 bg-line" />
          <ul className="flex flex-col gap-1">
            {session.data ? (
              <>
                <li>
                  <Link to="/profile" className={menuLink} onClick={close}>
                    <User aria-hidden="true" className="size-5" /> Meu perfil
                  </Link>
                </li>
                <li>
                  <Link to="/wallets" className={menuLink} onClick={close}>
                    <Wallet aria-hidden="true" className="size-5" /> Carteiras
                  </Link>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-start gap-3 px-3 text-body-md text-text-primary"
                    onClick={() => {
                      close()
                      void logout()
                    }}
                  >
                    <LogOut aria-hidden="true" className="size-5" /> Sair
                  </Button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/login" className={menuLink} onClick={close}>
                  <LogIn aria-hidden="true" className="size-5" /> Entrar
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function MobileTabBar() {
  const cart = useCart()
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto h-tabbar max-w-[480px] rounded-t-panel bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <ul className="grid h-full grid-cols-5 items-center px-4">
          <li className="grid place-items-center">
            <Link to="/" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} aria-label="Início" className={tab}>
              <House aria-hidden="true" className="size-5" fill="currentColor" strokeWidth={1.5} />
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
              <CartBadgeIcon className="[&>svg]:size-5" />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/profile" aria-label="Perfil" className={tab}>
              <User aria-hidden="true" className="size-5" fill="currentColor" strokeWidth={1.5} />
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}
