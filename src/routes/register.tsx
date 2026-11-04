import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema } from '@/api/contracts'
import { RegisterForm } from '@/features/auth/RegisterForm'

export const Route = createFileRoute('/register')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Criar conta — KURIO' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  return <RegisterForm search={Route.useSearch()} />
}
