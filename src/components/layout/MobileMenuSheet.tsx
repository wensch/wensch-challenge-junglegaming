/**
 * Full mobile menu (Sheet with focus trap and Esc). Loaded on demand by MobileTabBar the first time
 * the central button is used (or hovered/focused), so the Dialog code is not in the boot bundle.
 */
import type { RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { HomeIcon, LocationIcon, LogoutIcon, SearchIcon, ShopIcon, UserIcon } from '@/components/icons/figma'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSession } from '@/queries/session'
import { useLogout } from '@/session/hooks'

const menuLink =
  'flex min-h-11 items-center gap-3 rounded-control px-3 text-body-md text-text-primary hover:bg-secondary data-[status=active]:font-bold data-[status=active]:text-text-accent'

interface MobileMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The trigger lives outside Radix (it renders before this chunk loads): focus returns to it on close. */
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export default function MobileMenuSheet({ open, onOpenChange, returnFocusRef }: MobileMenuSheetProps) {
  const session = useSession()
  const { logout, isPending } = useLogout()
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="menu-mobile"
        side="bottom"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocusRef.current?.focus()
        }}
        className="max-h-[85dvh] overflow-y-auto rounded-t-panel border-line bg-card px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-body-lg font-bold tracking-figma text-text-primary">KURIO</SheetTitle>
          <SheetDescription className="text-caption text-text-secondary">Menu de navegação</SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu">
          <ul className="flex flex-col gap-1">
            <li>
              <Link to="/" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <HomeIcon /> Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="mercado" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <ShopIcon /> Mercado
              </Link>
            </li>
            <li>
              <Link to="/" hash="busca" activeOptions={{ exact: true, includeHash: true, includeSearch: false }} className={menuLink} onClick={close}>
                <SearchIcon /> Buscar NFTs
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
                    <UserIcon /> Meu perfil
                  </Link>
                </li>
                <li>
                  <Link to="/wallets" className={menuLink} onClick={close}>
                    <LocationIcon /> Carteiras
                  </Link>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    disabled={isPending}
                    className="h-11 w-full justify-start gap-3 px-3 text-body-md text-text-primary"
                    onClick={() => {
                      close()
                      void logout()
                    }}
                  >
                    <LogoutIcon /> Sair
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
