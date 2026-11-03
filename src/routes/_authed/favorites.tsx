import { createFileRoute } from '@tanstack/react-router'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/_authed/favorites')({
  head: () => ({ meta: [{ title: 'Lista de interesse — KURIO' }] }),
  component: FavoritesPage,
})

function FavoritesPage() {
  return <UnderConstruction title="Lista de interesse" slice="S1 — Catálogo" />
}
