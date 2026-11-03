import { createFileRoute } from '@tanstack/react-router'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/_authed/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras — KURIO' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  return <UnderConstruction title="Carteiras" slice="S2 — Conta" />
}
