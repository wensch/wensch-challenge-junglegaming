/**
 * Named, deterministic MSW scenarios (names + expected effect only — NO fixture data here;
 * data lives exclusively in src/mocks). The mock layer implements each one; tests and the demo
 * panel select them by name.
 *
 * Selection (implemented in src/mocks/control.ts):
 *   - URL: `?scenario=a,b` on first load (persisted in localStorage `mock:scenarios`);
 *   - runtime: `window.__mock.setScenarios(['a','b'])`; `window.__mock.reset()` restores seed + `default`.
 * Scenarios are composable (e.g. `latency.slow` + `payment.declined`). `default` = no overrides.
 * "Next request" scenarios (`*.once`) fire once and then disarm themselves.
 * FROZEN: changes require an entry in ARCHITECTURE.md "Changelog de contratos".
 */
import type { EndpointName } from './endpoints'

export type ScenarioGroup = 'base' | 'network' | 'http' | 'session' | 'forms' | 'coupon' | 'checkout' | 'order' | 'payment'

export interface ScenarioDef {
  group: ScenarioGroup
  /** Item of challenge §6 (or §7/§9) the scenario covers. */
  covers: string
  description: string
  /** Observable effect the UI/tests must assert on. */
  effect: string
  /** Endpoints affected (`'*'` = all REST endpoints). */
  affects: readonly (EndpointName | '*')[]
}

export const SCENARIOS = {
  default: {
    group: 'base',
    covers: '§6 sucesso',
    description: 'Seed padrão, latência curta fixa (150 ms), todas as operações bem-sucedidas.',
    effect: 'Fluxos completos funcionam; base para Lighthouse e regressão visual.',
    affects: ['*'],
  },
  'catalog.empty': {
    group: 'base',
    covers: '§6 resultado vazio',
    description: 'GET /nfts responde items: [] e total 0 para qualquer filtro (facets zeradas).',
    effect: 'Catálogo exibe estado vazio com ação para limpar filtros; paginação some.',
    affects: ['listNfts'],
  },
  'latency.slow': {
    group: 'network',
    covers: '§6 lentidão',
    description: 'Todas as respostas REST atrasam 2500 ms.',
    effect: 'Skeletons com shimmer visíveis (catálogo, detalhe, resumo do carrinho) sem layout shift.',
    affects: ['*'],
  },
  'latency.variable': {
    group: 'network',
    covers: '§6 latência variável',
    description: 'Atraso pseudoaleatório determinístico (seed fixa) entre 100 e 1800 ms por requisição.',
    effect: 'UI permanece consistente; atualização em segundo plano indicada sem apagar dados.',
    affects: ['*'],
  },
  'catalog.out-of-order': {
    group: 'network',
    covers: '§6 respostas fora de ordem',
    description: 'Em GET /nfts, a 1ª requisição de uma sequência demora 2000 ms e as seguintes 100 ms, então respostas antigas chegam depois das novas.',
    effect: 'A grade mostra apenas o resultado dos parâmetros atuais da URL (resposta obsoleta cancelada/descartada).',
    affects: ['listNfts'],
  },
  'network.offline': {
    group: 'network',
    covers: '§6 indisponibilidade de conexão',
    description: 'Todas as requisições REST falham como erro de rede (HttpResponse.error()); o socket é derrubado e recusa reconexão até sair do cenário.',
    effect: 'Feedback de falha com "Tentar novamente"; dados em cache permanecem; recupera ao voltar ao default.',
    affects: ['*'],
  },
  'network.timeout': {
    group: 'network',
    covers: '§6 timeouts',
    description: 'Requisições REST nunca respondem antes do timeout do cliente (Axios 10 s).',
    effect: 'Cliente aborta, mostra erro TRANSIENT/timeout e oferece retry; nada é duplicado.',
    affects: ['*'],
  },
  'http.500.once': {
    group: 'http',
    covers: '§6 HTTP 5xx',
    description: 'A próxima requisição REST responde 500 TRANSIENT; as seguintes funcionam.',
    effect: 'Retry automático de queries recupera sem intervenção; mutations exibem erro e permitem nova tentativa.',
    affects: ['*'],
  },
  'http.503': {
    group: 'http',
    covers: '§6 HTTP 5xx',
    description: 'GET /nfts e GET /nfts/:nftId respondem 503 TRANSIENT (retryAfterMs 1000) enquanto ativo.',
    effect: 'Após esgotar retries, estado de erro com botão de nova tentativa; recupera ao sair do cenário.',
    affects: ['listNfts', 'getNft'],
  },
  'favorites.fail': {
    group: 'http',
    covers: '§6 HTTP 4xx/5xx · §9 item 4',
    description: 'PUT/DELETE /favorites/:nftId respondem 503 TRANSIENT.',
    effect: 'Toggle otimista é revertido (rollback) e anuncia a falha em região aria-live.',
    affects: ['addFavorite', 'removeFavorite'],
  },
  'session.expired': {
    group: 'session',
    covers: '§6 sessão expirada',
    description: 'A sessão atual é invalidada: qualquer endpoint `session` responde 401 SESSION_EXPIRED.',
    effect: 'Cliente limpa dados privados, desconecta o socket e leva ao login com redirect para retomar o contexto (inclusive checkout).',
    affects: ['*'],
  },
  'session.expire-on-checkout': {
    group: 'session',
    covers: '§6 sessão expirada · §3 expiração durante o checkout',
    description: 'A sessão expira exatamente na próxima chamada POST /orders (401 SESSION_EXPIRED, nenhum pedido criado).',
    effect: 'Após novo login o usuário volta ao checkout com formulário e carrinho preservados.',
    affects: ['createOrder'],
  },
  'auth.forbidden': {
    group: 'session',
    covers: '§6 acesso não autorizado',
    description: 'GET /orders/:orderId e PATCH /wallets/:walletId de recurso de outro usuário respondem 403 FORBIDDEN (comportamento sempre ativo; o cenário força-o para qualquer id).',
    effect: 'Tela de acesso negado; nenhum dado de outro usuário exibido.',
    affects: ['getOrder', 'updateWallet'],
  },
  'register.email-taken': {
    group: 'forms',
    covers: '§6 conflito de cadastro',
    description: 'POST /auth/register responde 409 EMAIL_TAKEN para qualquer e-mail (sem o cenário, só e-mails já existentes conflitam).',
    effect: 'Erro associado ao campo e-mail (aria-describedby), foco no campo.',
    affects: ['register'],
  },
  'forms.server-validation': {
    group: 'forms',
    covers: '§6 validação de formulário',
    description: 'PATCH /profile, POST /profile/password, POST/PATCH /wallets respondem 422 VALIDATION com fieldErrors em campos que passam na validação do cliente.',
    effect: 'Mensagens da API aparecem nos campos correspondentes; dados digitados preservados.',
    affects: ['updateProfile', 'changePassword', 'createWallet', 'updateWallet'],
  },
  'coupon.invalid': {
    group: 'coupon',
    covers: '§6 cupom inválido',
    description: 'PUT /cart/coupon responde 422 COUPON_INVALID para qualquer código.',
    effect: 'Mensagem de cupom inválido no campo; resumo inalterado.',
    affects: ['applyCoupon'],
  },
  'coupon.expired': {
    group: 'coupon',
    covers: '§6 cupom expirado',
    description: 'PUT /cart/coupon responde 422 COUPON_EXPIRED; se já houver cupom aplicado, a cotação passa a trazer issue coupon_expired.',
    effect: 'Mensagem de cupom expirado; desconto removido do resumo após nova cotação.',
    affects: ['applyCoupon', 'createQuote'],
  },
  'checkout.price-changed': {
    group: 'checkout',
    covers: '§6 preço alterado durante a compra · §7 cenário 1–4',
    description: 'Ao abrir a revisão (1ª POST /quotes no checkout) o preço de um NFT do carrinho sobe; o mock emite nft.updated e a próxima POST /orders com a versão antiga recebe 409 QUOTE_STALE.',
    effect: 'UI avisa a alteração (aria-live), atualiza o resumo e exige nova confirmação explícita antes de enviar.',
    affects: ['createQuote', 'createOrder'],
  },
  'checkout.sold-out': {
    group: 'checkout',
    covers: '§6 edição esgotada durante a compra',
    description: 'Durante o checkout a edição de um item do carrinho esgota (available 0); emite nft.updated; POST /orders responde 409 CONFLICT_AVAILABILITY.',
    effect: 'Item marcado como esgotado, confirmação bloqueada até o usuário ajustar o carrinho; itens preservados.',
    affects: ['createQuote', 'createOrder'],
  },
  'order.timeout-after-create': {
    group: 'order',
    covers: '§6 timeout após criação do pedido com recuperação por idempotência',
    description: 'A 1ª POST /orders cria o pedido no servidor mas não responde antes do timeout do cliente; reenvios com a mesma Idempotency-Key retornam o MESMO pedido (200).',
    effect: 'Usuário vê "verificando pedido", o reenvio recupera o mesmo id; nenhum pedido duplicado existe (GET /orders).',
    affects: ['createOrder'],
  },
  'payment.confirmed': {
    group: 'payment',
    covers: '§6 pagamento confirmado',
    description: 'Pedido criado como pending e confirmado após 1500 ms via order.updated (status confirmed, transação simulada). Comportamento padrão.',
    effect: 'Tela de confirmação com id da transação, itens, taxas e total do snapshot; só os itens comprados saem do carrinho.',
    affects: ['createOrder'],
  },
  'payment.declined': {
    group: 'payment',
    covers: '§6 pagamento recusado',
    description: 'Pedido criado como pending e recusado após 1500 ms via order.updated (status declined, declineReason).',
    effect: 'Estado de recusa com motivo; carrinho preservado integralmente; nova tentativa usa nova Idempotency-Key.',
    affects: ['createOrder'],
  },
  'payment.hold': {
    group: 'payment',
    covers: '§7 interrupção com pedido pendente · §9 item 10',
    description: 'Pedido fica pending indefinidamente até o teste chamar window.__mock.settleOrder(id, "confirmed"|"declined").',
    effect: 'Permite derrubar o socket/recarregar com pedido pendente e verificar recuperação sem nova compra.',
    affects: ['createOrder'],
  },
  'wallet.reject': {
    group: 'payment',
    covers: '§3 simulação de recusa de carteira',
    description: 'POST /wallets/:walletId/connect responde { status: "rejected" }.',
    effect: 'UI informa recusa e mantém o botão de conectar; pedido não pode ser enviado.',
    affects: ['connectWallet'],
  },
} as const satisfies Record<string, ScenarioDef>

export type ScenarioName = keyof typeof SCENARIOS
export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]

export function isScenarioName(v: string): v is ScenarioName {
  return Object.hasOwn(SCENARIOS, v)
}

/**
 * Control surface exposed by the mock layer on `window.__mock` (implemented in src/mocks/control.ts).
 * Declared here so tests type their calls without importing src/mocks.
 */
export interface MockControl {
  /** Restores the seed and selects `scenarios` (default: `['default']`). v1.1.0: optional argument. */
  reset(scenarios?: ScenarioName[]): Promise<void>
  setScenarios(names: ScenarioName[]): void
  getScenarios(): ScenarioName[]
  /**
   * Server-side Socket.IO emit (frames go through socket.io-client). `userId` targets one user's sockets.
   * `payload` is expected to be the FULL envelope of events.ts (`RealtimeEvent`: id, type, resource,
   * version, userId?, occurredAt, data). It stays `unknown` on purpose so tests can also send
   * malformed payloads and assert the client drops them.
   */
  emit(event: 'nft.updated' | 'order.updated', payload: unknown, opts?: { userId?: string }): void
  /** Mutate catalog state and broadcast the matching nft.updated (keeps REST and events consistent). */
  updateNft(nftId: string, patch: { price?: string; editions?: { id: string; price?: string; available?: number }[] }): void
  /** Close all Socket.IO connections (client reconnects automatically unless network.offline). */
  drop(): void
  settleOrder(orderId: string, status: 'confirmed' | 'declined'): void
}
