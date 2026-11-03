import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

// `redirect` is validated by safeRedirectSchema (same-origin relative path only).
export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Entrar — KURIO' }] }),
  component: LoginPage,
})

function LoginPage() {
  return <UnderConstruction title="Entrar" slice="S2 — Conta" />
}
