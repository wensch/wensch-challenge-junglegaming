import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { isApiError, loginRequestSchema, type ApiError, type AuthSearch, type LoginRequest, type Session } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyApiError, rootMessage } from '@/features/forms/apiErrors'
import { controlClass, Field } from '@/features/forms/Field'
import { PasswordInput } from '@/features/forms/PasswordInput'
import { AuthShell } from './AuthShell'
import { useFinishAuth } from './useAuthSubmit'

const FIELDS = ['email', 'password'] as const

export function LoginForm({ search }: { search: AuthSearch }) {
  const { finish, isPending: finishing } = useFinishAuth(search.redirect)
  const form = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema), defaultValues: { email: '', password: '' }, mode: 'onTouched' })
  const { errors } = form.formState
  const login = useMutation<Session, ApiError, LoginRequest>({ mutationFn: (body) => authApi.login(body) })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await finish(await login.mutateAsync(values))
    } catch (e) {
      if (isApiError(e) && e.is('UNAUTHENTICATED')) form.setError('root.server', { type: 'server', message: 'E-mail ou senha incorretos.' })
      else applyApiError(e, form.setError, FIELDS)
    }
  })
  const busy = form.formState.isSubmitting || finishing
  const serverError = rootMessage(errors)

  return (
    <AuthShell mode="login" search={search} description="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="flex flex-col gap-4">
        {serverError && (
          <p role="alert" className="rounded-control border border-destructive px-3 py-2 text-caption-sm text-destructive">
            {serverError}
          </p>
        )}
        <Field label="E-mail" srOnlyLabel error={errors.email?.message}>
          {(c) => <Input {...c} {...form.register('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={controlClass} />}
        </Field>
        <Field label="Senha" srOnlyLabel error={errors.password?.message}>
          {(c) => <PasswordInput {...c} {...form.register('password')} autoComplete="current-password" placeholder="Senha" />}
        </Field>
        <Link
          to="/em-breve"
          search={{ secao: 'recuperar-senha' }}
          className="-mt-1 self-end text-caption-sm text-text-accent underline-offset-4 hover:underline"
        >
          Esqueceu a senha?
        </Link>
        <Button type="submit" disabled={busy} className="h-12 rounded-control text-body-md font-bold max-md:h-[60px] max-md:rounded-xl">
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
