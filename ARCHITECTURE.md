# ARCHITECTURE — Marketplace de NFTs (KURIO)

Requisitos oficiais: [docs/challenge.md](docs/challenge.md). Este documento registra contratos, políticas e decisões **no momento em que são tomadas**.
Contratos: **v1.2.0, congelados** (v1.0.0 em 2026-11-03; v1.1.0 em 2026-11-03, F1c; v1.2.0 em 2026-11-03, fundação volta 2) (`src/api/contracts`). Qualquer mudança exige entrada em [Changelog de contratos](#14-changelog-de-contratos).

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
- Regra eliminatória verificada por ESLint (`eslint.config.js`): `no-restricted-imports` impede importar `**/mocks/**`/`@/mocks/**` fora de `src/mocks` (exceção: `src/main.tsx`, que liga o worker); vale também para `tests/`, que falam com o mock apenas via `window.__mock` (tipado por `MockControl`). Desde a volta 2 da fundação, `no-restricted-syntax` (`ImportExpression[source.value=/mocks/]`) também barra `import()` dinâmico da camada de mocks.
- ESLint com tipos em `src` (fora de `src/mocks`): `no-floating-promises` e `no-misused-promises`. Promessa ignorada de propósito leva `void` explícito.
- `src/lib` depende de `src/api/contracts`, e nunca o contrário: `money.ts` importa `ETH_PATTERN` de `contracts/common`, e os contratos comparam ETH com `compareEthStrings`, sem float.
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
| Carrinho | getCart | GET `/cart` | — | `Cart` | VALIDATION (sem credencial, v1.2.0) |
| | addCartItem | POST `/cart/items` | `{ nftId, editionId, quantity }` | `Cart` | VALIDATION, NOT_FOUND, CONFLICT_AVAILABILITY |
| | updateCartItem | PATCH `/cart/items/:lineId` | `{ quantity }` (absoluta) | `Cart` | VALIDATION, NOT_FOUND, CONFLICT_AVAILABILITY |
| | removeCartItem | DELETE `/cart/items/:lineId` | — | `Cart` | VALIDATION (v1.2.0), NOT_FOUND |
| | mergeCart | POST `/cart/merge` | `{ guestId }` | `{ cart, adjusted[] }` | VALIDATION |
| | applyCoupon | PUT `/cart/coupon` | `{ code }` | `Cart` | VALIDATION, COUPON_INVALID, COUPON_EXPIRED |
| | removeCoupon | DELETE `/cart/coupon` | — | `Cart` | VALIDATION (v1.2.0) |
| Cotação | createQuote | POST `/quotes` | `{ network }` | `Quote` | VALIDATION |
| Pedidos | createOrder | POST `/orders` + `Idempotency-Key` | `CreateOrderRequest` | `Order` (201 novo · 200 replay) | VALIDATION, NOT_FOUND (`walletId` inexistente, v1.2.0), FORBIDDEN, QUOTE_STALE, CONFLICT_AVAILABILITY, IDEMPOTENCY_CONFLICT |
| | getOrder | GET `/orders/:orderId` | — | `Order` | NOT_FOUND, FORBIDDEN |
| | listOrders | GET `/orders?status=` | — | `{ items: Order[] }` | — |
| Perfil | getProfile | GET `/profile` | — | `Profile` | — |
| | updateProfile | PATCH `/profile` | `UpdateProfileRequest` (+ `version`) | `Profile` | VALIDATION, EMAIL_TAKEN, CONFLICT_VERSION |
| | uploadAvatar | PUT `/profile/avatar` | multipart `file` (PNG/JPEG/WebP ≤ 2 MB) | `Profile` | VALIDATION |
| | removeAvatar | DELETE `/profile/avatar` | — | `Profile` | — |
| | changePassword | POST `/profile/password` | `{ currentPassword, newPassword, confirmPassword }` | 204 | VALIDATION (`currentPassword` incorreta vem em fieldErrors) |
| Carteiras | listWallets | GET `/wallets` | — | `{ primary, secondary }` | — |
| | createWallet | POST `/wallets` | `CreateWalletRequest` (slot) | `Wallet` (201) | VALIDATION (inclui slot ocupado) |
| | updateWallet | PATCH `/wallets/:walletId` | `UpdateWalletRequest` (+ `version`) | `Wallet` | VALIDATION, NOT_FOUND, FORBIDDEN, CONFLICT_VERSION |
| | connectWallet | POST `/wallets/:walletId/connect` | `{ network }` | `WalletConnection` (`connected` \| `rejected`) | NOT_FOUND, FORBIDDEN |
| | disconnectWallet | DELETE `/wallets/:walletId/connection` | — | 204 | NOT_FOUND |

Todo endpoint `session` pode responder UNAUTHENTICATED/SESSION_EXPIRED; todo endpoint pode falhar com TRANSIENT. Endpoints `guest` chamados sem `Authorization` e sem `X-Guest-Id` válido respondem `422 VALIDATION` com `fieldErrors['X-Guest-Id']` (declarado na v1.2.0). O cliente nunca chega a esse caso: o carrinho de visitante só é consultado com um `guestId` já criado.
O cliente valida a query (`def.query`) e o body (`def.body`) antes de enviar. Se a validação falhar, a requisição não sai e o erro vem como `ApiError VALIDATION` com status 0. `ordersApi.createOrder` com `Idempotency-Key` que não seja UUID também resulta em `ApiError VALIDATION` (`fieldErrors['Idempotency-Key']`), nunca em `ZodError`.
`POST /orders` exige `Idempotency-Key` UUID v4: ausente/inválida → `422 VALIDATION` com `fieldErrors['Idempotency-Key']` (v1.1.0). O cliente valida a chave antes de enviar (`ordersApi.createOrder`).

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
| CONFLICT_VERSION (v1.1.0) | 409 | `resource { kind: profile\|wallet, id }`, `currentVersion` | `version` enviado no PATCH /profile ou PATCH /wallets/:id não é o atual (concorrência otimista); a UI recarrega o recurso e pede nova confirmação |
| EMAIL_TAKEN | 409 | `fieldErrors.email` | Cadastro/perfil |
| COUPON_INVALID | 422 | `couponCode` | |
| COUPON_EXPIRED | 422 | `couponCode`, `expiredAt` | |
| TRANSIENT | 503 (também 500/502/504; 0 sem resposta) | `reason: server\|network\|timeout`, `retryAfterMs?` | Único código com retry automático |

`ApiError` (classe) é o único tipo de erro lançado pela camada de API: `code`, `status`, `payload` tipado, `retryable`, `fieldErrors`, `is(code)`. O Axios converte erro de rede em `TRANSIENT/network` e `ECONNABORTED`/timeout em `TRANSIENT/timeout`. `errorBody(payload)` (usado pelos mocks) mantém body e status coerentes.

### 2.4 Search params (TanStack Router `validateSearch`)
- `/` → `catalogSearchSchema`: `q?`, `tab` (`all|new|trending`), `categories[]`, `networks[]`, `priceMin?`, `priceMax?` (ETH string), `sort` (`recent|price_asc|price_desc|name_asc`), `page` (≥1). Valores inválidos caem no default (`.catch`) em vez de quebrar a página; listas são deduplicadas e ordenadas (chave de cache estável); faixa invertida é trocada. **Toda mudança de filtro/busca/ordenação/aba zera `page`.** Mapeado 1:1 para `GET /nfts` via `toNftListParams` (listas viram `a,b`); `pageSize` fixo 9 (grade 3×3 do Figma).
- `/nft/$id` → `nftDetailSearchSchema`: `edition?`.
- `/login`, `/register` → `authSearchSchema`: `redirect?` (só path relativo de mesma origem), `reason?` (`expired|required`). `safeRedirectSchema` (endurecido na v1.2.0) exige um único `/` inicial e rejeita barra invertida e qualquer caractere de controle C0 ou DEL. Isso importa porque os parsers WHATWG descartam TAB/LF/CR, e `"/\t/evil.com"` viraria `//evil.com`. O valor também é resolvido contra uma origem sentinela (`new URL(v, base)`) e é rejeitado se a origem mudar. A saída é normalizada para `pathname + search + hash`, e a normalização que gera `//` (como em `/.//evil.com`) também é rejeitada. Na S2, a navegação pós-login deve usar só `router.navigate({ to: redirect })`.
- **URLs renderizáveis (v1.2.0)**: `transaction.explorerUrl` usa `httpsUrlSchema` (só `https:`, host de domínio). `avatarUrl` (usuário e perfil) usa `avatarUrlSchema`, que aceita `https:`, path absoluto de mesma origem ou `data:image/(png|jpeg|webp);base64,…`. Ficam de fora `javascript:`, `data:text/html`, `data:image/svg+xml` e `blob:`. Links externos levam `rel="noopener noreferrer"`.

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

- **Token opaco** devolvido por register/login, guardado em `localStorage` (`kurio.session`: `{ token, expiresAt }`) para sobreviver a refresh. Trade-off: exposto a XSS; aceitável apenas porque o backend é simulado — em produção real seria cookie `HttpOnly; Secure; SameSite`. Mitigações: CSP e headers servidos pela Vercel (ver "Headers de segurança" abaixo), nada de `dangerouslySetInnerHTML` e nenhum dado sensível além do token.
- **Headers de segurança (volta 2)**: `vercel.json` envia `Content-Security-Policy` (`default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self' wss://realtime.nft-mock.local; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`), `Permissions-Policy` (câmera, microfone, geolocalização, pagamento, USB, serial, Bluetooth e HID desligados), `Cross-Origin-Opener-Policy: same-origin`, `nosniff`, `Referrer-Policy` e `X-Frame-Options: DENY`. O `vite preview` lê o mesmo bloco de `vercel.json` (`preview.headers` em `vite.config.ts`), então toda a suíte E2E roda sob a CSP de produção. `tests/e2e/06-csp.spec.ts` confere os headers e verifica que não há nenhum `securitypolicyviolation` com MSW, service worker, socket e Radix. `'unsafe-inline'` em `style-src` existe porque o Radix e o sonner usam `style` inline. **Avatar × CSP (R7)**: o contrato aceita avatar `https:` (v1.2.0), mas `img-src` só permite `'self' data: blob:`. Decisão: a CSP **não** foi relaxada e o contrato não mudou. A UI (`src/features/profile/avatar.tsx`, `renderableAvatarSrc`) só renderiza `<img>` para `data:image/*` (o que o upload simulado devolve) ou caminho de mesma origem; qualquer `https:` cai no ícone de iniciais, nunca numa imagem quebrada. Se um backend real servir avatares por host próprio, esse host entra em `img-src`. O zod roda em modo `jitless` (`src/lib/zod-config.ts`, importado primeiro por `main.tsx`), então não precisa de `'unsafe-eval'`. O teste harness dos mocks (`mocks.spec.ts`) injeta `socket.io-client` por `<script>` inline e por isso roda nos projetos `*-harness`, com `bypassCSP`. As specs do app não usam bypass.
- **Boot**: a rota raiz carrega `GET /session` se houver token; 401 → limpa token e segue como visitante. `['session']` é a única query de auth fora do prefixo `['u', userId]`.
- **Rotas privadas** (`_authed`: checkout, perfil, carteiras, favoritos, pedidos): `beforeLoad` sem sessão → `redirect('/login', { search: { redirect: location.href, reason: 'required' } })`; `reason: 'expired'` quando a última sessão da aba terminou por expiração (volta 3).
- **Expiração** (TTL absoluto `expiresAt`; cenários `session.expired` / `session.expire-on-checkout`): interceptor Axios em `401 SESSION_EXPIRED` dispara `sessionExpired` uma única vez (deduplicado entre requisições paralelas) → executa o *teardown* (abaixo) → navega para `/login?redirect=<href atual>&reason=expired`. `401 UNAUTHENTICATED` de `/auth/login` é erro de formulário, não expiração.
- **Contexto preservado**: rascunho do checkout (dados do colecionador, carteira, rede) e a tentativa de compra (`Idempotency-Key` + fingerprint) ficam em `sessionStorage` com chave por `userId`; ao relogar com o **mesmo** usuário o checkout retoma; com outro usuário os rascunhos alheios são ignorados e apagados. O carrinho é servidor-side e permanece.
- **Teardown** (logout, expiração, troca de usuário): `socket.disconnect()` + remoção de listeners → `queryClient.cancelQueries({ queryKey: ['u'] })` → `removeQueries({ queryKey: ['u'] })` → limpa `['session']` e rascunhos → `POST /auth/logout` (best-effort no logout) → reconecta socket como visitante.
- **Implementação (F1c)**: `src/session/store.ts` (token/expiresAt e `guestId` validados com zod ao ler; token localmente expirado **não** é descartado na leitura desde a volta 3, ver "Expiração natural" abaixo; rascunhos por usuário com prefixo `kurio.u.<userId>.`), `src/queries/session.ts` (`sessionQueryOptions`, `teardownSession(qc, 'logout'|'expired'|'switch')`, `establishSession(qc, session)` para S2), `src/api/client.ts` (`setSessionInvalidHandler`, que substituiu `setSessionExpiredHandler` na volta 2; disparo **uma vez por token**, só para o token atual). O `GET /session` do boot usa `silentSessionExpiry`: token vencido no boot só vira visitante, sem fluxo de reautenticação. Na expiração os rascunhos do **mesmo** usuário ficam (retomar checkout); no logout todos são apagados. `redirect` é sempre revalidado com `safeRedirectSchema` antes de navegar (guard e handler de expiração).
- **Volta 2 da fundação: sessão entre abas, credencial amarrada à key e 401**
  - *Invariante*: o token do `['session']` em cache é sempre o token de `kurio.session`. `bootstrap.tsx` assina `subscribeSession`, que recebe mudanças desta aba e o evento `storage` das outras. Quando os dois divergem, `syncSessionWithStorage(qc)` roda, serializado e adiado para uma microtask, para que fluxos da própria aba que gravam storage e cache em sequência sejam vistos já no estado final. O passo a passo é: teardown `'external'` (socket, `cancelQueries` e `removeQueries(['u'])`, `['session'] = null`, sem tocar o storage, que já tem o estado da outra aba), depois `fetchQuery(['session'])` com o token novo, depois `router.invalidate()`. Logout na aba A, portanto, limpa a aba B (UI, cache privado e socket), e B não entra mais em rota privada. Teste permanente: `tests/e2e/20-session-tabs.spec.ts`.
  - *Guard*: `_authed` chama `syncSessionWithStorage` antes de decidir e só aceita a sessão se `session.token === getToken()`.
  - *Credencial do dono da key*: `CallOptions.as: { token } | { guestId }`. O interceptor usa essa credencial explícita em vez do storage. Toda query `['u', userId, …]` ou `['guest', guestId, …]` passa por `ownedQueryFn(owner, fn)` (`src/queries/owner.ts`), que envia a credencial do dono e confere antes e depois da resposta se ele continua sendo a identidade atual. Se não for, a resposta é descartada (lança `UNAUTHENTICATED` com status 0) e não é gravada sob a key do dono. `GET /session` também amarra o token lido uma única vez e só apaga do storage o token que ele mesmo conferiu.
  - *401 com Bearer* (`setSessionInvalidHandler`): `SESSION_EXPIRED` leva ao teardown `'expired'` e a `/login?reason=expired&redirect=…`. `UNAUTHENTICATED` (token revogado ou desconhecido, como logout em outra aba ou reset do mock) leva ao teardown `'unauthenticated'` e a `router.invalidate()`, e o guard manda rotas privadas para o login. O disparo só acontece uma vez por token e **só se o token da requisição ainda for o atual**: um 401 atrasado de uma sessão já substituída é ignorado. Endpoints `public` (como o login) nunca disparam o fluxo.
  - *Logout* (`logoutSession(qc)`, deduplicado; `useLogout()` em `src/session/hooks.ts`, com `isPending` para desabilitar o item): o `POST /auth/logout` é sempre `silentSessionExpiry` e leva o token da sessão desmontada (`as: { token }`). Sair com o token já vencido termina em `/`, nunca no fluxo de expiração.
  - *Login/cadastro na S2*: `useEstablishSession()` → `establishSessionAndMergeCart(qc, session)`. A sequência é: teardown do usuário anterior se for outro, gravação do token e de `['session']`, `POST /cart/merge { guestId }` com o token novo, `['u', id, 'cart']` preenchido com o carrinho mesclado, `clearGuestId()`, remoção de `['guest']` e por fim `router.invalidate()`. Devolve `adjusted[]` para anúncio e `mergeError` (nesse caso o `guestId` é mantido para nova tentativa). Também é deduplicado contra duplo envio. Quem chama navega para o `redirect` validado.
  - *Deduplicação (R8)*: `useEstablishSession` e `useLogout` guardam a promessa em andamento num `useRef` do hook (`inflight.current ??= …`), então um duplo clique ou um segundo `Enter` durante o envio devolve a mesma promessa e executa o teardown/merge **uma vez**; `isPending` desabilita o botão. A deduplicação é por instância do hook (uma tela), e `logoutSession` tem uma deduplicação própria em módulo, para dois menus abertos. Na S2 o `useFinishAuth` (`src/features/auth/useAuthSubmit.ts`) é o único consumidor do `useEstablishSession`, e o `mutateAsync` do login/cadastro é protegido pelo `isSubmitting` do react-hook-form.
- **Volta 3 da fundação: expiração natural pelo relógio local** (achado N1 do revisor; desafio §3 "trate expiração durante a navegação e durante o checkout, preservando o contexto para retomada")
  - *Store*: `readStoredSession()` devolve `{ token, expiresAt, expired } | null`. `null` = sessão ausente ou adulterada; `expired: true` = o relógio local passou do `expiresAt`. `getToken()` devolve o token armazenado **mesmo vencido**. `getStoredSession()` foi removido.
  - *Requisições*: o interceptor (modo ambiente, usado pelas mutations) e `isCurrentOwner` (queries `['u', …]`) usam o token vencido. A requisição sai, o servidor responde `401 SESSION_EXPIRED` e o fluxo `expired` assume. Antes, o cliente mandava a requisição sem Bearer e recebia um 401 genérico, ou a query falhava em silêncio com "owner changed".
  - *Sync e guard*: `syncSessionWithStorage` detecta a sessão em cache vencida localmente, com o mesmo token no storage ou com o storage já limpo pela expiração de outra aba, e faz o teardown `'expired'`, não `'external'`. O `_authed` redireciona para `/login?reason=expired&redirect=<destino>`. A flag `sessionExpiredRecently()` em `src/queries/session.ts` diz ao guard que a sessão terminou por expiração. Ela é ligada pelo teardown `expired` e pelo boot com token vencido, e desligada por qualquer outro teardown e pelo login.
  - *Boot com token vencido*: o `GET /session` não é chamado. O token é apagado e a aba segue como visitante. Os rascunhos ficam. Se a primeira rota for privada, o guard responde `reason=expired`.
  - *Timer proativo* (`src/bootstrap.tsx`): armado em `expiresAt` com clamp em 2^31−1 ms (num TTL maior ele só se rearma ao disparar). É rearmado em `subscribeSession` (login, logout, outra aba) e no `visibilitychange` para `visible`, porque o navegador congela timers em aba de fundo ou com a máquina suspensa. O `bootstrap` devolve um cleanup que remove o timer, os listeners e o handler. Ao disparar numa **rota privada** (como o checkout aberto), chama `router.invalidate()`: o guard faz o teardown `expired` e redireciona com `redirect` = rota atual **antes** da próxima requisição. Nenhum `POST /orders` sai com sessão vencida.
  - *Rota pública (decisão de UX; substituída no endurecimento pré-slices, ver abaixo)*: na volta 3 a expiração numa página pública não fazia nada até a próxima ação privada, e o header continuava mostrando o usuário (sessão "fantasma", achados F2 do revisor e #14 de segurança).
  - *Rascunhos*: `teardownSession('expired' | 'unauthenticated')` preserva os do mesmo usuário. `'external'` com uma sessão nova no storage também preserva os do usuário anterior, e o sync apaga esses rascunhos depois de resolver a sessão nova, **se** ela for de outro usuário (`clearUserDrafts(next.user.id)`). `'external'` com o storage vazio, que é logout em outra aba, apaga todos.
  - *Preload sem efeito colateral*: com `defaultPreload: 'intent'`, o `beforeLoad` em preload (hover ou toque num link privado) só confere o cache contra o storage e nunca faz teardown. Antes, o preload desmontava a sessão vencida e o link que a pessoa ia clicar sumia, o que aparecia no menu mobile.
  - *Limitação*: com relógio local adiantado em relação ao servidor, o cliente expira a sessão antes do servidor. A sessão nunca é estendida além do `expiresAt` que o servidor emitiu.
  - *Testes permanentes*: `tests/e2e/21-session-clock-expiry.spec.ts` (desktop e mobile, com `page.clock`); a lista atual está no endurecimento pré-slices, abaixo.
  - *Chave de lista do catálogo (R3)*: `queryKeys.nfts.list` só aceita `NormalizedNftListQuery` (tipo nominal), que sai de `normalizeNftListQuery` (agora em `src/queries/keys.ts`, reexportado por `src/queries/nfts.ts`). Não há mudança de contrato nem de fio.
- **Endurecimento pré-slices (depois da volta 3): teardown silencioso em página pública** (F2/#14, F3, #13)
  - *Página pública*: quando o timer de `expiresAt` dispara, ou quando um GET privado de fundo (refetch ao focar, reconexão) recebe `401 SESSION_EXPIRED` fora de `/_authed`, `bootstrap.tsx` faz o teardown `'expired'` **silencioso** (`expireSilently`, deduplicado entre timer e 401): socket desligado e reaberto como visitante, `['u']` cancelado e removido, token apagado, `['session'] = null` (o header volta ao de visitante), rascunhos do mesmo usuário mantidos, flag `sessionExpiredRecently()` ligada. **Não há redirecionamento.** Em seguida aparece um toast não modal (sonner, dentro da região `aria-live="polite"` "Notificações") com "Sua sessão expirou." e o link **Entrar** → `/login?reason=expired&redirect=<rota atual>`. O link lê a rota atual quando é renderizado (o `redirect` acompanha a navegação) e é validado por `safeRedirectSchema`; em `/login` ele não leva `redirect`. O toast fica até ser fechado (botão de fechar) ou até uma nova sessão ser gravada (`subscribeSession` chama `dismissSessionExpiredToast`). Componente: `src/components/layout/SessionExpiredToast.tsx`.
  - *Rota privada e mutations*: sem mudança. Rota privada → guard com `reason=expired` e `redirect` = rota atual; mutation com `401 SESSION_EXPIRED` → teardown e login com a página atual. A próxima navegação privada depois do teardown silencioso também responde `reason=expired`, pela flag.
  - *Motivo*: a pessoa que está vendo o catálogo não é tirada da página, mas a tela deixa de mostrar uma identidade que o servidor já não aceita (importante em dispositivo compartilhado e para a S3, que renderiza `/cart` público a partir do cache).
  - *Rascunhos (#13, F3)*: o dono da aba é resolvido sempre que um `GET /session` dá certo (boot ou sync): `sessionQueryOptions` chama `clearUserDrafts(session.user.id)`, e `syncSessionWithStorage` faz o mesmo mesmo com `cached === null` (sessão já desmontada pela expiração). Assim o rascunho de alice sai da aba quando bob entra por outra aba ou quando a aba sobe com a sessão de bob no storage, e fica quando a própria alice volta. `teardownSession('expired' | 'unauthenticated')` sem sessão em cache não apaga nada (antes apagava todos os rascunhos).
  - *Testes permanentes*: `21-session-clock-expiry.spec.ts`: (1) timer em página pública → teardown silencioso, toast na região `aria-live`, "Entrar" → `reason=expired&redirect=/`, rascunho mantido; (2) depois disso, link privado do rodapé → `reason=expired&redirect=/profile`; (3) checkout aberto → timer redireciona com `redirect=/checkout`, nenhum `POST /orders`; (4) só o relógio de parede avança (`setSystemTime`) e o refetch-on-focus do carrinho leva `Bearer <token>` → `401 SESSION_EXPIRED` → teardown silencioso. `20-session-tabs.spec.ts`, bloco "rascunhos por usuário depois da expiração": bob por outra aba, alice por outra aba e boot com bob no storage. Evidência do revisor V1/V4 atualizada.
  - *Testes (F1, lado teste)*: `loginViaApi` (`tests/fixtures.ts`) espera `window.__mock` depois do `reload`, e o teste de CSP de `qa-volta2.spec.ts` virou dois (visitante e logado), com `test.slow()`.
- **Senhas**: nunca guardadas em claro; o mock armazena hash SHA-256 (WebCrypto `crypto.subtle.digest`) de `salt + senha`, com salt por usuário (como pede o briefing). Em produção real seria um KDF lento (Argon2/scrypt/PBKDF2) no servidor. Credenciais exclusivamente fictícias (README).

## 5. Estado do carrinho

- **Servidor é a fonte da verdade** (mock com persistência em `localStorage`). O cliente não soma totais: `lineTotal`/`subtotal` vêm do carrinho e o **total oficial vem da cotação**.
- **Visitante**: `guestId` UUID v4 em `localStorage` (`kurio.guestId`), enviado em `X-Guest-Id`. Query key `['guest', guestId, 'cart']`. O id é reativo: `subscribeGuestId` e `useGuestId()` usam `useSyncExternalStore` e ouvem também as outras abas. A S3 deve chamar `ensureGuestId()` **antes** da primeira mutation de visitante, para que o dono e a key existam antes da requisição. Sem dono, `useCart()` usa `queryFn: skipToken` sob `['cart', 'none']` e não faz requisição (o placeholder `['guest','none','cart']` foi removido).
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
| `['u', userId, 'orders', 'detail', orderId]` | 0 enquanto `pending`, ∞ quando terminal | `refetchInterval` 5 s **apenas** enquanto pending e socket desconectado (fallback) |
| `['u', userId, 'orders','list', status]` | 0 | recuperação de pedido pendente |
| `['u', userId, 'profile']`, `['u', userId, 'wallets']` | 5 min | `src/queries/account.ts`: `ownedQueryFn` + `keepNewest`; mutations levam o token do usuário que as iniciou (`as`) e só escrevem no cache se esse usuário ainda for o atual; perfil também atualiza `['session']` (nome/avatar no header); conflito 409 → `invalidateQueries` do recurso |

- **Regressão visual no CI (§7.1, volta 2)**: no CI, `playwright.config.ts` usa `updateSnapshots: 'none'`, então um baseline ausente ou diferente **reprova** o passo visual. Antes, com `'missing'`, o CI gravava o baseline e passava sem comparar nada. As baselines são por plataforma (`tests/__screenshots__/{platform}`). Hoje só existem as `win32` (geradas localmente). As `linux` saem do workflow manual `.github/workflows/visual-baselines.yml` (`workflow_dispatch`: build mais `--grep @visual --update-snapshots=all` no mesmo `ubuntu-latest` do verify), que as publica como artifact `visual-baselines-linux`. O orquestrador baixa, revisa e commita em `tests/__screenshots__/linux/`. **Até esse commit, o job `verify` do CI fica vermelho no passo visual de propósito**: a regressão visual não passa sem comparação. As actions são fixadas por SHA (checkout v4.2.2, setup-node v4.4.0, upload-artifact v4.6.2).
- **Retries**: queries repetem até 2× **somente** se `ApiError.retryable` (TRANSIENT) **e** a falha é de transporte/5xx (`status` 0 ou ≥ 500) — um 2xx fora do contrato vira TRANSIENT/server mas não é repetido; backoff exponencial 500 ms → 4 s (respeita `retryAfterMs`). 4xx nunca repetem. Mutations: `retry: 0`, exceto `createOrder` (reenvio com a mesma Idempotency-Key em TRANSIENT). `refetchOnWindowFocus` ligado; `refetchOnReconnect` ligado.
- **Invalidação após mutations**: carrinho → `cart` + `quote`; cupom → `cart` + `quote`; favorito → `favorites`; pedido confirmado → `cart` + `orders`; perfil → `profile` + `['session']` (nome/avatar no header); carteira → `wallets`.
- **Respostas fora de ordem**: chave por parâmetros + `AbortSignal`; resposta de chave antiga nunca sobrescreve a atual.
- **Timeout Axios**: 10 s.
- **Normalização (F1c, `src/api/client.ts`)**: corpo de erro validado com `apiErrorBodySchema`; fora do contrato → classificado só pelo status (401/403/404 → código correspondente; demais → TRANSIENT/server com o status real). Sem resposta → TRANSIENT `network` ou `timeout` (status 0). `CanceledError` (abort) é o único erro que não vira `ApiError`. Body JSON é validado com o schema de request **antes** de sair (falha → `ApiError VALIDATION` com `fieldErrors` dos issues do zod, status 0). Resposta 2xx que falha no schema → log + TRANSIENT/server com o status 2xx (não repetida). Headers por requisição: `X-Request-Id` (UUID), `Authorization` ou `X-Guest-Id` conforme `auth` da tabela, `Idempotency-Key` em `createOrder`.
- **Escrita monotônica (volta 2)**: `src/queries/versioned.ts` define `keepNewest`, usado como `structuralSharing` por todo recurso versionado. Uma escrita não pode baixar a `version` do mesmo recurso, e um pedido `confirmed`/`declined` nunca volta a outro status. Listas e objetos são percorridos, então cada card ou item recebe a mesma proteção. Os `queryOptions` tipados são `nftQueries.list/featured/detail` (`src/queries/nfts.ts`; a key da lista é `nftListQuerySchema.parse(query)`, então `{}` e `{ pageSize: 9 }` caem na mesma entrada) e `orderQueries.detail/list` (`src/queries/orders.ts`; `staleTime` é ∞ para pedido terminal e 0 para pendente). As keys de detalhe, featured, pedido e carrinho carregam o tipo do dado (`DataTag`), e `getQueryData`/`setQueryData` inferem esse tipo. Perfil e carteiras devem usar `keepNewest` quando a S5 criar os `queryOptions` deles.
- **Query keys (F1c)**: `src/queries/keys.ts` é o único lugar que soletra keys; o detalhe de pedido usa `['u', userId, 'orders', 'detail', orderId]` para não colidir com `['u', userId, 'orders', 'list', status]`. `queryKeys.owner({kind:'user'|'guest'})` gera `cart`/`quote` de usuário ou visitante.

## 8. Reconciliação REST ↔ Socket.IO

1. **Validação**: envelope passa por `realtimeEventSchema`; inválido é descartado.
2. **Isolamento**: evento com `userId` diferente do usuário da sessão atual é descartado (defesa em profundidade além do filtro por token no servidor). O socket é criado por sessão e destruído no teardown, então listeners de sessões anteriores não existem.
3. **Dedupe**: LRU de ids vistos (500); id repetido não reaplica efeitos (inclusive anúncios `aria-live`).
4. **Versão monotônica**: mapa `resourceKey → version` alimentado tanto por eventos quanto por respostas REST (`version` dos recursos). Evento com `version ≤` conhecida é ignorado; pedido em estado terminal nunca é sobrescrito.
5. **Aplicação**: `setQueryData` pontual (detalhe, cards das listas, pedido) + `invalidateQueries` do que o servidor calcula (carrinho, cotação, recibo).
6. **Reconexão**: no `connect` subsequente ao primeiro (ou `io.on('reconnect')`), `invalidateQueries` dos recursos ativos: `['nfts']`, carrinho, cotação, pedidos pendentes. A verdade após um buraco de eventos é sempre o REST.
7. **Ciclo de vida**: listeners registrados em efeitos/serviço com cleanup (`off`) e `socket.disconnect()` no teardown.
8. **REST em voo × evento (volta 2)**: o reconciler guarda o último evento aplicado de cada recurso (LRU de 500) e observa o `QueryCache`. Quando uma resposta de **fetch** (escrita não manual) chega com `version` menor que a desse evento, o evento é reaplicado na hora, antes de qualquer leitura. Isso cobre detalhe e cards de NFT (lista e featured) e o detalhe do pedido, e um pedido terminal nunca volta a pendente. Um evento que encontra o recurso ainda carregando (sem dado em cache) é guardado do mesmo jeito, e a primeira resposta não consegue apagá-lo. Pedido que não está nem em cache nem carregando é invalidado. O `keepNewest` dos `queryOptions` funciona como segunda proteção. Evidência: `node reports/fundacao/revisor-evidence/reconcile-race.mjs` (as duas corridas terminam em `confirmed v2` e `2.0 v2`) e o teste permanente `tests/e2e/05-unit-cache.spec.ts`, que roda em Node contra o `QueryClient` real.
9. **Robustez**: o socket é tipado (`Socket<ServerToClientEvents, ClientToServerEvents>`), mas o payload continua passando pelo zod. Cada listener de `onEvent` roda isolado em `try/catch`, para que a falha de uma slice não derrube as outras. `stop()` chama `reconciler.dispose()`, que cancela a assinatura do cache.

Implementação (F1c): `src/realtime/reconcile.ts` (`createReconciler`: lógica pura sobre o `QueryClient`, devolve `applied | invalid | duplicate | foreign | stale`; a versão conhecida é `max(mapa de eventos, version em cache)`, então respostas REST já protegem contra eventos atrasados sem chamada extra a `noteVersion`) e `src/realtime/socket.ts` (`createRealtimeManager`/`realtime`: um socket por vez; `start()` fecha o anterior; frames de um socket já substituído são ignorados; `onEvent` entrega só eventos `applied`, para anúncios `aria-live` das slices). `RealtimeBridge` (na raiz) reabre o socket quando o token muda e expõe um `<div hidden data-testid="realtime-probe">` com `data-status/user/connections/applied/last-event/last-outcome` — gancho de teste somente leitura, sem interação e fora da árvore de acessibilidade.

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

Superfície de controle (`MockControl`): `reset(scenarios?)` (v1.1.0: seleciona os cenários junto com o reset), `setScenarios`, `getScenarios`, `emit`, `updateNft` (altera estado **e** emite o evento correspondente), `drop`, `settleOrder`. Testes disparam eventos só por ela — os frames atravessam o `socket.io-client`, nunca o cache. O `payload` de `emit` deve ser o **envelope completo** de `events.ts` (`RealtimeEvent`); o tipo continua `unknown` de propósito, para testes negativos (payload inválido precisa ser descartado pelo cliente). Testes usam `tests/fixtures.ts` (`mock`, `boot(url, scenarios?)`), que isola storage por teste e reseta o mock antes de carregar o app.

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
- **Shell (F1c)**: links fora do escopo do header/rodapé/menu levam a `/em-breve?secao=<id>` (lista fechada em `src/components/layout/sections.ts`), que diz "ainda não está disponível… Nenhuma ação foi realizada". Newsletter do rodapé: campo e botão **desabilitados** com aviso "Newsletter em breve". Rotas ainda não implementadas mostram só título + "Em construção — etapa X" (TEL-11), sem dados nem controles falsos.
- **Navegação**: "Início" → `/`; "Mercado" → `/#mercado`; lupa → `/#busca` (a slice de catálogo ancora/foca a busca); carrinho com badge `itemCount` vindo do `GET /cart` (sem requisição para visitante que nunca criou carrinho). Logado: botão com o nome abre menu (perfil, carteiras, lista de interesse, Sair). Skip link "Pular para o conteúdo". **Foco (volta 2)**: o `h1` (`PageFrame`, que agora também é usado em `/em-breve`) recebe o foco **somente após uma navegação client-side**. `bootstrap` marca `onBeforeNavigate` com `fromLocation` (`src/lib/navigation.ts`). Na carga completa o foco fica no início do documento, e o primeiro Tab chega ao skip link (BUG-QA-002 e 006).
- **Carregamento (volta 2)**: o `index.html` ganha `<link rel="modulepreload">` de todo o grafo estático de `bootstrap` (plugin `kurio:preload-bootstrap-graph` em `vite.config.ts`). O navegador baixa e compila o app em paralelo com o chunk de mocks, mas só **avalia** depois do `await startMocks()`, e a regra do WebSocket do engine.io continua valendo. O menu da conta (DropdownMenu, cerca de 18 KB gz) e o Sheet do menu mobile (cerca de 3,6 KB gz mais Dialog) saem do boot: são carregados sob demanda (`lazy`). O menu da conta carrega quando há sessão. O Sheet carrega na primeira abertura, com prefetch em hover, foco ou toque. O gatilho mobile fica fora do Radix (`aria-haspopup="dialog"`, `aria-expanded`), e o foco volta a ele por `onCloseAutoFocus`. A medição fica para a F4 (Lighthouse).
- **Sessão vencida em página pública (endurecimento pré-slices)**: sem redirecionar, o header vira o de visitante e um toast não modal e persistente ("Sua sessão expirou." + link "Entrar" que volta à rota atual) é anunciado pela região `aria-live="polite"` do sonner. Detalhes em §4. O Figma não tem esse estado; usa o Toaster do shell (tema escuro, topo central).
- **Erros de rota**: `RouteErrorPage` mostra uma mensagem por `ApiError.code` (nunca a mensagem técnica crua) e "Tentar novamente" chama `useQueryErrorResetBoundary().reset()` junto com `router.invalidate()`.
- **Search params do catálogo**: defaults são removidos da URL (`stripSearchParams`), então `/` continua `/`. Listas usam a serialização padrão do TanStack Router (JSON na query); a S1 pode trocar para `a,b` via `parseSearch/stringifySearch` — o schema aceita ambos.
- **Tema**: tokens do Figma em `@theme` (`src/index.css`): cores (`ink`, `surface-card`, `surface-dark`, `line`, `line-soft`, `brand`, `brand-secondary`, `text-accent`, `text-primary`, `text-secondary`, `elevated`), escala tipográfica (`text-display` … `text-micro`), `tracking-figma` (0.1em), `max-w-page` (1200), `px-gutter`, `h-header` (45), `h-tabbar` (95), raios `rounded-control` (4) / `rounded-card` (20) / `rounded-panel` (28). Os tokens semânticos do shadcn (`primary`, `card`, `muted`, `border`, `ring`…) apontam para essa paleta; tema único escuro (`color-scheme: dark`). `destructive` (#FF8A73) não existe no Figma: escolhido por contraste ≥ 4.5:1. `cn()` usa `tailwind-merge` estendido com esses tokens (sem isso `text-body-md` era tratado como cor e apagava `text-primary-foreground` — achado do axe).
- **Fonte**: Roboto Mono variável (100–700), subsets latin + latin-ext, self-hosted em `public/fonts` (OFL, licença junto), `font-display: swap` e `preload` do subset latin.
- **Movimento**: `.skeleton-shimmer` (Skeleton do shadcn adaptado) e todas as animações/transições são neutralizadas em `prefers-reduced-motion: reduce`.
- **shadcn**: `components.json` (radix-nova), componentes base em `src/components/ui`: button, input, label, dialog, sheet, select, sonner (sem `next-themes`, tema fixo escuro), skeleton, separator, dropdown-menu. Textos "Close" traduzidos para "Fechar".

- **Conta (S2)**: formulários com react-hook-form + zod (`zodResolver`), validados **no envio** e revalidados ao digitar (a validação no blur deslocava o layout entre o `mousedown` e o `mouseup` do botão e perdia o clique). Erros da API (`fieldErrors` de VALIDATION/EMAIL_TAKEN) vão para os campos com `aria-invalid`/`aria-describedby` (`src/features/forms`); o resto vira alerta do formulário. 401 do login = "E-mail ou senha incorretos." no formulário. `/login` com sessão ativa mostra aviso e permite entrar com outra conta (troca de usuário = teardown `switch`). 409 `CONFLICT_VERSION` (perfil e carteira): faixa de alerta, recarga da versão atual, a edição do usuário é mantida e o botão vira "Confirmar e salvar" (ou "Descartar minhas alterações"). Navegação pós-login: `router.navigate({ to: redirect ?? '/' })` com o `redirect` já validado por `safeRedirectSchema`. "Igual à carteira principal" copia os dados da principal menos o endereço (a API recusa endereço repetido).

## 13. Desvios do Figma

| # | Frame / nó | Desvio | Motivo | Alternativa |
|---|---|---|---|---|
| D1 | Mobile / Início — Tab Bar (70395:245), botão central (15:5529) | O glifo de "scanner" do botão central foi trocado por ícone de menu e o botão abre o menu completo (Sheet) | O Figma não define ação para o scanner; abaixo de `md` não há header, então Mercado/Criadores/Aprenda/Entrar ficariam inalcançáveis | Se o design definir o scanner, o menu migra para outro ponto e o botão volta ao glifo original |
| D2 | Mobile / Início — Tab Bar | Fundo com cantos arredondados + anel da cor da página ao redor do botão central, em vez do recorte curvo (vector 15:5504) | Recorte em SVG por viewport acrescenta complexidade sem ganho funcional; o anel reproduz o "entalhe" visualmente | Exportar o vector do Figma e usá-lo como máscara |
| D3 | Rodapé (instância Footer 70492:696) em mobile | Não há frame mobile do rodapé; layout derivado: destaques em lista (ícone 48 px à esquerda), faixa da marca empilhada, links em 2 colunas, mesmo conteúdo | Ausência de frame | — |
| D4 | Rodapé — newsletter | Campo e botão "Enviar" desabilitados, com o texto visível "Newsletter em breve." (uma linha) e o complemento "Inscrições ainda não estão abertas." em `sr-only`, ligado ao formulário por `aria-describedby` | Fora do escopo; o desafio proíbe simular sucesso. Na volta 2 o texto foi encurtado para caber na altura do bloco do Figma (+2 px) | Habilitar quando houver endpoint |
| D5 | Rodapé — redes sociais | Ícones desenhados à mão (`brand-icons.tsx`) no estilo lucide; levam a `/em-breve?secao=redes-sociais` | lucide-react 1.x removeu ícones de marca; não há perfis reais | Trocar por SVG oficiais das marcas se exigido |
| D6 | Header desktop (revisto na volta 2) | Em ≥ 1200 px segue o Figma: coluna de 1200, nav em x = 376 da coluna ("Início" em x = 496 no frame de 1440, como na referência) e gap de 40 px. Entre 768 e 1199 px, que não têm frame, a nav entra **no fluxo** entre logo e ações (`flex-1`, centralizada no espaço livre) e não é mais `absolute left-1/2`. Gaps: 16 px abaixo de `lg`, 40 px na nav e 24 px nas ações a partir de `lg`. O botão da conta fica limitado a 140 px abaixo de `lg`. Não há sobreposição de 768 a 1440, logado ou não: em 768 "Aprenda" termina em x = 470 e a busca começa em 540 | Não há frame tablet. A versão anterior (nav centralizada na página) colidia com a busca entre 768 e cerca de 850 px | Tab bar até 1023 px, se o design pedir |
| D7 | Rodapé 1440 (volta 2) | Medidas alinhadas ao Figma: bloco de destaques 252 px (Figma 250), faixa da marca 88, links 236, copyright 36. Divisores em x = 417/683/949. Colunas da faixa e dos links em x = 152/455/758/1060. Linhas de link a cada 30 px. Selo de carteiras em 9 px sem quebra. Abaixo de `lg`, faixa e links em 2 colunas (antes eram 4 colunas apertadas em 768) | Fidelidade #2, #3 e #8 | — |
| D8 | Tab bar mobile (volta 2) | Raio superior de 40 px (antes 28), mais perto do recorte do Figma | Fidelidade #7 | — |
| D9 | Login e Cadastro (9:115, 9:1022) | O Figma desenha um modal sobre a página inicial; aqui é uma rota com o mesmo painel (500 px, borda inferior de 10 px, abas "Entrar | Criar conta", campos de 340 px) centralizado sobre a página, sem o catálogo ao fundo. O botão X leva a `/`. Campos têm rótulo `sr-only` (o Figma só mostra placeholder). Texto auxiliar da senha no cadastro (visível) | Acesso direto, refresh e retorno ao fluxo exigem rota; rótulos são requisito de acessibilidade | Renderizar sobre a home quando a S1 existir |
| D10 | Login — social e "Esqueceu a senha?" | "Continuar com Google/Facebook" desabilitados com a nota "Login social em breve."; "Esqueceu a senha?" leva a `/em-breve?secao=recuperar-senha` | Fora do escopo; sem simular sucesso | — |
| D11 | Perfil (9:1238) | Dois formulários: "Salvar" (dados e avatar) logo após o bloco de dados e "Alterar senha" (botão próprio) ao fim da seção de senha, em vez de um único "Salvar". O seletor ".eth" é um rótulo fixo (só existe esse TLD) e o campo ao lado guarda o rótulo ENS. O avatar é enviado ao escolher o arquivo ("Alterar" abre o seletor) | Senha e dados têm validações, erros e endpoints distintos; um único botão misturaria os erros | — |
| D12 | Perfil/Carteiras em 390 px (sem frame) | O menu "Meu perfil" vira uma linha de links com quebra acima do conteúdo e os campos em coluna única | Ausência de frame mobile | — |
| D13 | Menu lateral da conta | "Ofertas", "Arquivos baixados", "Suporte" e "Atividade" levam a `/em-breve` (3 novas seções em `sections.ts`: `ofertas`, `arquivos`, `suporte`, mais `recuperar-senha`); "Lista de interesse" leva a `/favorites` (S1) | Fora do escopo (TEL-11) | — |

## 14. Changelog de contratos

| Versão | Data | Mudança | Motivo | Impacto |
|---|---|---|---|---|
| 1.0.0 | 2026-11-03 | Versão inicial congelada: common, errors, auth, nfts, favorites, cart, quote, orders, profile, wallets, events, endpoints, scenarios | F1a | — |
| 1.1.0 | 2026-11-03 | (a) Novo código `CONFLICT_VERSION` (409, `resource { kind: 'profile'\|'wallet', id }`, `currentVersion`) em `errors.ts`; adicionado a `errors` de `updateProfile` e `updateWallet`. (b) `MockControl.reset(scenarios?: ScenarioName[])`. (c) Documentado: `MockControl.emit` recebe o envelope completo de `events.ts` (tipo segue `unknown` para testes negativos). (d) Documentado em `endpoints.ts`/§2.2: `Idempotency-Key` UUID obrigatório em `POST /orders`; ausente/inválido → 422 VALIDATION `fieldErrors['Idempotency-Key']`. (e) §4: hash de senha do mock é SHA-256 + salt (texto anterior dizia PBKDF2). | Propostas do agente de mocks (F1b) aceitas na F1c. Conflito de versão como VALIDATION em `fieldErrors.version` apontaria para um campo que não existe no formulário; código dedicado permite "recarregar e confirmar de novo" | Aditivo para o cliente (união discriminada ganha um membro). **Mocks**: trocar `validationFail({ version })` por `errorBody({ code: 'CONFLICT_VERSION', … })` em `handlers/profile.ts` e `handlers/wallets.ts`. Demais itens já implementados pelo mock |
| 1.2.0 | 2026-11-03 | (a) `safeRedirectSchema` endurecido: rejeita barra invertida e caracteres de controle C0/DEL em qualquer posição, confere a origem com `new URL(v, base)`, rejeita normalização que resulte em `//…`, e a **saída** passa a ser normalizada (`pathname + search + hash`); novo helper `toSafeRedirect`. (b) Novos `httpsUrlSchema` (só `https:`) e `avatarUrlSchema` (`https:`, path de mesma origem ou `data:image/(png\|jpeg\|webp);base64`). `transaction.explorerUrl` passa a ser `httpsUrlSchema`, e `user.avatarUrl` e `profile.avatarUrl` passam a ser `avatarUrlSchema.nullable()`. (c) `errors` declarados: `createOrder` ganha `NOT_FOUND` (`walletId` inexistente); `getCart`, `removeCartItem` e `removeCoupon` ganham `VALIDATION` (`fieldErrors['X-Guest-Id']` quando não há credencial). (d) `compareEthStrings` em `common.ts`: os contratos não importam mais `@/lib/money`. (e) Cliente (sem mudar o formato do fio): `CallOptions.as` (credencial explícita), validação de `query` antes do envio e `createOrder` com chave inválida passando a lançar `ApiError VALIDATION`. `CONTRACTS_VERSION = '1.2.0'` | Achados da volta 1: QA BUG-QA-001/004/005, segurança #2/#4, revisor #3/#11/#17/#18/#22 | **Restritivo** em (a) e (b). **Mocks**: `explorerUrl` já é `https://etherscan.io/tx/…`, e o avatar enviado vira `data:<mime>;base64` com mime PNG/JPEG/WebP (já validado pelo `avatarFileSchema`), então nada muda no formato. Basta confirmar que nenhuma seed usa `http:` ou SVG. (c) só alinha a tabela ao que o mock já responde. Testes de mocks que listam `errors` por endpoint devem aceitar os novos códigos |
