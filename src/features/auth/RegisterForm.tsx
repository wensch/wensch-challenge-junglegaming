import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { registerRequestSchema, type ApiError, type AuthSearch, type RegisterRequest, type Session } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyApiError, rootMessage } from '@/features/forms/apiErrors'
import { controlClass, Field } from '@/features/forms/Field'
import { PasswordInput } from '@/features/forms/PasswordInput'
import { AuthShell } from './AuthShell'
import { useFinishAuth } from './useAuthSubmit'

const FIELDS = ['username', 'email', 'password', 'confirmPassword'] as const

export function RegisterForm({ search }: { search: AuthSearch }) {
  const { finish, isPending: finishing } = useFinishAuth(search.redirect)
  const form = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const register = useMutation<Session, ApiError, RegisterRequest>({ mutationFn: (body) => authApi.register(body) })

  // EMAIL_TAKEN (409) and VALIDATION (422) carry `fieldErrors` keyed by the body fields -> the fields.
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await finish(await register.mutateAsync(values))
    } catch (e) {
      applyApiError(e, form.setError, FIELDS)
      const first = FIELDS.find((f) => form.getFieldState(f).error)
      if (first) form.setFocus(first)
    }
  })
  const busy = form.formState.isSubmitting || finishing
  const serverError = rootMessage(errors)

  return (
    <AuthShell mode="register" search={search} description="Crie seu perfil de colecionador e conecte uma carteira quando quiser.">
      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="flex flex-col gap-4">
        {serverError && (
          <p role="alert" className="rounded-control border border-destructive px-3 py-2 text-caption-sm text-destructive">
            {serverError}
          </p>
        )}
        <Field label="Nome de usuário" srOnlyLabel error={errors.username?.message}>
          {(c) => <Input {...c} {...form.register('username')} autoComplete="username" placeholder="Nome de usuário" className={controlClass} />}
        </Field>
        <Field label="E-mail" srOnlyLabel error={errors.email?.message}>
          {(c) => <Input {...c} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={controlClass} />}
        </Field>
        <Field label="Senha" srOnlyLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letra e número.">
          {(c) => <PasswordInput {...c} {...form.register('password')} autoComplete="new-password" placeholder="Senha" />}
        </Field>
        <Field label="Confirmar senha" srOnlyLabel error={errors.confirmPassword?.message}>
          {(c) => <PasswordInput {...c} {...form.register('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" />}
        </Field>
        <Button type="submit" disabled={busy} className="mt-2 h-12 rounded-control text-body-md font-bold max-md:h-[60px] max-md:rounded-xl">
          {busy ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </AuthShell>
  )
}
