/**
 * Wallet form (Figma 9:1670): one per slot. Validation = zod (the same rules as the contract, with the
 * address checked against the SELECTED network) + API `fieldErrors` mapped back to the fields.
 * Updates send the wallet `version`; a 409 CONFLICT_VERSION reloads the wallet and asks the user to
 * confirm again (or discard their edits).
 */
import { useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  displayNameSchema,
  emailSchema,
  ensNameSchema,
  isApiError,
  isValidAddress,
  NETWORKS,
  networkSchema,
  usernameSchema,
  walletTypeSchema,
  WALLET_TYPES,
  type CreateWalletRequest,
  type Network,
  type UpdateWalletRequest,
  type Wallet,
  type WalletSlot,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { applyApiError, rootMessage } from '@/features/forms/apiErrors'
import { EnsDomainSelect } from '@/features/forms/EnsDomainSelect'
import { controlClass, Field } from '@/features/forms/Field'
import { useSaveWallet } from '@/queries/account'
import { cn } from '@/lib/utils'

const ENS_SUFFIX = '.eth'
const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
const TYPE_LABEL: Record<(typeof WALLET_TYPES)[number], string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }

const walletFormSchema = z
  .object({
    displayName: displayNameSchema,
    label: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
    network: z.string().refine((v) => (NETWORKS as readonly string[]).includes(v), 'Selecione uma rede'),
    profileName: usernameSchema,
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    alternateAddress: z.string().trim().max(128, 'Máximo de 128 caracteres'),
    type: z.string().refine((v) => (WALLET_TYPES as readonly string[]).includes(v), 'Selecione uma carteira'),
    referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,16}$/, 'Código de indicação inválido (4 a 16 caracteres: letras, números ou hífen)'),
    email: emailSchema,
    ensLabel: z.string().superRefine((label, ctx) => {
      const r = ensNameSchema.safeParse(`${label}${ENS_SUFFIX}`)
      if (!r.success) ctx.addIssue({ code: 'custom', message: r.error.issues[0]?.message ?? 'Nome ENS inválido' })
    }),
  })
  .superRefine((v, ctx) => {
    const net = networkSchema.safeParse(v.network)
    if (net.success && v.address && !isValidAddress(net.data, v.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: net.data === 'solana' ? 'Endereço Solana inválido' : 'Endereço deve ter o formato 0x seguido de 40 caracteres hexadecimais',
      })
    }
  })
type WalletFormValues = z.infer<typeof walletFormSchema>
const FIELDS = ['displayName', 'label', 'network', 'profileName', 'address', 'alternateAddress', 'type', 'referralCode', 'email', 'ensLabel'] as const

export const BLANK_WALLET: WalletFormValues = {
  displayName: '',
  label: '',
  network: '',
  profileName: '',
  address: '',
  alternateAddress: '',
  type: '',
  referralCode: '',
  email: '',
  ensLabel: '',
}

export const walletToValues = (w: Wallet): WalletFormValues => ({
  displayName: w.displayName,
  label: w.label,
  network: w.network,
  profileName: w.profileName,
  address: w.address,
  alternateAddress: w.alternateAddress ?? '',
  type: w.type,
  referralCode: w.referralCode,
  email: w.email,
  ensLabel: w.ensName.endsWith(ENS_SUFFIX) ? w.ensName.slice(0, -ENS_SUFFIX.length) : w.ensName,
})

function toBody(v: WalletFormValues) {
  return {
    displayName: v.displayName,
    label: v.label,
    profileName: v.profileName,
    network: networkSchema.parse(v.network),
    address: v.address,
    ...(v.alternateAddress ? { alternateAddress: v.alternateAddress } : {}),
    type: walletTypeSchema.parse(v.type),
    referralCode: v.referralCode,
    email: v.email,
    ensName: `${v.ensLabel}${ENS_SUFFIX}`,
  }
}

export function WalletForm({
  slot,
  wallet,
  initial,
  title,
  firstFieldRef,
}: {
  slot: WalletSlot
  /** Existing wallet of the slot (edit) or null (create). */
  wallet: Wallet | null
  /** Values for a NEW wallet (blank, or copied from the primary one). */
  initial: WalletFormValues
  title: string
  firstFieldRef?: React.Ref<HTMLInputElement>
}) {
  const save = useSaveWallet()
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const uid = useId()
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    values: wallet ? walletToValues(wallet) : initial,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    setSaved(false)
    try {
      const body = toBody(v)
      if (wallet) {
        const update: UpdateWalletRequest = { ...body, version: wallet.version }
        await save.mutateAsync({ mode: 'update', walletId: wallet.id, body: update })
      } else {
        const create: CreateWalletRequest = { slot, ...body }
        await save.mutateAsync({ mode: 'create', body: create })
      }
      setConflict(false)
      setSaved(true)
    } catch (e) {
      if (isApiError(e) && e.is('CONFLICT_VERSION')) setConflict(true)
      else {
        applyApiError(e, form.setError, FIELDS, { ensName: 'ensLabel' })
        const first = FIELDS.find((f) => form.getFieldState(f).error)
        if (first && first !== 'network' && first !== 'type') form.setFocus(first)
      }
    }
  })
  const serverError = rootMessage(errors)
  const trigger = 'h-10 w-full rounded-control border-line-soft px-3 text-body-sm text-text-primary data-placeholder:text-text-secondary/80'

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={title}
      className="grid gap-x-7 gap-y-5 lg:grid-cols-2 lg:gap-y-7"
      onChange={() => setSaved(false)}
      data-testid={`wallet-form-${slot}`}
    >
      {conflict && (
        <div role="alert" className="rounded-control border border-primary bg-surface-dark p-4 text-body-sm text-text-primary lg:col-span-2">
          <p className="font-bold">Esta carteira mudou em outro lugar.</p>
          <p className="mt-1 text-text-secondary">
            Carregamos a versão mais recente{wallet ? ` (v${wallet.version})` : ''}. Revise e confirme para salvar suas alterações sobre ela, ou descarte as suas.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (wallet) form.reset(walletToValues(wallet))
              setConflict(false)
            }}
            className="mt-3 h-9 rounded-control border-primary px-4 text-body-sm"
          >
            Descartar minhas alterações
          </Button>
        </div>
      )}
      {serverError && (
        <p role="alert" className="rounded-control border border-destructive px-3 py-2 text-caption-sm text-destructive lg:col-span-2">
          {serverError}
        </p>
      )}
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(c) => {
          const { ref, ...reg } = form.register('displayName')
          return (
            <Input
              {...c}
              {...reg}
              ref={(el) => {
                ref(el)
                if (typeof firstFieldRef === 'function') firstFieldRef(el)
                else if (firstFieldRef) (firstFieldRef as { current: HTMLInputElement | null }).current = el
              }}
              placeholder="Ex.: Carteira principal"
              className={controlClass}
            />
          )
        }}
      </Field>
      <Field label="Apelido da carteira" required error={errors.label?.message}>
        {(c) => <Input {...c} {...form.register('label')} placeholder="Ex.: minha-carteira" className={controlClass} />}
      </Field>
      <Field label="Rede" required error={errors.network?.message}>
        {(c) => (
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} name={`${uid}-network`}>
                <SelectTrigger {...c} onBlur={field.onBlur} ref={field.ref} className={trigger}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORK_LABEL[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Nome do perfil" required error={errors.profileName?.message}>
        {(c) => <Input {...c} {...form.register('profileName')} placeholder="Ex.: mateus-wensch" autoCapitalize="none" spellCheck={false} className={controlClass} />}
      </Field>
      <Field label="Endereço da carteira" required hint="0x seguido de 40 caracteres hexadecimais" error={errors.address?.message}>
        {(c) => <Input {...c} {...form.register('address')} placeholder="Ex.: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F" spellCheck={false} className={controlClass} />}
      </Field>
      <Field label="ENS ou carteira secundária (opcional)" error={errors.alternateAddress?.message}>
        {(c) => <Input {...c} {...form.register('alternateAddress')} placeholder="Ex.: nova.kurio.eth" spellCheck={false} className={controlClass} />}
      </Field>
      <Field label="Tipo de carteira" required error={errors.type?.message}>
        {(c) => (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} name={`${uid}-type`}>
                <SelectTrigger {...c} onBlur={field.onBlur} ref={field.ref} className={trigger}>
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {WALLET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Código de indicação" required hint="4 a 16 caracteres: letras, números ou hífen" error={errors.referralCode?.message}>
        {(c) => <Input {...c} {...form.register('referralCode')} placeholder="Ex.: KURIO-2026" autoCapitalize="characters" spellCheck={false} className={cn(controlClass, 'uppercase')} />}
      </Field>
      <Field label="E-mail" required error={errors.email?.message}>
        {(c) => <Input {...c} {...form.register('email')} placeholder="Ex.: voce@exemplo.com" type="email" autoComplete="email" className={controlClass} />}
      </Field>
      <Field label="Nome ENS" required hint="Será salvo como mateus.eth" error={errors.ensLabel?.message}>
        {(c) => (
          <div className="flex gap-2">
            <EnsDomainSelect />
            <Input {...c} {...form.register('ensLabel')} placeholder="Ex.: mateus" autoCapitalize="none" spellCheck={false} aria-label="Nome ENS (sem .eth)" className={controlClass} />
          </div>
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
        <Button type="submit" disabled={form.formState.isSubmitting} className="h-10 rounded-control px-6 text-body-sm font-bold max-lg:h-12 max-lg:w-full max-lg:rounded-full">
          {form.formState.isSubmitting ? 'Salvando…' : conflict ? 'Confirmar e salvar' : 'Salvar carteira'}
        </Button>
        <p role="status" className="text-caption-sm text-text-accent">
          {saved ? 'Carteira salva.' : ''}
        </p>
      </div>
    </form>
  )
}
