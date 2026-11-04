import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/wallets/WalletsPage'

export const Route = createFileRoute('/_authed/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras — KURIO' }] }),
  component: WalletsPage,
})
