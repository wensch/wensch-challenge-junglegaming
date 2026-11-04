import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/profile/ProfilePage'

export const Route = createFileRoute('/_authed/profile')({
  head: () => ({ meta: [{ title: 'Perfil do colecionador — KURIO' }] }),
  component: ProfilePage,
})
