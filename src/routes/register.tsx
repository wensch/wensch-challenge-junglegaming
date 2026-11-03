import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/register')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Criar conta — KURIO' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  return <UnderConstruction title="Criar conta" slice="S2 — Conta" />
}
