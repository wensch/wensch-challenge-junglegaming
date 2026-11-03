import { HEADERS, uuidSchema } from '@/api/contracts'
import { getOrCreateCart } from '../cart'
import { findEdition, findNft } from '../catalog'
import { db, persist } from '../db'
import { fail, route, validationFail } from '../http'
import { findOrder, placeOrder } from '../orders'
import { diffQuotes, quoteSnapshot, refreshQuote } from '../quote'
import { fireOnce, isActive } from '../scenario-state'
import { expireSession } from '../sessions'

export const orderHandlers = [
  route('createOrder', (ctx) => {
    const { auth, request, body } = ctx
    const user = auth.user!

    // §6/§3: the session expires exactly on this call; nothing is created.
    if (fireOnce('session.expire-on-checkout')) {
      expireSession(auth.session!)
      fail({ code: 'SESSION_EXPIRED', message: 'Sua sessão expirou durante a compra. Entre novamente para continuar.' })
    }

    const key = request.headers.get(HEADERS.idempotencyKey)
    const parsedKey = uuidSchema.safeParse(key)
    if (!parsedKey.success) validationFail({ [HEADERS.idempotencyKey]: ['Cabeçalho Idempotency-Key (UUID) é obrigatório'] })

    // Idempotency: same key + same body -> same order; same key + other body -> 409.
    const bodyHash = JSON.stringify(body)
    const slot = `${user.id}:${parsedKey.data}`
    const prior = db().idempotency[slot]
    if (prior) {
      if (prior.bodyHash !== bodyHash) {
        fail({ code: 'IDEMPOTENCY_CONFLICT', message: 'Esta chave de idempotência já foi usada com outros dados.', orderId: prior.orderId })
      }
      const existing = findOrder(prior.orderId)
      if (existing) {
        ctx.status = 200
        return existing
      }
    }

    const wallet = db().wallets.find((w) => w.id === body.walletId)
    if (!wallet) fail({ code: 'NOT_FOUND', message: 'Carteira não encontrada.', resource: { kind: 'wallet', id: body.walletId } })
    if (wallet.userId !== user.id) fail({ code: 'FORBIDDEN', message: 'Você não tem acesso a esta carteira.' })
    const connection = db().connections.find((c) => c.connectionId === body.connectionId && c.walletId === wallet.id && c.userId === user.id)
    if (!connection || connection.network !== body.network) validationFail({ connectionId: ['Conecte a carteira na rede selecionada antes de comprar'] })

    const cart = getOrCreateCart(`u:${user.id}`)
    const fresh = refreshQuote(cart, body.network)
    if (fresh.issues.some((i) => i.kind === 'empty_cart')) validationFail({ quoteId: ['O carrinho está vazio'] })

    // Hard availability limits come first: the order can never be placed.
    const short = fresh.lines.flatMap((l) => {
      const nft = findNft(l.nftId)
      const ed = nft && findEdition(nft, l.editionId)
      return ed && ed.available < l.quantity ? [{ nftId: l.nftId, editionId: l.editionId, requested: l.quantity, available: ed.available }] : []
    })
    if (short.length) {
      const [first, ...rest] = short
      fail({ code: 'CONFLICT_AVAILABILITY', message: 'Alguns itens não estão mais disponíveis na quantidade escolhida.', items: [first!, ...rest] })
    }

    if (body.quoteId !== fresh.id || body.quoteVersion !== fresh.version || !fresh.orderable) {
      fail({
        code: 'QUOTE_STALE',
        message: 'Os valores do seu pedido mudaram. Revise e confirme novamente.',
        quote: fresh,
        changes: diffQuotes(quoteSnapshot(cart.id, body.quoteVersion), fresh),
      })
    }

    const mode = isActive('payment.hold') ? 'hold' : isActive('payment.declined') ? 'declined' : 'confirmed'
    const order = placeOrder({
      user,
      body,
      quote: fresh,
      ownerKey: `u:${user.id}`,
      wallet: { id: wallet.id, label: wallet.label, address: wallet.address, type: wallet.type },
      mode,
    })
    db().idempotency[slot] = { bodyHash, orderId: order.id }
    persist()

    // The order exists but the client never hears back (it must recover through the same Idempotency-Key).
    if (fireOnce('order.timeout-after-create')) ctx.hang()
    return order
  }),

  route('getOrder', ({ auth, params }) => {
    if (isActive('auth.forbidden')) fail({ code: 'FORBIDDEN', message: 'Você não tem acesso a este pedido.' })
    const order = findOrder(params.orderId!)
    if (!order) fail({ code: 'NOT_FOUND', message: 'Pedido não encontrado.', resource: { kind: 'order', id: params.orderId! } })
    if (order.userId !== auth.user!.id) fail({ code: 'FORBIDDEN', message: 'Você não tem acesso a este pedido.' })
    return order
  }),

  route('listOrders', ({ auth, query }) => ({
    items: db()
      .orders.filter((o) => o.userId === auth.user!.id && (!query.status || o.status === query.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
  })),
]
