/**
 * Account menu of the logged user (header, md+). Loaded on demand by SiteHeader: visitors never
 * download the DropdownMenu code (ARCHITECTURE §12, bundle).
 */
import { Link } from '@tanstack/react-router'
import { HeartIcon, LocationIcon, LogoutIcon, UserIcon } from '@/components/icons/figma'
import type { User as SessionUser } from '@/api/contracts'
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
import { Avatar, renderableAvatarSrc } from '@/features/profile/avatar'
import { useLogout } from '@/session/hooks'
import { accountButtonClass } from './header-styles'

export default function AccountDropdown({ user }: { user: SessionUser }) {
  const { logout, isPending } = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={accountButtonClass}>
          {renderableAvatarSrc(user.avatarUrl) ? (
            <Avatar decorative url={user.avatarUrl} name={user.displayName} className="size-5" />
          ) : (
            <UserIcon />
          )}
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
              <UserIcon /> Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/wallets">
              <LocationIcon /> Carteiras
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/favorites">
              <HeartIcon /> Lista de interesse
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isPending} onSelect={() => void logout()}>
          <LogoutIcon /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
