/**
 * Perfil do colecionador (Figma 9:1238): data form, avatar and password change. Server state through
 * `useProfile` (private query + keepNewest); writes carry the profile `version` and a 409
 * CONFLICT_VERSION is handled with an explicit "reload and confirm again" flow.
 */
import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AVATAR_MIME_TYPES,
  avatarFileSchema,
  changePasswordRequestSchema,
  displayNameSchema,
  emailSchema,
  ensNameSchema,
  isApiError,
  usernameSchema,
  type ChangePasswordRequest,
  type Profile,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyApiError, rootMessage } from '@/features/forms/apiErrors'
import { controlClass, Field } from '@/features/forms/Field'
import { PasswordInput } from '@/features/forms/PasswordInput'
import { errorMessageOf } from '@/components/layout/PageStates'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/queries/account'
import { AccountLayout, FormSkeleton, LoadError } from './AccountLayout'
import { Avatar } from './avatar'

const ENS_SUFFIX = '.eth'

/** The Figma splits the ENS name into an input and a fixed ".eth" selector; the contract stores the full name. */
const ensLabelSchema = z.string().superRefine((label, ctx) => {
  const parsed = ensNameSchema.safeParse(`${label}${ENS_SUFFIX}`)
  if (!parsed.success) ctx.addIssue({ code: 'custom', message: parsed.error.issues[0]?.message ?? 'Nome ENS inválido' })
})

const profileFormSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  ensLabel: ensLabelSchema,
  walletAlias: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
})
type ProfileFormValues = z.infer<typeof profileFormSchema>
const PROFILE_FIELDS = ['displayName', 'username', 'email', 'ensLabel', 'walletAlias'] as const

const toFormValues = (p: Profile): ProfileFormValues => ({
  displayName: p.displayName,
  username: p.username,
  email: p.email,
  ensLabel: p.ensName.endsWith(ENS_SUFFIX) ? p.ensName.slice(0, -ENS_SUFFIX.length) : p.ensName,
  walletAlias: p.walletAlias,
})

export function ProfilePage() {
  const profile = useProfile()
  return (
    <AccountLayout title="Perfil do colecionador">
      {profile.isPending ? (
        <FormSkeleton rows={6} />
      ) : profile.isError ? (
        <LoadError message={errorMessageOf(profile.error)} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
      ) : (
        <>
          <p role="status" className="mb-4 min-h-4 text-caption-sm text-text-secondary">
            {profile.isFetching ? 'Atualizando dados…' : ''}
          </p>
          <ProfileDataForm profile={profile.data} />
          <PasswordForm />
        </>
      )}
    </AccountLayout>
  )
}

function ProfileDataForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: toFormValues(profile),
    // A background refetch refreshes untouched fields but never overwrites what the user is typing.
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    setSaved(false)
    try {
      await update.mutateAsync({
        displayName: v.displayName,
        username: v.username,
        email: v.email,
        ensName: `${v.ensLabel}${ENS_SUFFIX}`,
        walletAlias: v.walletAlias,
        version: profile.version,
      })
      setConflict(false)
      setSaved(true)
    } catch (e) {
      if (isApiError(e) && e.is('CONFLICT_VERSION')) setConflict(true)
      else {
        applyApiError(e, form.setError, PROFILE_FIELDS, { ensName: 'ensLabel' })
        const first = PROFILE_FIELDS.find((f) => form.getFieldState(f).error)
        if (first) form.setFocus(first)
      }
    }
  })

  const discard = () => {
    form.reset(toFormValues(profile))
    setConflict(false)
  }
  const serverError = rootMessage(errors)

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Dados do perfil" className="grid gap-x-7 gap-y-7 md:grid-cols-2" onChange={() => setSaved(false)}>
      {conflict && (
        <div role="alert" className="rounded-control border border-primary bg-surface-dark p-4 text-body-sm text-text-primary md:col-span-2">
          <p className="font-bold">Seus dados mudaram em outro lugar.</p>
          <p className="mt-1 text-text-secondary">
            Carregamos a versão mais recente (v{profile.version}). Revise e confirme para salvar suas alterações sobre ela, ou descarte as suas.
          </p>
          <Button type="button" variant="outline" onClick={discard} className="mt-3 h-9 rounded-control border-primary px-4 text-body-sm">
            Descartar minhas alterações
          </Button>
        </div>
      )}
      {serverError && (
        <p role="alert" className="rounded-control border border-destructive px-3 py-2 text-caption-sm text-destructive md:col-span-2">
          {serverError}
        </p>
      )}
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(c) => <Input {...c} {...form.register('displayName')} autoComplete="name" className={controlClass} />}
      </Field>
      <Field label="Nome de usuário" required error={errors.username?.message}>
        {(c) => <Input {...c} {...form.register('username')} autoComplete="username" className={controlClass} />}
      </Field>
      <Field label="E-mail" required error={errors.email?.message}>
        {(c) => <Input {...c} {...form.register('email')} type="email" autoComplete="email" className={controlClass} />}
      </Field>
      <Field label="Nome ENS" required error={errors.ensLabel?.message}>
        {(c) => (
          <div className="flex gap-2">
            <span className="grid h-10 w-[78px] shrink-0 place-items-center rounded-control border border-line-soft text-body-sm text-text-primary" aria-hidden="true">
              {ENS_SUFFIX}
            </span>
            <Input {...c} {...form.register('ensLabel')} autoCapitalize="none" spellCheck={false} aria-label="Nome ENS (sem .eth)" className={controlClass} />
          </div>
        )}
      </Field>
      <Field label="Apelido da carteira" required error={errors.walletAlias?.message}>
        {(c) => <Input {...c} {...form.register('walletAlias')} className={controlClass} />}
      </Field>
      <AvatarControl profile={profile} />
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <Button type="submit" disabled={form.formState.isSubmitting || (conflict && update.isPending)} className="h-10 rounded-control px-6 text-body-sm font-bold">
          {form.formState.isSubmitting ? 'Salvando…' : conflict ? 'Confirmar e salvar' : 'Salvar'}
        </Button>
        <p role="status" className="text-caption-sm text-text-accent">
          {saved ? 'Dados do perfil salvos.' : ''}
        </p>
      </div>
    </form>
  )
}

function AvatarControl({ profile }: { profile: Profile }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const busy = upload.isPending || remove.isPending
  const errorId = 'avatar-feedback'

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = avatarFileSchema.safeParse(file)
    if (!parsed.success) {
      setMessage({ kind: 'error', text: parsed.error.issues[0]?.message ?? 'Arquivo inválido' })
      return
    }
    setMessage(null)
    try {
      await upload.mutateAsync(file)
      setMessage({ kind: 'ok', text: 'Avatar atualizado.' })
    } catch (e) {
      const fe = isApiError(e) ? e.fieldErrors?.file?.[0] : undefined
      setMessage({ kind: 'error', text: fe ?? errorMessageOf(e) })
    }
  }
  const onRemove = async () => {
    setMessage(null)
    try {
      await remove.mutateAsync(undefined)
      setMessage({ kind: 'ok', text: 'Avatar removido.' })
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessageOf(e) })
    }
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby="avatar-label" aria-describedby={errorId}>
      <span id="avatar-label" className="text-body-sm leading-4 text-text-primary">
        Avatar
      </span>
      <div className="flex items-center gap-5">
        <Avatar url={profile.avatarUrl} name={profile.displayName} className="size-[50px]" />
        <input
          ref={input}
          type="file"
          hidden
          accept={AVATAR_MIME_TYPES.join(',')}
          aria-label="Selecionar imagem do avatar"
          data-testid="avatar-input"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" disabled={busy} onClick={() => input.current?.click()} className="h-10 rounded-control px-6 text-body-sm font-bold">
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <button
          type="button"
          disabled={busy || !profile.avatarUrl}
          onClick={() => void onRemove()}
          className="rounded-control px-1 text-body-sm text-text-primary hover:text-text-accent disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      <p id={errorId} role={message?.kind === 'error' ? 'alert' : 'status'} className={message?.kind === 'error' ? 'text-caption-sm text-destructive' : 'text-caption-sm text-text-accent'}>
        {message?.text ?? ''}
      </p>
    </div>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const [done, setDone] = useState(false)
  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const fields = ['currentPassword', 'newPassword', 'confirmPassword'] as const

  const onSubmit = form.handleSubmit(async (v) => {
    setDone(false)
    try {
      await change.mutateAsync(v)
      form.reset()
      setDone(true)
    } catch (e) {
      applyApiError(e, form.setError, fields)
      const first = fields.find((f) => form.getFieldState(f).error)
      if (first) form.setFocus(first)
    }
  })
  const serverError = rootMessage(errors)

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="password-title" className="mt-10 grid max-w-[417px] gap-7" onChange={() => setDone(false)}>
      <h2 id="password-title" className="text-body-md font-bold text-text-primary">
        Alterar senha
      </h2>
      {serverError && (
        <p role="alert" className="rounded-control border border-destructive px-3 py-2 text-caption-sm text-destructive">
          {serverError}
        </p>
      )}
      <Field label="Senha atual" error={errors.currentPassword?.message}>
        {(c) => <PasswordInput {...c} {...form.register('currentPassword')} autoComplete="current-password" />}
      </Field>
      <Field label="Nova senha" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letra e número.">
        {(c) => <PasswordInput {...c} {...form.register('newPassword')} autoComplete="new-password" />}
      </Field>
      <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
        {(c) => <PasswordInput {...c} {...form.register('confirmPassword')} autoComplete="new-password" />}
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={form.formState.isSubmitting} className="h-10 rounded-control px-6 text-body-sm font-bold">
          {form.formState.isSubmitting ? 'Alterando…' : 'Alterar senha'}
        </Button>
        <p role="status" className="text-caption-sm text-text-accent">
          {done ? 'Senha alterada.' : ''}
        </p>
      </div>
    </form>
  )
}
