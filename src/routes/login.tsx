import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema } from '@/api/contracts'
import { LoginForm } from '@/features/auth/LoginForm'

// `redirect` is validated by safeRedirectSchema (same-origin relative path only).
export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Entrar — KURIO' }] }),
  component: LoginPage,
})

function LoginPage() {
  return <LoginForm search={Route.useSearch()} />
}
