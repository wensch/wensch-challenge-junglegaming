# revisor-frontend-senior — fundacao — 2026-11-03 (volta 2)
Veredito: CHANGES_REQUESTED

Escopo: `git diff b891186..01e30bb`, que inclui o merge dos mocks (3d52cf7), o merge de shell e contratos v1.2.0 (0c27e52) e os testes. Li CLAUDE.md, docs/challenge.md (§3 "Conta e sessão", §4), ARCHITECTURE.md (§4 sessão, §7.1), o meu relatório da volta 1 e os três relatórios da volta 2 (fidelidade-visual, qa-features com BUGS.md e seguranca, todos APPROVED). Não editei código e não rodei build, preview nem verify. Tudo rodou contra o preview já ativo em http://localhost:4173 (main 2ad75fc; `src` idêntico a 01e30bb).

Motivo do veredito: os 5 achados altos da volta 1 estão corrigidos, com evidência executada. A revisão do código novo, porém, achou **1 alto novo** (N1): a expiração natural da sessão, quando o relógio passa do `expiresAt`, não entra no fluxo de expiração. A rota cai em `reason=required` e o rascunho do mesmo usuário é apagado. Isso contraria §3 ("Trate expiração durante a navegação e durante o checkout, preservando o contexto para retomada") e o próprio ARCHITECTURE §4 ("TTL absoluto `expiresAt` → … `reason=expired`"; "na expiração os rascunhos do mesmo usuário ficam"). O defeito já existia na volta 1 e eu não o vi; agora está reproduzido.

## Verificações executadas
| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | exit 0 |
| Lint (agora com `no-floating-promises`/`no-misused-promises` type-aware) | `npm run lint` | exit 0, 0 problemas |
| Corrida REST × evento (achado volta 1 #2) | `node reports/fundacao/revisor-evidence/reconcile-race.mjs` | **corrigido**, ver saída abaixo |
| Logout com token vencido (#6) e DB entre abas (#5) | `BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/revisor-evidence/playwright.revisor.config.ts revisor.rev` | **2 passed**. O projeto do revisor **não** usa `bypassCSP` e o preview serve a CSP de `vercel.json`, então o R2 passou sob a CSP real |
| Novos cenários do revisor (V1 a V3) | `BASE_URL=http://localhost:4173 npx playwright test -c reports/fundacao/revisor-evidence/playwright.revisor.config.ts revisor-v2` | V1 **falha** (N1); V2 e V3 passam. Trace: `reports/fundacao/revisor-evidence/test-results/revisor-v2.rev-V1-*/trace.zip` |
| Regressões da volta 2 (desktop) | `BASE_URL=http://localhost:4173 npx playwright test tests/e2e/{05-unit-cache,06-csp,07-focus,20-session-tabs,92-header-tablet,qa-fundacao-shell,qa-volta2}.spec.ts --project=desktop` | 58 passed, 1 skipped (skip intencional, só mobile). Nenhum `test.fail` restante em `tests/e2e` |
| Schemas de redirect/URL (sonda independente) | `node reports/fundacao/revisor-evidence/redirect-probe-v2.mjs` | TAB, LF, `/..//`, `/a/../..//`, `\` e `\\` são rejeitados; `javascript:`/`http:`/SVG em data URL também. `https://cdn.example/a.png` é aceito como avatar (ver R7) |
| `any`/casts | `grep -rn "eslint-disable\|as unknown\|@ts-" src` | só `common.ts:78` (regex de controle, justificado) e `mocks/db.ts:138` (`as unknown as DbState` depois de validação estrutural, aceitável no mock) |

Saídas que importam:
```
{"case":"order-regression","eventOutcome":"applied","afterEvent":"confirmed","afterInflightFetch":{"status":"confirmed","version":2},"replaySameEvent":"duplicate","sameVersionNewId":"stale"}
{"case":"nft-inflight","eventOutcome":"applied","cachedAfterFetch":{"price":"2.0","version":2},"knownVersion":2,"sameVersionNewId":"stale"}
R1 {"path":"/","search":""}
R2 {"logoutA":204,"sessionInB":401,"loginBobInB":200,"sessionInAAfterReload":401}
V1 {"path":"/login","reason":"required","redirect":"/wallets","draftKept":false}
V2 {"storedCleared":true,"h1":"Mercado de NFTs","pageErrors":[]}
V3 {"logouts":1,"path":"/"}
```
O script de corrida usa `fetchQuery` cru, sem `keepNewest`. Ele passa por causa do segundo guard do reconciler (`onCacheEvent` reaplica o último evento sobre um fetch mais antigo). Os dois guards funcionam de forma independente.

## Status dos 25 achados da volta 1
| # | Sev. v1 | Status | Evidência |
|---|---|---|---|
| 1 | alta | **Corrigido.** `subscribeSession` está no bootstrap e chama `syncSessionWithStorage` (serializado). A credencial fica presa ao dono da key (`ownedQueryFn`, `CallOptions.as`) e é checada de novo depois da resposta. 401 UNAUTHENTICATED com Bearer faz teardown. A notificação só dispara para o token atual. O guard `_authed` confere `getToken()` | `20-session-tabs.spec.ts` passa; `src/queries/owner.ts`; `client.ts:88-93` |
| 2 | alta | **Corrigido.** `keepNewest` (structuralSharing) mais reaplicação em `onCacheEvent` | `reconcile-race.mjs` (acima); `05-unit-cache.spec.ts` passa |
| 3 | alta | **Corrigido.** `toSafeRedirect` rejeita controles e `\`, checa a origem e normaliza a saída | `redirect-probe-v2.mjs`; `qa-fundacao-shell` sem `test.fail` |
| 4 | alta | **Corrigido** | `92-header-tablet.spec.ts` (768/820) passa; fidelidade APPROVED |
| 5 | alta | **Corrigido.** O DB é relido do storage a cada `db()`, `nextId` reserva o número, e sockets de sessão revogada ou expirada são fechados (sweep e checagem por `deliver`) | R2 `401/401` |
| 6 | média | Corrigido (`logout` sempre silencioso, `logoutSession` deduplicado) | R1 `path "/"` |
| 7 | média | Corrigido (subtrai as quantidades do recibo) | `src/mocks/orders.ts` `settleOrder`; `mocks.spec.ts` |
| 8 | média | Corrigido (`hasClientNavigated`; `/em-breve` usa `PageFrame`) | `07-focus.spec.ts` passa |
| 9 | média | Corrigido (CONFLICT_VERSION em profile e wallets) | `handlers/profile.ts:40`, `wallets.ts:44` |
| 10 | média | Corrigido no preview: CSP, Permissions-Policy e COOP saem de `vercel.json`, que `vite preview` também serve. Produção não foi verificada por mim | `06-csp.spec.ts` passa |
| 11 | média | Corrigido (`httpsUrlSchema`, `avatarUrlSchema`, v1.2.0) | `redirect-probe-v2.mjs` |
| 12 | média | Corrigido (`useGuestId` com `useSyncExternalStore`, `ensureGuestId`, `skipToken`) | `src/queries/cart.ts` |
| 13 | média | Corrigido (plugin `preloadBootstrapGraph`; AccountDropdown e Sheet sob demanda). A medição fica para a F4 (Lighthouse) | `qa-volta2` "lazy" passa |
| 14 | média | **Parcial.** O CI usa `updateSnapshots: 'none'` e existe o workflow `visual-baselines.yml`. Só que as baselines `linux/` não estão versionadas, então o `verify` do CI vai ficar **vermelho** no passo visual depois do push. ARCHITECTURE §7.1 documenta isso como intencional | `git ls-files tests/__screenshots__`: só `win32/`. Ver M1 |
| 15 | média | Corrigido | fidelidade-visual.md volta 2 |
| 16 | média | Corrigido (`src/session/hooks.ts`: `useLogout` e `useEstablishSession`, deduplicados) | código |
| 17 | baixa | Corrigido (`compareEthStrings` em contracts; `money.ts` importa `ETH_PATTERN`) | diff |
| 18 | baixa | Corrigido (`createOrder` rejeita com `ApiError`; `send` valida a query) | diff |
| 19 | baixa | Corrigido (`nftQueries`/`orderQueries` com `DataTag`; key de lista normalizada). Ainda há uma brecha, ver R3 | `src/queries/nfts.ts` |
| 20 | baixa | Corrigido (`AppSocket` tipado, try/catch por listener, `e.userId`) | `socket.ts` |
| 21 | baixa | Corrigido no essencial: regra para `ImportExpression`, as duas regras type-aware que importavam e actions fixadas por SHA. `strictTypeChecked` completo não foi adotado, o que aceito | `eslint.config.js` |
| 22 | baixa | Corrigido (NOT_FOUND e VALIDATION declarados na v1.2.0) | `endpoints.ts` |
| 23 | baixa | Corrigido, itens (a) a (f) | diffs de `control.ts`, `realtime.ts`, `profile.ts`, `db.ts`, `mocks.spec.ts` |
| 24 | baixa | Corrigido (`errorMessageOf` por código, `reset()` do boundary) | `PageStates.tsx` |
| 25 | baixa | Corrigido segundo o relatório de fidelidade | fidelidade-visual.md |

## Achados (volta 2)
| # | Severidade | Descrição | Evidência | Correção sugerida | Dono |
|---|---|---|---|---|---|
| N1 | **alta** | **A expiração natural da sessão não entra no fluxo de expiração.** `getStoredSession()` devolve `null` quando `expiresAt <= now`, e a partir daí o cliente trata o usuário como "sem sessão", não como "sessão expirada". (a) Na navegação para uma rota privada, `_authed` → `syncSessionWithStorage` encontra cache ≠ storage → `teardownSession('external')` → `clearUserDrafts()` apaga **todos** os rascunhos, inclusive os do próprio usuário → redireciona com `reason=required`. (b) Queries privadas: `ownedQueryFn` lança `ownerChangedError` (UNAUTHENTICATED, status 0) sem disparar handler. (c) Mutations, como o `POST /orders` da S3: o interceptor não anexa Bearer (`getToken()` é null), o servidor responde 401 UNAUTHENTICATED sem Bearer e `notifySessionInvalid` ignora a resposta. O checkout recebe um erro genérico, e o header continua mostrando o usuário até a próxima navegação privada. O cenário `session.expired` do mock passa só porque ali o servidor expira e o relógio local não. | V1: `{"path":"/login","reason":"required","redirect":"/wallets","draftKept":false}` com `page.clock.fastForward('08:05:00')` (TTL do mock = 8 h, `src/mocks/sessions.ts:7`); `src/session/store.ts:48`; `src/queries/session.ts:290-294,333-335`; `src/api/client.ts` (interceptor de request e `notifySessionInvalid`) | (1) Separar "ausente" de "vencido" no store: `readSession(): { token, expiresAt, expired } \| null`. O interceptor e o `isCurrentOwner` passam a usar o token armazenado **mesmo vencido**, e o servidor responde SESSION_EXPIRED, que já cai no fluxo `expired` (teardown preservando os rascunhos do usuário, mais `/login?reason=expired&redirect=…`). (2) `syncSessionWithStorage` e `_authed`: quando o token do cache é o token armazenado e ele venceu localmente, chamar o mesmo handler `expired` em vez de `'external'`/`required`. (3) No bootstrap, um timer armado em `expiresAt` (com clamp em 2^31−1 e rearmado em `subscribeSession` e `visibilitychange`) dispara o fluxo `expired` de forma proativa. (4) `teardownSession('external')` não apaga rascunhos de um usuário cuja sessão só venceu ou foi refeita. (5) Levar o V1 para `tests/e2e` (por exemplo `21-session-clock-expiry.spec.ts`), com um caso de navegação e um de mutation. | arquiteto-contratos |
| M1 | média | Depois do push de main, o job `verify` do CI fica vermelho no passo visual até alguém commitar as baselines Linux. É intencional (ARCHITECTURE §7.1), mas deixa a main vermelha no remoto. O `origin/main` ainda está em a067d1a. | `git ls-files tests/__screenshots__` (só `win32/`); `gh run list` | Depois do push: rodar `visual-baselines` (workflow_dispatch), revisar o artifact, commitar `tests/__screenshots__/linux/` e confirmar o CI verde. | orquestrador |
| R1 | baixa | Mock: `updateProfile` e `removeAvatar` alteram `auth.user`, que foi capturado em `resolveAuth` antes do `await request.json()`. Se outra aba gravar o DB nesse intervalo, o primeiro `db()` do handler troca `state` e a escrita cai num objeto órfão: o handler responde sucesso com versão nova e a mudança não persiste. `uploadAvatar` e `changePassword` já relêem o registro como `live`. A janela de perda que o agente admitiu na sincronização por releitura tem duas partes: (i) esse caso de objeto capturado antes de um `await`; (ii) last-writer-wins na janela de propagação do `localStorage` entre processos (milissegundos), aceitável para um mock. | `src/mocks/handlers/profile.ts:37,65-67` | Sempre reler o registro por id depois da validação (`liveUser(auth)`), como já é feito em `uploadAvatar`. Vale para todo handler que altere `auth.*`. | plataforma-mocks (antes da S2 usar perfil) |
| R2 | baixa | Mock: `db()` faz `localStorage.getItem` do DB inteiro e compara a string a cada chamada, e há várias chamadas por requisição e por evento (`stillAuthorised` → `findSession`). Com avatar em data URL (até cerca de 2,7 MB), isso vira cópia e comparação de MB por chamada, o que pesa no TBT do build de demonstração. | `src/mocks/db.ts:149-170`; `realtime.ts` `deliver`/`sweepConnections` | Marcar "dirty" pelo evento `storage` (chave do DB) e só reler quando houver marca, ou manter um contador de revisão numa chave pequena. | plataforma-mocks |
| R3 | baixa | `queryKeys.nfts.list(query: Partial<NftListQuery>)` ainda aceita a query crua. Uma slice que monte a key direto, sem `nftQueries.list`, volta a separar `{}` de `{pageSize:9}`. | `src/queries/keys.ts:215` | Tipar o parâmetro como `NftListQuery` (saída do parse) ou usar um tipo nominal `NormalizedNftListQuery`. | arquiteto-contratos (pode ir junto com N1) |
| R4 | baixa | O carrinho tem `version`, mas `cartQueryOptions` não usa `keepNewest`. Além disso, `establishSessionAndMergeCart` grava o carrinho mesclado sem cancelar o `GET /cart` do usuário que o header dispara assim que a sessão entra no cache. Com o mock a ordem é segura (o handler lê o DB depois do delay), mas com outro backend um snapshot pré-merge poderia sobrescrever o merge. | `src/queries/cart.ts`; `src/queries/session.ts:369-383` | `structuralSharing: keepNewest` no carrinho e `await cancelQueries(userCartKey)` antes de gravar o merge. | S3 (carrinho) |
| R5 | baixa | O doc de `keepNewest` cita perfil e carteiras, mas não há `queryOptions` para eles; a S2 é que cria. | `src/queries/versioned.ts:4-6` | A S2 cria `src/queries/account.ts` com `ownedQueryFn` e `keepNewest` em profile e wallets, e o otimismo das mutations respeita CONFLICT_VERSION. | S2 |
| R6 | baixa | Tempo real entre abas: cada aba tem seu servidor simulado, então o `order.updated` gerado na aba A não chega ao socket do mesmo usuário na aba B. O efeito é mitigado porque um pedido pendente tem `staleTime: 0` e `refetchOnWindowFocus` está ligado. | `src/mocks/realtime.ts` (conexões por aba); `src/queries/orders.ts:166-169` | Na S3, a tela de pedido mantém `refetchOnWindowFocus` e usa polling quando o socket cai. Registrar a limitação em ARCHITECTURE. | S3 |
| R7 | baixa | O contrato aceita avatar `https://` de qualquer host, mas a CSP tem `img-src 'self' data: blob:`. Um avatar externo passaria na validação e seria bloqueado na renderização. | `redirect-probe-v2.mjs` (`https://cdn.example/a.png` true); `vercel.json` | Escolher um lado: restringir o avatar a data URL e mesma origem, ou listar os hosts na CSP. Decidir na S2. | arquiteto-contratos / S2 |
| R8 | baixa | `useEstablishSession` deduplicado: uma segunda chamada com **outra** sessão enquanto a primeira está em voo recebe a promise da primeira. É o comportamento certo contra duplo envio, mas não está documentado. | `src/session/hooks.ts:49-62` | Documentar no JSDoc; o formulário da S2 desabilita o envio com `isPending`. | S2 |

Itens conferidos e sem achado: StrictMode no `RealtimeBridge` (o par start/stop é idempotente e `dispose` do reconciler desinscreve do QueryCache); listeners do socket removidos em `stop()` (`removeAllListeners` no socket e no Manager); `subscribeSession` e `subscribeGuestId` com cleanup; microtask do bootstrap, que vê o estado final do `establishSession` e do teardown; `syncChain` serializado; `onCacheEvent` ignora `manual` (sem reentrada); `ownedQueryFn` não reentra no retry (UNAUTHENTICATED com status 0 não é `retryable`); token desconhecido no boot vira visitante sem erro de rota (V2); `ready` do mock só resolve depois do CONNECT.

## A fundação serve S1, S2 e S3 em paralelo?
De modo geral, sim: as APIs estão estáveis e cada slice tem um ponto de entrada claro. O que falta é dono para arquivos quentes.

| Slice | Onde pluga (API estável) | Cria | Risco de conflito |
|---|---|---|---|
| S1 catálogo | `nftQueries.list/featured/detail`, `normalizeNftListQuery`, `catalogSearchSchema` em `routes/index.tsx` e `nft.$id.tsx`, `realtime.onEvent` para anunciar mudanças, `money.ts` | `src/components/catalog/*`; favoritos (`queryKeys.user(id).favorites()`), sem queryOptions ainda | **Favoritos** aparecem no card (S1) e na página `/favorites` (S2). **Adicionar ao carrinho** no detalhe (S1) usa lógica de carrinho (S3). **Busca do header** (`SiteHeader.tsx`) |
| S2 conta | `useEstablishSession`, `useLogout`, `authSearchSchema`/`safeRedirectSchema`, `ownedQueryFn`, `keepNewest`, `userDraftKey` | `src/queries/account.ts` (perfil, carteiras), telas de login, registro, perfil e carteiras | `AccountDropdown`/`MobileMenuSheet` (S2) e `SiteHeader` (S1 busca, S3 badge). Correção N1 em `session.ts`/`store.ts` precisa entrar **antes** das slices |
| S3 checkout | `cartQueryOptions(owner)`, `useCartOwner`, `ensureGuestId`, `orderQueries`, `PENDING_ORDER_POLL_MS`, `ordersApi.createOrder(body, idempotencyKey)`, `userDraftKey`, keys de cotação | `src/queries/cart-mutations.ts`, `quote.ts`, rotas `/cart`, `/checkout`, `/orders/$id` e provavelmente `/orders` (lista, que não existe) | `src/queries/cart.ts` (também usado pelo header), `routeTree.gen.ts` se a S3 criar a rota de lista |

Recomendações de integração (orquestrador):
1. **N1 primeiro**, numa volta 3 curta, antes de abrir as worktrees das slices: ela mexe em `session.ts`, `store.ts`, `client.ts`, `owner.ts` e `_authed.tsx`, que S2 e S3 consomem.
2. Donos fixos por arquivo: `src/queries/favorites.ts` (`useToggleFavorite` otimista com rollback, key `['u',id,'favorites']`) fica com a **S1**, e a S2 só consome. `useAddToCart` (com `ensureGuestId()` antes da primeira mutation e invalidação de carrinho e cotação) fica com a **S3**, num arquivo próprio (`cart-mutations.ts`). A S1 só importa, ou usa um stub até o merge da S3. `cart.ts` fica congelado.
3. `src/api/contracts/*` e `src/mocks/*`: uma mudança por PR, com entrada no changelog (v1.2.x). `routeTree.gen.ts` é regenerado no merge, nunca resolvido à mão. `ARCHITECTURE.md`, `STATUS.md` e `docs/requirements-matrix.md` são editados por seção, cada slice na sua.
4. `SiteHeader.tsx`: a S1 cuida só do bloco de busca, a S3 só do badge (que já existe) e a S2 só do menu da conta (`AccountDropdown`, que já é outro arquivo).

## Correções da volta 3 (última)
| Ordem | Item | Dono | Critério de aceite |
|---|---|---|---|
| 1 | N1: expiração natural vira fluxo `expired` (navegação, query e mutation), preserva os rascunhos do mesmo usuário e tem timer proativo | arquiteto-contratos | V1 (`revisor-v2.rev.spec.ts`) passa: `reason=expired`, `redirect=/wallets`, `draftKept=true`. Novo E2E com `page.clock` no verify. `npm run verify` verde |
| 2 | M1: baselines Linux commitadas e CI verde depois do push | orquestrador | `gh run list` com `verify` em success no commit da volta 3 |
| 3 (opcional) | R3 junto com N1 (tipo da key de lista); R1 e R2 no mock | arquiteto-contratos / plataforma-mocks | typecheck/lint; `mocks.spec.ts` |

Recomendações que não bloqueiam (vão para as slices): R4 (S3), R5 (S2), R6 (S3), R7 (S2 e arquiteto), R8 (S2).

Condição para APPROVED na volta 3: N1 corrigido com o V1 passando e o teste equivalente no verify; typecheck e lint verdes; nenhum alto aberto nos gates.
