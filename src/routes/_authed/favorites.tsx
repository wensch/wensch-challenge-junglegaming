import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/nft/FavoritesPage'

export const Route = createFileRoute('/_authed/favorites')({
  head: () => ({ meta: [{ title: 'Lista de interesse — KURIO' }] }),
  component: FavoritesPage,
})
