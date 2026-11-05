/**
 * Checkout (TEL-4, PAG-1..4). Left: collector form (react-hook-form + zod). Right: items and totals of the
 * QUOTE, wallet/network with simulated connection, and "Confirmar compra", which opens the review. The order
 * is created only from the review ("Enviar pedido"):
 *  - the quote the user accepted is remembered; if it changes (event or `409 QUOTE_STALE`) the diff is shown
 *    and sending stays blocked until the user accepts the new values (revalidation, challenge §3/§7);
 *  - one `Idempotency-Key` per attempt fingerprint (`attempt.ts`): repeated clicks and retries after a
 *    timeout reuse it, so they return the same order;
 *  - API field errors are mapped back onto the form fields (`aria-describedby` on each message).
 */
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { isApiError, type CartLine, type Network, type Quote, type QuoteChange, type User, type Wallet } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderTotals } from '@/features/shared/OrderTotals'
import { applyFieldErrors } from '@/features/shared/forms'
import { invalidateCartAndQuote } from '@/queries/cart'
import type { OwnerCredential } from '@/queries/owner'
import { useCreateOrder, type UserCredential } from '@/queries/orders'
import { queryKeys } from '@/queries/keys'
import { quoteQueryKey, useQuote } from '@/queries/quote'
import { ensureAttempt, fingerprintOf, recordAttemptOrder } from './attempt'
import { diffQuotes } from './diff'
import { readDraft, writeDraft, type DraftConnection } from './draft'
import { TextAreaField, TextField } from './Field'
import { checkoutFormSchema, CHECKOUT_FIELDS, ENS_SUFFIX, ensLabelOf, toCollector, type CheckoutFormInput, type CheckoutFormValues } from './form'
import { ItemsSummary } from './ItemsSummary'
import { WALLET_TYPE_LABELS } from './labels'
import { ReviewDialog } from './ReviewDialog'
import { WalletPanel } from './WalletPanel'
import { isSameUser } from './wallets'


interface Props {
  user: User
  credential: UserCredential
  cartLines: CartLine[]
  wallets: Wallet[]
  onAnnounce: (text: string) => void
}

function defaultsFor(user: User, wallets: Wallet[], credential: UserCredential): { values: CheckoutFormInput; connection: DraftConnection | null } {
  const draft = readDraft(credential.userId)?.values
  const wallet = wallets.find((w) => w.id === draft?.walletId) ?? wallets[0]
  const walletId = wallet?.id ?? ''
  const network = (draft?.walletId === walletId ? draft.network : undefined) ?? wallet?.network ?? 'ethereum'
  const saved = readDraft(credential.userId)?.connection ?? null
  const connection = saved && saved.walletId === walletId && saved.network === network ? saved : null
  return {
    connection,
    values: {
      displayName: draft?.displayName ?? wallet?.displayName ?? user.displayName,
      username: draft?.username ?? user.username,
      profileName: draft?.profileName ?? wallet?.profileName ?? user.username,
      email: draft?.email ?? wallet?.email ?? user.email,
      ensLabel: draft?.ensLabel ?? (wallet ? ensLabelOf(wallet.ensName) : ''),
      referralCode: draft?.referralCode ?? wallet?.referralCode ?? '',
      note: draft?.note ?? '',
      walletId,
      network,
      connectionId: connection?.connectionId ?? '',
    },
  }
}

function issueTexts(quote: Quote | undefined): string[] {
  if (!quote) return []
  const out: string[] = []
  for (const i of quote.issues) {
    if (i.kind === 'insufficient' || i.kind === 'sold_out') out.push('Há itens indisponíveis na quantidade escolhida. Volte ao carrinho para ajustar.')
    else if (i.kind === 'coupon_expired') out.push(`O cupom ${i.code} expirou. Remova-o no carrinho para continuar.`)
    else if (i.kind === 'coupon_invalid') out.push(`O cupom ${i.code} não é mais válido. Remova-o no carrinho para continuar.`)
  }
  return [...new Set(out)]
}

/** What the ENS name will look like: what was typed (lowercase, trimmed) or a neutral example before typing. */
function ensPreview(label: unknown): string {
  const typed = typeof label === 'string' ? label.trim().toLowerCase() : ''
  return typed === '' ? 'nome' : typed
}

export function CheckoutForm({ user, credential, cartLines, wallets, onAnnounce }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const owner: OwnerCredential = { kind: 'user', ...credential }
  const create = useCreateOrder()
  const [initial] = useState(() => defaultsFor(user, wallets, credential))
  const [connection, setConnection] = useState<DraftConnection | null>(initial.connection)
  const connectionRef = useRef(connection)
  const submitting = useRef(false)

  const form = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({ resolver: zodResolver(checkoutFormSchema), defaultValues: initial.values, mode: 'onTouched' })
  const { register, handleSubmit, setValue, setError, setFocus, formState } = form
  const { errors } = formState
  const walletId = useWatch({ control: form.control, name: 'walletId' })
  const network: Network = useWatch({ control: form.control, name: 'network' })
  const typedEnsLabel = useWatch({ control: form.control, name: 'ensLabel' })
  const wallet = wallets.find((w) => w.id === walletId)

  // Draft: written only on user edits (never on mount) and only while this user owns the session.
  const credentialRef = useRef(credential)
  useEffect(() => {
    credentialRef.current = credential
  }, [credential])
  useEffect(() => {
    const persist = (values: Partial<CheckoutFormInput>) => {
      const cred = credentialRef.current
      if (!isSameUser(cred)) return
      writeDraft(cred.userId, {
        values: {
          ...(typeof values.displayName === 'string' ? { displayName: values.displayName } : {}),
          ...(typeof values.username === 'string' ? { username: values.username } : {}),
          ...(typeof values.profileName === 'string' ? { profileName: values.profileName } : {}),
          ...(typeof values.email === 'string' ? { email: values.email } : {}),
          ...(typeof values.ensLabel === 'string' ? { ensLabel: values.ensLabel } : {}),
          ...(typeof values.referralCode === 'string' ? { referralCode: values.referralCode } : {}),
          ...(typeof values.note === 'string' ? { note: values.note } : {}),
          ...(typeof values.walletId === 'string' ? { walletId: values.walletId } : {}),
          ...(values.network ? { network: values.network } : {}),
        },
        connection: connectionRef.current,
      })
    }
    return form.subscribe({ formState: { values: true }, callback: ({ values }) => persist(values) })
  }, [form])

  const quote = useQuote(owner, network, cartLines.length > 0)

  // Quote the user has seen and accepted. A different id/version later means "values changed".
  const [accepted, setAccepted] = useState<Quote | null>(null)
  const [staleChanges, setStaleChanges] = useState<QuoteChange[] | null>(null)
  if (quote.data && (!accepted || accepted.network !== quote.data.network)) setAccepted(quote.data)
  const moved = !!quote.data && !!accepted && accepted.network === quote.data.network && (accepted.id !== quote.data.id || accepted.version !== quote.data.version)
  const needsReconfirm = moved
  const changes = !quote.data || !accepted ? [] : (staleChanges ?? diffQuotes(accepted, quote.data))

  const [reviewOpen, setReviewOpen] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [reviewValues, setReviewValues] = useState<CheckoutFormValues | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const blocked = issueTexts(quote.data)

  const onConnection = (next: DraftConnection | null) => {
    connectionRef.current = next
    setConnection(next)
    setValue('connectionId', next?.connectionId ?? '', { shouldValidate: formState.isSubmitted })
    if (isSameUser(credential)) {
      const v = form.getValues()
      writeDraft(credential.userId, {
        values: { displayName: v.displayName, username: v.username, profileName: v.profileName, email: v.email, ensLabel: v.ensLabel, referralCode: v.referralCode, note: v.note, walletId: v.walletId, network: v.network },
        connection: next,
      })
    }
  }

  const changeWallet = (id: string) => {
    const next = wallets.find((w) => w.id === id)
    if (!next) return
    setValue('walletId', id, { shouldDirty: true })
    setValue('network', next.network, { shouldDirty: true })
    onConnection(null)
  }

  const changeNetwork = (next: Network) => {
    setValue('network', next, { shouldDirty: true })
    onConnection(null)
  }

  const openReview = handleSubmit(
    (values) => {
      setSubmitError(null)
      setReviewValues(values)
      setReviewOpen(true)
      // Revalidate on opening the review: the quote is re-read from the API (staleTime 0 + explicit refetch).
      void quote.refetch()
    },
    () => onAnnounce('Há campos com erro. Corrija-os para continuar.'),
  )

  const accept = () => {
    if (quote.data) setAccepted(quote.data)
    setStaleChanges(null)
    onAnnounce('Novos valores aceitos. Você já pode enviar o pedido.')
  }

  const send = async () => {
    if (submitting.current || !reviewValues || !quote.data || !wallet) return
    submitting.current = true
    setSubmitError(null)
    try {
      const body = {
        quoteId: quote.data.id,
        quoteVersion: quote.data.version,
        walletId: reviewValues.walletId,
        connectionId: reviewValues.connectionId,
        network: reviewValues.network,
        collector: toCollector(reviewValues),
      }
      const attempt = ensureAttempt(credential.userId, await fingerprintOf(body))
      const order = await create.mutateAsync({ user: credential, body, idempotencyKey: attempt.key })
      if (!isSameUser(credential)) return
      recordAttemptOrder(credential.userId, order.id)
      await navigate({ to: '/orders/$id', params: { id: order.id } })
    } catch (error) {
      await handleError(error)
    } finally {
      submitting.current = false
    }
  }

  async function handleError(error: unknown) {
    if (!isApiError(error) || !isSameUser(credential)) return
    if (error.is('QUOTE_STALE')) {
      if (owner) qc.setQueryData(quoteQueryKey(owner, error.payload.quote.network), error.payload.quote)
      setStaleChanges(error.payload.changes)
      setSubmitError(null)
      onAnnounce('Os valores do pedido mudaram. Revise e confirme novamente.')
      if (owner) void invalidateCartAndQuote(qc, owner)
    } else if (error.is('CONFLICT_AVAILABILITY')) {
      setSubmitError(`${error.message} Volte ao carrinho para ajustar as quantidades.`)
      if (owner) void invalidateCartAndQuote(qc, owner)
    } else if (error.is('IDEMPOTENCY_CONFLICT')) {
      recordAttemptOrder(credential.userId, error.payload.orderId)
      await navigate({ to: '/orders/$id', params: { id: error.payload.orderId } })
    } else if (error.is('VALIDATION')) {
      const unmatched = applyFieldErrors(error, setError, CHECKOUT_FIELDS, { 'collector.ensName': 'ensLabel' })
      if (error.fieldErrors?.['connectionId']) onConnection(null)
      setReviewOpen(false)
      const keys = Object.keys(error.fieldErrors ?? {}).map((k) => (k === 'collector.ensName' ? 'ensLabel' : k.replace(/^collector\./, '')))
      const first = CHECKOUT_FIELDS.find((f) => keys.includes(f))
      if (first && first !== 'connectionId' && first !== 'walletId' && first !== 'network') setFocus(first)
      onAnnounce(unmatched[0] ?? 'Revise os campos destacados.')
    } else if (error.is('NOT_FOUND') || error.is('FORBIDDEN')) {
      setSubmitError('A carteira escolhida não está disponível. Escolha outra carteira e conecte novamente.')
      onConnection(null)
    } else if (error.is('TRANSIENT')) {
      setSubmitError('Não foi possível confirmar o envio. Seu pedido pode ter sido criado: ao tentar de novo usamos a mesma chave de idempotência, então nada é cobrado em duplicidade.')
      void qc.invalidateQueries({ queryKey: queryKeys.user(credential.userId).orders() })
    } else {
      setSubmitError('Não foi possível enviar o pedido. Tente novamente.')
    }
  }

  const feeFor = quote.data
  const selectedIsSecondary = wallet?.slot === 'secondary'

  return (
    <form onSubmit={(e) => void openReview(e)} noValidate data-testid="checkout-form" className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_405px] lg:gap-[46px]">
      <div>
        <h2 className="mb-4 text-body-md font-bold text-text-primary">Perfil do colecionador</h2>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <TextField label="Nome de exibição" required autoComplete="name" placeholder="Ex.: Carteira principal" error={errors.displayName?.message} {...register('displayName')} />
          <TextField label="Nome de usuário" required autoComplete="username" placeholder="Ex.: mateus-wensch" error={errors.username?.message} {...register('username')} />
          <TextField label="Nome do perfil" required placeholder="Ex.: mateus-wensch" error={errors.profileName?.message} {...register('profileName')} />
          <TextField label="Endereço da carteira" readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" />
          <TextField label="Tipo de carteira" readOnly value={wallet ? WALLET_TYPE_LABELS[wallet.type] : ''} placeholder="Selecione uma carteira" />
          <TextField label="Código de indicação" required hint="4 a 16 caracteres: letras, números ou hífen" placeholder="Ex.: KURIO-2026" autoCapitalize="characters" error={errors.referralCode?.message} {...register('referralCode')} />
          <TextField label="E-mail" required type="email" autoComplete="email" placeholder="Ex.: voce@exemplo.com" error={errors.email?.message} {...register('email')} />
          <div>
            <TextField
              label="Nome ENS"
              required
              spellCheck={false}
              autoCapitalize="none"
              placeholder="Ex.: mateus"
              hint={`Será salvo como ${ensPreview(typedEnsLabel)}${ENS_SUFFIX}`}
              error={errors.ensLabel?.message}
              {...register('ensLabel')}
            />
          </div>
        </div>

        {wallets.length > 1 ? (
          <label className="mt-5 flex w-fit cursor-pointer items-center gap-2 text-body-sm text-text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/60">
            <input
              type="checkbox"
              checked={selectedIsSecondary}
              onChange={(e) => {
                const target = wallets.find((w) => w.slot === (e.target.checked ? 'secondary' : 'primary'))
                if (target) changeWallet(target.id)
              }}
              className="size-4 accent-brand"
            />
            Usar outra carteira?
          </label>
        ) : null}

        <TextAreaField className="mt-5 max-w-[350px]" label="Observação do colecionador (opcional)" error={errors.note?.message} {...register('note')} />
      </div>

      <div className="flex flex-col gap-5">
        <h2 className="border-b border-line pb-2.5 text-body-md font-bold text-text-primary">Seus NFTs</h2>
        {quote.isPending && quote.fetchStatus !== 'idle' ? (
          <div data-testid="checkout-skeleton" aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-[70px] w-full" />
            <Skeleton className="h-[70px] w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : quote.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-body-sm text-text-primary">
            <p>Não foi possível calcular os valores agora.</p>
            <Button type="button" variant="outline" onClick={() => void quote.refetch()} className="h-9 rounded-control px-4 text-body-sm font-bold max-lg:rounded-full">
              Tentar novamente
            </Button>
          </div>
        ) : feeFor ? (
          <>
            <ItemsSummary quote={feeFor} cartLines={cartLines} />
            <p className="text-center text-body-sm text-text-primary">
              Tem um código promocional?{' '}
              <Link to="/cart" className="text-text-accent underline underline-offset-4">
                Aplique aqui
              </Link>
            </p>
            <OrderTotals
              testIdPrefix="checkout"
              subtotal={feeFor.subtotal}
              discount={feeFor.discount}
              discountLabel={feeFor.coupon?.label ?? 'Desconto do lançamento'}
              networkFee={feeFor.networkFee}
              total={feeFor.total}
              feeEstimated={feeFor.networkFeeEstimated}
            />
          </>
        ) : null}

        {needsReconfirm && !reviewOpen ? (
          <p data-testid="checkout-moved" role="status" className="rounded-control border border-brand bg-surface-card px-4 py-3 text-body-sm text-text-primary">
            Os valores do pedido mudaram. Revise e confirme novamente ao enviar.
          </p>
        ) : null}

        {blocked.length > 0 ? (
          <ul role="alert" id="checkout-blocked" className="list-disc space-y-1 pl-5 text-caption-sm text-destructive">
            {blocked.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}

        <WalletPanel
          wallets={wallets}
          walletId={walletId}
          network={network}
          connection={connection}
          error={errors.connectionId?.message}
          onWalletChange={changeWallet}
          onNetworkChange={changeNetwork}
          onConnection={onConnection}
          onMessage={onAnnounce}
        />

        <Button ref={confirmRef} type="submit" disabled={!quote.data || !quote.data.orderable} aria-describedby={blocked.length > 0 ? 'checkout-blocked' : undefined} className="h-[45px] rounded-control text-body-md font-bold max-lg:h-[60px] max-lg:rounded-full">
          Confirmar compra
        </Button>
      </div>

      <ReviewDialog
        open={reviewOpen}
        returnFocusRef={confirmRef}
        onOpenChange={setReviewOpen}
        values={reviewValues}
        wallet={wallets.find((w) => w.id === reviewValues?.walletId)}
        quote={quote.data}
        refreshing={quote.isFetching}
        cartLines={cartLines}
        changes={changes}
        needsReconfirm={needsReconfirm}
        onAccept={accept}
        onSubmit={() => void send()}
        submitting={create.isPending}
        error={submitError}
        blockedReasons={blocked}
      />
    </form>
  )
}
