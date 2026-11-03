import { createFileRoute } from '@tanstack/react-router'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/_authed/profile')({
  head: () => ({ meta: [{ title: 'Perfil do colecionador — KURIO' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return <UnderConstruction title="Perfil do colecionador" slice="S2 — Conta" />
}
