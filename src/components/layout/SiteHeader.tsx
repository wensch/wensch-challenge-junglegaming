/**
 * Desktop/tablet header (Figma "Header With Divider", 1200x45 at y=24 of every desktop frame).
 * KURIO | Início · Mercado · Criadores · Aprenda | busca · carrinho (badge) · Entrar / conta.
 * Below `md` the header is replaced by the mobile tab bar (MobileTabBar), as in the mobile frames.
 */
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCart } from '@/queries/cart'
import { teardownSession, useSession } from '@/queries/session'
import { cn } from '@/lib/utils'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async () => {
    await teardownSession(queryClient, 'logout')
    await navigate({ to: '/' })
  }
}

export function CartBadgeIcon({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  return (
    <span className={cn('relative inline-flex', className)}>
      <ShoppingCart aria-hidden="true" className="size-6" strokeWidth={1.75} />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-micro font-bold text-primary-foreground"
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
  'relative flex h-full items-start pt-0.5 text-body-md font-medium text-text-primary transition-colors hover:text-text-accent after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-primary after:opacity-0 data-[status=active]:font-bold data-[status=active]:text-text-accent data-[status=active]:after:opacity-100'

function AccountMenu() {
  const session = useSession()
  const logout = useLogout()

  if (session.isPending) return <span aria-hidden="true" className="inline-block h-[35px] w-[100px]" />

  if (!session.data) {
    return (
      <Button asChild className="h-[35px] w-[100px] gap-1.5 rounded-[var(--radius-control)] px-2.5 text-body-md font-medium">
        <Link to="/login">
          <LogIn aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Entrar
        </Link>
      </Button>
    )
  }

  const { user } = session.data
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-[35px] max-w-[180px] gap-1.5 rounded-[var(--radius-control)] border-primary px-2.5 text-body-sm">
          <User aria-hidden="true" className="size-5" strokeWidth={1.75} />
          <span className="truncate">{user.displayName}</span>
          <span className="sr-only">: abrir menu da conta</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <User aria-hidden="true" /> Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/wallets">
              <Wallet aria-hidden="true" /> Carteiras
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/favorites">
              <Heart aria-hidden="true" /> Lista de interesse
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader() {
  const cart = useCart()
  return (
    <header className="hidden md:block">
      <div className="mx-auto w-full max-w-page px-gutter pt-6 xl:px-0">
        <div className="relative flex h-header items-start border-b border-line">
          <Link to="/" className="flex h-[35px] items-center text-body-sm font-bold tracking-figma text-text-primary">
            KURIO<span className="sr-only"> — página inicial</span>
          </Link>

          <nav aria-label="Principal" className="absolute inset-y-0 left-1/2 -translate-x-1/2">
            <ul className="flex h-full gap-6 lg:gap-10">
              <li>
                <Link to="/" activeOptions={{ exact: true, includeHash: true }} className={navLink}>
                  Início
                </Link>
              </li>
              <li>
                <Link to="/" hash="mercado" activeOptions={{ exact: true, includeHash: true }} className={navLink}>
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

          <div className="ml-auto flex h-[35px] items-center gap-6">
            <Link to="/" hash="busca" aria-label="Buscar NFTs" className="grid size-9 place-items-center rounded-[var(--radius-control)] text-text-primary hover:text-text-accent">
              <Search aria-hidden="true" className="size-6" strokeWidth={1.75} />
            </Link>
            <Link to="/cart" aria-label={cartLabel(cart.data?.itemCount ?? 0)} className="grid size-9 place-items-center rounded-[var(--radius-control)] text-text-primary hover:text-text-accent">
              <CartBadgeIcon />
            </Link>
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
