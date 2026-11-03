# ARCHITECTURE — Marketplace de NFTs (KURIO)

Requisitos oficiais: [docs/challenge.md](docs/challenge.md). Este documento registra contratos, políticas e decisões **no momento em que são tomadas**.
Contratos: **v1.0.0, congelados** em 2026-11-03 (`src/api/contracts`). Qualquer mudança exige entrada em [Changelog de contratos](#14-changelog-de-contratos).

## 1. Camadas

```
UI (routes/, features/, components/ui)            ← nunca conhece dados fictícios
  │ hooks TanStack Query (queries/)                 ← query keys, staleTime, otimismo, invalidação
  │ endpoints Axios (api/endpoints/*)               ← 1 função por linha da tabela `endpoints`, recebe AbortSignal
  │ api/client.ts (Axios)                           ← baseURL, Authorization / X-Guest-Id, X-Request-Id, timeout 10 s, normalização → ApiError
  │ realtime/ (socket.io-client)                    ← socket por sessão, validação zod do envelope, reconciliação no cache
  ▼
──────────── rede (HTTP / WebSocket) ────────────
src/mocks (MSW worker + @mswjs/socket.io-binding) ← ÚNICO lugar com fixtures, estado simulado, cenários
```

- `src/api/contracts` é importado por app **e** mocks: schemas zod (validação em runtime nas duas pontas) + tipos inferidos + tabela de endpoints + catálogo de cenários. Não contém dados fictícios.
- Regra eliminatória verificada por ESLint (`eslint.config.js`): `no-restricted-imports` impede importar `**/mocks/**`/`@/mocks/**` fora de `src/mocks` (exceção: `src/main.tsx`, que liga o worker); vale também para `tests/`, que falam com o mock apenas via `window.__mock` (tipado por `MockControl`).
- Dinheiro: `parseFloat`/`Number.parseFloat` proibidos em todo `src`; em `src/api/contracts` e `src/lib/money.ts` também `Number()`, `+x` e `z.number()`.

## 2. Contratos REST

Base: `VITE_API_URL` (`/api`). Tabela tipada em `src/api/contracts/endpoints.ts` (`endpoints`, `buildPath`, `possibleErrors`); os handlers MSW registram `${API}${def.path}` e os endpoints Axios usam `buildPath(def.path, params)`, então o path existe em um único lugar.

### 2.1 Convenções
- JSON UTF-8. Toda resposta 2xx é validada com o schema `response` no cliente (falha de parse = bug de contrato, logado e tratado como erro genérico).
- **ETH = string decimal** `^\d+(\.\d{1,18})?$` em todo request/response/evento. Quantidades e estoques são inteiros (`z.int()`).
- Recursos mutáveis carregam `version` inteiro **monotônico** (NFT, carrinho, cotação, pedido, perfil, carteira). Para NFT e pedido é o mesmo contador usado nos eventos.
- Headers: `Authorization: Bearer <token>` (sessão) · `X-Guest-Id: <uuid>` (carrinho de visitante) · `Idempotency-Key: <uuid>` (POST /orders) · `X-Request-Id` (correlação; ecoado em `error.requestId`).
- `auth` da tabela: `public` · `guest` (Authorization se logado, senão X-Guest-Id) · `session` (exige Authorization).

### 2.2 Endpoints

| Recurso | Nome | Método e path | Request | Resposta (status) | Erros de domínio |
|---|---|---|---|---|---|
| Sessão | register | POST `/auth/register` | `RegisterRequest` | `Session` (201) | VALIDATION, EMAIL_TAKEN |
| | login | POST `/auth/login` | `LoginRequest` | `Session` (200) | VALIDATION, UNAUTHENTICATED (credenciais) |
| | getSession | GET `/session` | — | `Session` (200) | (auth) |
| | logout | POST `/auth/logout` | — | 204 | (auth) |
| NFTs | listNfts | GET `/nfts?q&tab&categories&networks&priceMin&priceMax&sort&page&pageSize&collectionId&excludeId` | `NftListQuery` | `NftListResponse` (items, meta, facets) | VALIDATION |
| | getFeatured | GET `/nfts/featured` | — | `FeaturedResponse` (hero, spotlight) | — |
| | getNft | GET `/nfts/:nftId` | — | `NftDetail` (galeria, edições, avaliações) | NOT_FOUND |
| Favoritos | listFavorites | GET `/favorites` | — | `FavoritesResponse` | (auth) |
| | addFavorite | PUT `/favorites/:nftId` | — | `{ nftId, favorited: true }` | NOT_FOUND |
| | removeFavorite | DELETE `/favorites/:nftId` | — | `{ nftId, favorited: false }` | — |
| Carrinho | getCart | GET `/cart` | — | `Cart` | — |
| | addCartItem | POST `/cart/items` | `{ nftId, editionId, quantity }` | `Cart` | VALIDATION, NOT_FOUND, CONFLICT_AVAILABILITY |
| | updateCartItem | PATCH `/cart/items/:lineId` | `{ quantity }` (absoluta) | `Cart` | VALIDATION, NOT_FOUND, CONFLICT_AVAILABILITY |
| | removeCartItem | DELETE `/cart/items/:lineId` | — | `Cart` | NOT_FOUND |
| | mergeCart | POST `/cart/merge` | `{ guestId }` | `{ cart, adjusted[] }` | VALIDATION |
| | applyCoupon | PUT `/cart/coupon` | `{ code }` | `Cart` | VALIDATION, COUPON_INVALID, COUPON_EXPIRED |
| | removeCoupon | DELETE `/cart/coupon` | — | `Cart` | — |
| Cotação | createQuote | POST `/quotes` | `{ network }` | `Quote` | VALIDATION |
| Pedidos | createOrder | POST `/orders` + `Idempotency-Key` | `CreateOrderRequest` | `Order` (201 novo · 200 replay) | VALIDATION, FORBIDDEN, QUOTE_STALE, CONFLICT_AVAILABILITY, IDEMPOTENCY_CONFLICT |
| | getOrder | GET `/orders/:orderId` | — | `Order` | NOT_FOUND, FORBIDDEN |
| | listOrders | GET `/orders?status=` | — | `{ items: Order[] }` | — |
| Perfil | getProfile | GET `/profile` | — | `Profile` | — |
| | updateProfile | PATCH `/profile` | `UpdateProfileRequest` (+ `version`) | `Profile` | VALIDATION, EMAIL_TAKEN |
| | uploadAvatar | PUT `/profile/avatar` | multipart `file` (PNG/JPEG/WebP ≤ 2 MB) | `Profile` | VALIDATION |
| | removeAvatar | DELETE `/profile/avatar` | — | `Profile` | — |
| | changePassword | POST `/profile/password` | `{ currentPassword, newPassword, confirmPassword }` | 204 | VALIDATION (`currentPassword` incorreta vem em fieldErrors) |
| Carteiras | listWallets | GET `/wallets` | — | `{ primary, secondary }` | — |
| | createWallet | POST `/wallets` | `CreateWalletRequest` (slot) | `Wallet` (201) | VALIDATION (inclui slot ocupado) |
| | updateWallet | PATCH `/wallets/:walletId` | `UpdateWalletRequest` (+ `version`) | `Wallet` | VALIDATION, NOT_FOUND, FORBIDDEN |
| | connectWallet | POST `/wallets/:walletId/connect` | `{ network }` | `WalletConnection` (`connected` \| `rejected`) | NOT_FOUND, FORBIDDEN |
| | disconnectWallet | DELETE `/wallets/:walletId/connection` | — | 204 | NOT_FOUND |

Todo endpoint `session` pode responder UNAUTHENTICATED/SESSION_EXPIRED; todo endpoint pode falhar com TRANSIENT.

### 2.3 Erros (`src/api/contracts/errors.ts`)
Corpo: `{ error: { code, message, requestId?, ...campos por código } }` (união discriminada por `code`).

| Código | HTTP | Campos extras | Uso |
|---|---|---|---|
| VALIDATION | 422 | `fieldErrors: Record<campo, string[]>` | Erro de formulário; chaves = caminho do campo no body (`collector.email`) |
| UNAUTHENTICATED | 401 | — | Sem token / credenciais inválidas no login |
| SESSION_EXPIRED | 401 | — | Token expirado/revogado → fluxo de reautenticação |
| FORBIDDEN | 403 | — | Recurso de outro usuário |
| NOT_FOUND | 404 | `resource?` | NFT/pedido/linha inexistente |
| CONFLICT_AVAILABILITY | 409 | `items[{ nftId, editionId, requested, available }]` | Estoque insuficiente/esgotado |
| QUOTE_STALE | 409 | `quote` (nova), `changes[]` | Cotação enviada difere da atual |
| IDEMPOTENCY_CONFLICT | 409 | `orderId` | Mesma chave, body diferente |
| EMAIL_TAKEN | 409 | `fieldErrors.email` | Cadastro/perfil |
| COUPON_INVALID | 422 | `couponCode` | |
| COUPON_EXPIRED | 422 | `couponCode`, `expiredAt` | |
| TRANSIENT | 503 (também 500/502/504; 0 sem resposta) | `reason: server\|network\|timeout`, `retryAfterMs?` | Único código com retry automático |

`ApiError` (classe) é o único tipo de erro lançado pela camada de API: `code`, `status`, `payload` tipado, `retryable`, `fieldErrors`, `is(code)`. O Axios converte erro de rede em `TRANSIENT/network` e `ECONNABORTED`/timeout em `TRANSIENT/timeout`. `errorBody(payload)` (usado pelos mocks) mantém body e status coerentes.

### 2.4 Search params (TanStack Router `validateSearch`)
- `/` → `catalogSearchSchema`: `q?`, `tab` (`all|new|trending`), `categories[]`, `networks[]`, `priceMin?`, `priceMax?` (ETH string), `sort` (`recent|price_asc|price_desc|name_asc`), `page` (≥1). Valores inválidos caem no default (`.catch`) em vez de quebrar a página; listas são deduplicadas e ordenadas (chave de cache estável); faixa invertida é trocada. **Toda mudança de filtro/busca/ordenação/aba zera `page`.** Mapeado 1:1 para `GET /nfts` via `toNftListParams` (listas viram `a,b`); `pageSize` fixo 9 (grade 3×3 do Figma).
- `/nft/$id` → `nftDetailSearchSchema`: `edition?`.
- `/login`, `/register` → `authSearchSchema`: `redirect?` (só path relativo de mesma origem: bloqueia `//host`, `https://`, `/\`), `reason?` (`expired|required`).

## 3. Eventos Socket.IO (`src/api/contracts/events.ts`)

Conexão: `io(VITE_SOCKET_URL, { transports: ['websocket'], auth: { token } })` — `token: null` para visitante (recebe só eventos públicos). Nome do evento Socket.IO = `type`. Servidor → cliente apenas; sem acks.

```ts
{ id: string,                       // estável; duplicatas repetem o mesmo id
  type: 'nft.updated' | 'order.updated',
  resource: { kind: 'nft' | 'order', id },   // kind amarrado ao type
  version: number,                  // versão do recurso APÓS a mudança (mesmo contador do REST)
  userId?: string,                  // ausente em nft.updated; obrigatório em order.updated
  occurredAt: ISO-8601,
  data }                            // schema por tipo
```

| Evento | `data` | Efeito no cliente |
|---|---|---|
| `nft.updated` | `{ nftId, price, compareAtPrice, available, soldOut, editions[{ id, price, available }] }` | Atualiza detalhe e cards de listas no cache; invalida carrinho e cotação se o NFT estiver no carrinho; anuncia em `aria-live` |
| `order.updated` | `{ orderId, status, transaction, declineReason, updatedAt }` | Atualiza o pedido; `confirmed` → recibo + invalidação do carrinho; `declined` → estado de recusa |

Payload inválido (zod) é descartado e logado; nunca quebra a UI.

## 4. Política de sessão

- **Token opaco** devolvido por register/login, guardado em `localStorage` (`kurio.session`: `{ token, expiresAt }`) para sobreviver a refresh. Trade-off: exposto a XSS; aceitável apenas porque o backend é simulado — em produção real seria cookie `HttpOnly; Secure; SameSite`. Mitigações: CSP/headers da Vercel, nada de `dangerouslySetInnerHTML`, nenhum dado sensível além do token.
- **Boot**: a rota raiz carrega `GET /session` se houver token; 401 → limpa token e segue como visitante. `['session']` é a única query de auth fora do prefixo `['u', userId]`.
- **Rotas privadas** (`_authed`: checkout, perfil, carteiras, favoritos, pedidos): `beforeLoad` sem sessão → `redirect('/login', { search: { redirect: location.href, reason: 'required' } })`.
- **Expiração** (TTL absoluto `expiresAt`; cenários `session.expired` / `session.expire-on-checkout`): interceptor Axios em `401 SESSION_EXPIRED` dispara `sessionExpired` uma única vez (deduplicado entre requisições paralelas) → executa o *teardown* (abaixo) → navega para `/login?redirect=<href atual>&reason=expired`. `401 UNAUTHENTICATED` de `/auth/login` é erro de formulário, não expiração.
- **Contexto preservado**: rascunho do checkout (dados do colecionador, carteira, rede) e a tentativa de compra (`Idempotency-Key` + fingerprint) ficam em `sessionStorage` com chave por `userId`; ao relogar com o **mesmo** usuário o checkout retoma; com outro usuário os rascunhos alheios são ignorados e apagados. O carrinho é servidor-side e permanece.
- **Teardown** (logout, expiração, troca de usuário): `socket.disconnect()` + remoção de listeners → `queryClient.cancelQueries({ queryKey: ['u'] })` → `removeQueries({ queryKey: ['u'] })` → limpa `['session']` e rascunhos → `POST /auth/logout` (best-effort no logout) → reconecta socket como visitante.
- **Senhas**: nunca guardadas em claro; o mock armazena hash PBKDF2 (WebCrypto) com salt por usuário. Credenciais exclusivamente fictícias (README).

## 5. Estado do carrinho

- **Servidor é a fonte da verdade** (mock com persistência em `localStorage`). O cliente não soma totais: `lineTotal`/`subtotal` vêm do carrinho e o **total oficial vem da cotação**.
- **Visitante**: `guestId` UUID v4 em `localStorage` (`kurio.guestId`), enviado em `X-Guest-Id`. Query key `['guest', guestId, 'cart']`.
- **Login/cadastro**: se o carrinho do visitante tem linhas → `POST /cart/merge { guestId }`: soma quantidades por (nftId, editionId), limitadas a `min(available, maxPerOrder)`; reduções voltam em `adjusted[]` e são anunciadas. O servidor apaga o carrinho do visitante (merge repetido = no-op). O cliente descarta o `guestId` e as queries `['guest']`.
- **Linhas** únicas por (nftId, editionId), `quantity` inteira 1..`maxQuantity`; `status` (`ok|price_changed|insufficient|sold_out`) calculado pelo servidor contra o catálogo vivo; `addedUnitPrice` permite "preço alterado de X para Y". Alterar a quantidade (PATCH) reconhece o novo preço.
- **Cupom** é gravado no carrinho (`PUT /cart/coupon`); validade e desconto são decididos pela cotação (pode virar `coupon_expired` depois).
- **Otimismo**: alteração de quantidade (e favoritos) com `onMutate` → snapshot → `setQueryData`; `onError` → rollback + aviso acessível; `onSettled` → invalidate de carrinho e cotação.
- **Pós-compra**: ao confirmar, o servidor subtrai do carrinho exatamente as quantidades do recibo (`receipt.lines[].cartLineId`); itens adicionados depois permanecem. Em falha/recusa nada é removido.

## 6. Cotação, revalidação e idempotência

- `POST /quotes { network }` cota o carrinho atual: `subtotal`, `coupon`, `discount`, `networkFee` (estimada, por rede), `total = subtotal − discount + networkFee`, `issues[]`, `orderable`. Mesma `id` enquanto o carrinho é o mesmo; `version` sobe a cada mudança de preço, estoque, cupom ou taxa.
- Resumo do carrinho e do checkout mostram **somente** valores da cotação. Evento `nft.updated` de item do carrinho → invalida carrinho + cotação → banner "preço/disponibilidade alterados" + resumo atualizado (§7 cenário 1–3).
- Envio: `POST /orders { quoteId, quoteVersion, walletId, connectionId, network, collector }`. O servidor recalcula; divergência → `409 QUOTE_STALE { quote, changes[] }`: a UI substitui a cotação, lista as mudanças e **exige nova confirmação explícita** (§7 cenário 4). Estoque → `409 CONFLICT_AVAILABILITY`.
- **Idempotency-Key**: UUID v4 criado no primeiro clique em "Confirmar compra" para um *fingerprint* = hash(quoteId, quoteVersion, walletId, network, collector). Guardado em `sessionStorage`. Clique repetido: botão desabilitado enquanto pendente **e** mesma chave. Timeout/erro de rede: reenvio automático (até 2×, backoff) com a **mesma chave** → o mock devolve o mesmo pedido (200). Se ainda incerto, `GET /orders?status=pending` recupera. Fingerprint novo (após QUOTE_STALE ou edição) → chave nova. Mesma chave + body diferente → `409 IDEMPOTENCY_CONFLICT { orderId }` (a UI navega para o pedido existente).
- **Estados**: `pending → confirmed | declined` (terminais, nunca regridem). `/orders/$orderId` mostra pendente / confirmado (recibo) / recusado. A confirmação só aparece com `status === 'confirmed'` vindo da simulação (REST ou evento validado) — nunca por inferência do cliente.
- **Recibo** = snapshot imutável gravado na criação (linhas, preços, cupom, taxa, total, carteira, colecionador). Mudanças posteriores no catálogo não o alteram. `transaction.hash`/`explorerUrl` são simulados.
- **Carteira**: o checkout usa as carteiras cadastradas (`walletId`) e uma rede; "conectar" (`POST /wallets/:id/connect`) devolve `connected` ou `rejected` (cenário `wallet.reject`); desconectar invalida o `connectionId` e bloqueia o envio.

## 7. Cache, retries e sincronização (TanStack Query)

| Query key | staleTime | Observações |
|---|---|---|
| `['nfts','list', query]` | 30 s | `placeholderData: keepPreviousData` (paginação sem flash), `signal` → Axios (cancela obsoletas) |
| `['nfts','detail', id]` | 30 s | 404 → estado "NFT inexistente", sem retry |
| `['nfts','featured']` | 5 min | |
| `['session']` | ∞ | refeita no boot e após login |
| `['guest', guestId, 'cart']` / `['u', userId, 'cart']` | 10 s | invalidada por mutations e eventos |
| `['guest'|'u', …, 'quote', network]` | 0 | `gcTime` curto; refeita ao abrir carrinho/revisão e após eventos |
| `['u', userId, 'favorites']` | 5 min | otimista + rollback |
| `['u', userId, 'orders', orderId]` | 0 enquanto `pending`, ∞ quando terminal | `refetchInterval` 5 s **apenas** enquanto pending e socket desconectado (fallback) |
| `['u', userId, 'orders','list', status]` | 0 | recuperação de pedido pendente |
| `['u', userId, 'profile']`, `['u', userId, 'wallets']` | 5 min | |

- **Retries**: queries repetem até 2× **somente** se `ApiError.retryable` (TRANSIENT), backoff exponencial 500 ms → 4 s (respeita `retryAfterMs`). 4xx nunca repetem. Mutations: `retry: 0`, exceto `createOrder` (reenvio com a mesma Idempotency-Key em TRANSIENT). `refetchOnWindowFocus` ligado; `refetchOnReconnect` ligado.
- **Invalidação após mutations**: carrinho → `cart` + `quote`; cupom → `cart` + `quote`; favorito → `favorites`; pedido confirmado → `cart` + `orders`; perfil → `profile` + `['session']` (nome/avatar no header); carteira → `wallets`.
- **Respostas fora de ordem**: chave por parâmetros + `AbortSignal`; resposta de chave antiga nunca sobrescreve a atual.
- **Timeout Axios**: 10 s.

## 8. Reconciliação REST ↔ Socket.IO

1. **Validação**: envelope passa por `realtimeEventSchema`; inválido é descartado.
2. **Isolamento**: evento com `userId` diferente do usuário da sessão atual é descartado (defesa em profundidade além do filtro por token no servidor). O socket é criado por sessão e destruído no teardown, então listeners de sessões anteriores não existem.
3. **Dedupe**: LRU de ids vistos (500); id repetido não reaplica efeitos (inclusive anúncios `aria-live`).
4. **Versão monotônica**: mapa `resourceKey → version` alimentado tanto por eventos quanto por respostas REST (`version` dos recursos). Evento com `version ≤` conhecida é ignorado; pedido em estado terminal nunca é sobrescrito.
5. **Aplicação**: `setQueryData` pontual (detalhe, cards das listas, pedido) + `invalidateQueries` do que o servidor calcula (carrinho, cotação, recibo).
6. **Reconexão**: no `connect` subsequente ao primeiro (ou `io.on('reconnect')`), `invalidateQueries` dos recursos ativos: `['nfts']`, carrinho, cotação, pedidos pendentes. A verdade após um buraco de eventos é sempre o REST.
7. **Ciclo de vida**: listeners registrados em efeitos/serviço com cleanup (`off`) e `socket.disconnect()` no teardown.

## 9. Isolamento por usuário

- Toda query privada começa com `['u', userId]`; visitante usa `['guest', guestId]`; públicas (`['nfts', …]`) não dependem de usuário.
- Troca de usuário = teardown completo (§4) antes de gravar a nova sessão; nenhum dado do usuário anterior permanece em cache, `sessionStorage` (chaves por userId) ou socket.
- O mock filtra `order.updated` pelo token do handshake e devolve 403 para recursos de outro usuário.

## 10. Cenários MSW

Catálogo tipado em `src/api/contracts/scenarios.ts` (`SCENARIOS`, sem dados). Seleção por `?scenario=a,b` (persistido) ou `window.__mock.setScenarios([...])`; `window.__mock.reset()` restaura seed + `default`. Cenários são combináveis.

| Cenário | Cobre (§6) | Efeito esperado |
|---|---|---|
| `default` | sucesso | Fluxos completos, latência fixa curta |
| `catalog.empty` | resultado vazio | Estado vazio no catálogo |
| `latency.slow` | lentidão | Skeletons com shimmer sem CLS |
| `latency.variable` | latência variável | Atraso determinístico 100–1800 ms |
| `catalog.out-of-order` | respostas fora de ordem | Só o resultado da URL atual aparece |
| `network.offline` | indisponibilidade | Erro de rede + retry; socket cai |
| `network.timeout` | timeout | Abort no cliente + retry sem duplicar |
| `http.500.once` | 5xx | Próxima requisição 500; retry recupera |
| `http.503` | 5xx | Catálogo/detalhe em erro até sair |
| `favorites.fail` | 4xx/5xx em mutation | Rollback do otimismo |
| `session.expired` | sessão expirada | Reautenticação com retorno |
| `session.expire-on-checkout` | sessão expirada | Expira no POST /orders; retoma checkout |
| `auth.forbidden` | acesso não autorizado | 403 em recurso alheio |
| `register.email-taken` | conflito de cadastro | 409 no campo e-mail |
| `forms.server-validation` | validação de formulário | fieldErrors da API nos campos |
| `coupon.invalid` / `coupon.expired` | cupom | Mensagem específica |
| `checkout.price-changed` | preço alterado | nft.updated + QUOTE_STALE + reconfirmação |
| `checkout.sold-out` | edição esgotada | nft.updated + CONFLICT_AVAILABILITY |
| `order.timeout-after-create` | timeout pós-criação | Mesmo pedido via Idempotency-Key |
| `payment.confirmed` / `payment.declined` | pagamento | order.updated confirmed / declined |
| `payment.hold` | §7 pedido pendente | Pendente até `__mock.settleOrder` |
| `wallet.reject` | §3 recusa de carteira | `{ status: 'rejected' }` |

Superfície de controle (`MockControl`): `reset`, `setScenarios`, `getScenarios`, `emit`, `updateNft` (altera estado **e** emite o evento correspondente), `drop`, `settleOrder`. Testes disparam eventos só por ela — os frames atravessam o `socket.io-client`, nunca o cache.

## 11. Transporte de tempo real e limitações (spike 1)

Transporte: MSW `ws.link(VITE_SOCKET_URL)` + `@mswjs/socket.io-binding@0.2.0` (exige `msw@2.15.0`, fixado) sobre o WebSocket interceptado no **próprio contexto da página** (não no service worker).
- `main.tsx` inicia o MSW **antes** de importar o app: engine.io-client captura `globalThis.WebSocket` ao carregar.
- `ws.link` usa a **origem** pura: o MSW remove `/socket.io/` do URL antes de casar.
- O binding forja o handshake (`pingInterval 25000`) mas não envia ping: o mock envia `'2'` a cada 20 s, senão o cliente cai em ~30 s.
- O binding ignora o payload do CONNECT: o mock lê `auth.token` do frame bruto `40{…}`.
- Só namespace padrão, só eventos de texto, **sem acks e sem binário** → `transports: ['websocket']` (sem fallback long-polling) e protocolo da app sem acks.
- "Offline" do socket é simulado pelo mock (fecha conexões e recusa novas), não por queda real de rede.
- O service worker do MSW exige HTTPS ou localhost; no build de demonstração ele é registrado na primeira visita (impacto em Lighthouse documentado na F4).

## 12. Decisões de UX

- Valores em ETH exibidos com ponto decimal e precisão integral (mínimo 2 casas), como no Figma (`26.846 ETH`); `formatEth` arredonda só quando `maxDecimals` é pedido explicitamente.
- Stepper de quantidade limitado a `maxQuantity` da edição; edição esgotada aparece desabilitada com texto (não só cor).
- No pagamento, os campos de carteira do layout (rede, tipo, endereço) são preenchidos a partir da carteira cadastrada escolhida ("Usar outra carteira?" alterna para a secundária); sem carteira cadastrada, CTA leva a `/wallets` preservando o checkout.
- Ações fora do escopo (Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados, Suporte, newsletter, login social) não simulam sucesso: ficam desabilitadas/rotuladas "Em breve" ou levam a uma página que declara indisponibilidade. Detalhe por slice.

## 13. Desvios do Figma

_(vazio por ora — cada desvio é registrado aqui no momento em que acontece, com frame, motivo e alternativa.)_

## 14. Changelog de contratos

| Versão | Data | Mudança | Motivo | Impacto |
|---|---|---|---|---|
| 1.0.0 | 2026-11-03 | Versão inicial congelada: common, errors, auth, nfts, favorites, cart, quote, orders, profile, wallets, events, endpoints, scenarios | F1a | — |
