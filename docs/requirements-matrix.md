# Matriz de requisitos

Fonte: [challenge.md](challenge.md) (seção entre parênteses). Status: `—` pendente · `parcial` · `OK` (só com evidência executada).
Evidência = spec Playwright, arquivo, relatório ou print. Mantida pelo agente **auditor-requisitos**.

**Última auditoria:** 2026-11-04, fim da slice `fundacao` (APPROVED na volta 3), base `main` 41b2d79 (= 385a494 + STATUS.md; `git diff a79823d 41b2d79 -- src` vazio).
Evidência executada nesta auditoria: `npx tsc -b --noEmit` exit 0; `npx eslint .` exit 0; `BASE_URL=http://127.0.0.1:9 npx playwright test tests/e2e/05-unit-cache.spec.ts --project=desktop` 6 passed; sondas ESLint por stdin (import de `@/mocks/db` em `src/lib/navigation.ts` → `no-restricted-imports`; `parseFloat` → `no-restricted-syntax`; `Number(s)` → **sem erro**). As specs de navegador não foram reexecutadas (sem preview, por instrução do orquestrador). Para elas vale o último `npm run verify` em a79823d (GREEN: e2e 205, visual 6, a11y 9; `reports/verify-latest.md`), com src idêntico a main, mais as execuções de `reports/fundacao/{qa-features,seguranca,revisor-frontend-senior}.md`.
Abreviações: **verify** = verify a79823d · **harness** = `tests/e2e/mocks.spec.ts` (projetos `*-harness`, REST pelo SW do MSW e `socket.io-client` real) · **QA/SEG/REV** = relatórios da fundação.

## Pendências que bloqueiam entrega

1. **ELIM-2 / TEL-1..9:** nenhum fluxo principal existe. Todas as rotas são placeholders (11 a 18 linhas em `src/routes/**`). Faltam as slices S1–S5 inteiras.
2. **ELIM-1 / STK-9 / LH-1..5 / DEL-6:** Lighthouse não existe. Não há dependência no `package.json`, e `npm run lighthouse` aponta para `lighthouse/run.mjs`, que não existe.
3. **ELIM-1 / STK-3 / INT-8:** `src` não tem nenhum `useMutation`. Ainda faltam mutations do TanStack Query e atualização otimista com rollback.
4. **ELIM-3 / PAG-6 / TEL-5:** não há tela de confirmação. Falta um E2E que prove que o recibo só aparece com `confirmed` vindo da simulação, testando também `payment.declined` e `payment.hold`.
5. **§9 (E2E-01..12, E2E-14):** quase toda a cobertura de fluxo está ausente. A regressão visual de início, detalhe, carrinho e pagamento não existe; hoje só há o shell.
6. **DEL-2:** a produção serve a067d1a, que está atrás de main (`git rev-parse origin/main`) e não tem a CSP (SEG #12). É preciso fazer o push, o deploy e o smoke `BASE_URL=<prod>`.
7. **DEL-4 / DEL-8:** o `README.md` não existe. Faltam setup, env, credenciais, cenários e reset, falhas e a declaração de uso de IA. O ARCHITECTURE §4 já remete a ele.
8. **DEL-7 / E2E-14:** não há baselines visuais `linux`, só `tests/__screenshots__/win32`. O job `verify` do CI fica vermelho no passo visual até elas serem commitadas (ARCHITECTURE §7.1, REV M1).
9. **ELIM-6:** o gate é intermitente por causa do flake F1 (CSP sweep, MSW sem controller após reload), visto em 1 de 2 execuções do verify e em 11 de 40 sob carga (REV F1). A correção está em andamento.

## Eliminatórios (§11)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| ELIM-1 | Uso efetivo de toda a stack obrigatória (§2) | parcial | React, TS, Router, Query (só queries), Axios, socket.io-client, Tailwind, shadcn, MSW e Playwright participam de verdade (ver STK-*). **Falta:** Lighthouse (zero), mutations do TanStack Query (zero `useMutation`) e telas que usem tudo isso |
| ELIM-2 | Fluxos principais funcionais (não apenas visuais) | — | Nenhum fluxo de compra ou conta existe na UI; as rotas são placeholders. Só o shell e a sessão (guard, logout, expiração) funcionam |
| ELIM-3 | Compra confirmada apenas com resposta da simulação | parcial | Infra: mock `payment.confirmed`/`declined`/`hold` + `settleOrder` (harness "scenarios", "orders are idempotent"); `keepNewest` e reconciler não regridem pedido terminal (`05-unit-cache`, executado: 6 passed); `order.updated` de outro usuário é descartado (`00-smoke`). **Falta:** UI de checkout e confirmação e o E2E que prove "sem `confirmed`, sem recibo" |
| ELIM-4 | Sem exposição de dados entre usuários | parcial | `20-session-tabs` (logout e troca alice→bob entre abas: cache `['u']` vazio, socket guest), `qa-volta2` "cancelamento: logout com requisição em voo + refresh", SEG `isolation.sec`/`crosstab.sec` (14/14), harness "events are scoped to the owner", 403 FORBIDDEN em recurso alheio. Grep: toda key privada sai de `queryKeys.user(id)`/`owner()` (`src/queries/keys.ts`). **Falta:** telas privadas reais e E2E-03 com troca pela UI de login. Brecha baixa SEG #13 (rascunhos de alice ficam na aba de bob se a sessão já tinha expirado) precisa ser corrigida antes de a S3 gravar o rascunho |
| ELIM-5 | Eventos passam por `socket.io-client` (nunca direto na UI) | parcial | `00-smoke` "tempo real": `mock.emit` → MSW `ws.link` → socket.io-client → reconciler (applied, duplicate, stale, invalid, foreign, reconexão). Fixture `tests/fixtures.ts` só fala com `window.__mock`. **Atenção:** `05-unit-cache` chama `reconciler.handle()` e `setQueryData` direto; vale como teste de unidade, mas **não** pode ser citado como evidência de §9 nem de RT-*. **Falta:** RT-1/RT-2 na UI |
| ELIM-6 | Testes E2E executáveis | parcial | A suíte roda com os mocks em desktop e mobile (verify: e2e 205, visual 6, a11y 9; QA: 214 passed). **Falta:** a cobertura §9 1–12 e a estabilidade do gate (flake F1) |

## Stack (§2)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| STK-1 | React + TypeScript | OK | `npx tsc -b --noEmit` exit 0 (executado nesta auditoria; strict, exactOptionalPropertyTypes) |
| STK-2 | TanStack Router em rotas, search params e proteção de fluxos privados (§4) | parcial | `src/routes/*` (file-based), `validateSearch` (catálogo, detalhe, auth), `_authed.beforeLoad`; `00-smoke` "deep link e refresh preservam rota e search params", `qa-fundacao-shell` "guard _authed" (5 rotas). Telas reais: S1–S5 |
| STK-3 | TanStack Query em consultas, mutations e sincronização de cache (§4) | parcial | Queries: `src/queries/{client,keys,session,cart,nfts,orders}.ts`; sincronização: `realtime/reconcile.ts` (`05-unit-cache` 6 passed). **Mutations: zero `useMutation` em `src`** |
| STK-4 | Todas as chamadas REST via Axios (§4) | parcial | `src/api/client.ts` (instância única) + `src/api/endpoints/*`; `qa-volta2` "QA-004/005 runtime: respostas reais casam com o declarado". Consumo pelas telas: slices |
| STK-5 | Socket.IO em tempo real | parcial | `src/realtime/socket.ts` + `reconcile.ts` + `RealtimeBridge`; `00-smoke` "tempo real" via `window.__mock.emit`. Efeito visível na UI: RT-1/RT-2 |
| STK-6 | Tailwind CSS + shadcn/ui adaptado à identidade (§8) | parcial | `src/index.css` `@theme` (tokens do Figma), `components.json` + `src/components/ui/*` (10 componentes; usados no shell: header, dropdown, sheet, PageStates); fidelidade-visual APPROVED (shell). Componentes das telas: slices |
| STK-7 | MSW para REST e eventos | OK | `src/mocks/browser.ts` (SW, 31 rotas) + `ws.link` com `@mswjs/socket.io-binding`; o app usa os dois na suíte de app (`00-smoke`, `20-session-tabs`, `21-session-clock-expiry`) e o harness exercita os 24 cenários (verify) |
| STK-8 | Playwright E2E + regressão visual | parcial | `playwright.config.ts` (desktop e mobile); visual só do shell (`90-visual-shell`, `92-header-tablet`, baselines win32). Telas e baselines linux pendentes |
| STK-9 | Lighthouse | — | Sem dependência e sem `lighthouse/run.mjs` |

## Telas (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| TEL-1 | Início: destaques, catálogo, busca, filtros, ordenação, navegação ao NFT | parcial | S1: `01-catalog` (destaques, grade, busca, filtros, ordenação, navegação ao NFT); `90-visual-catalog` início |
| TEL-2 | Detalhe: galeria, informações, edição, quantidade, favoritos, compra | parcial | S1: `02-detail` (galeria, informações, edição, quantidade, adicionar ao carrinho), `04-favorites`; "compra" até o carrinho (S3 completa) |
| TEL-3 | Carrinho: quantidades, remoção, cupom, resumo de valores | — | `src/routes/cart.tsx` é placeholder (S3) |
| TEL-4 | Pagamento: dados do colecionador, carteira e rede, revisão, envio | — | `src/routes/_authed/checkout.tsx` é placeholder (S3) |
| TEL-5 | Confirmação: resultado, id da transação, itens, taxas, total | — | `src/routes/_authed/orders.$id.tsx` é placeholder (S3) |
| TEL-6 | Login: autenticação, validação, retorno ao fluxo anterior | parcial | Infra do retorno: `safeRedirectSchema` (`05-unit-cache`; `qa-volta2` e `qa-fundacao-shell` "login redirect=… não vira destino externo"); guard gera `redirect`/`reason`. A tela de login é stub (S2) |
| TEL-7 | Cadastro: criação, validação, tratamento de conflito | — | Tela stub (S2). Mock: harness `register.email-taken`, "auth: validation" |
| TEL-8 | Perfil: dados, avatar, alteração de senha | — | Tela placeholder (S5). Mock: harness "profile, avatar, password and wallets" |
| TEL-9 | Carteiras: principal e secundária, cadastro e edição | — | Tela placeholder (S5) |
| TEL-10 | Frames desktop e mobile; perfil/carteiras/confirmação funcionais em mobile | parcial | Só o shell: header e tab bar e footer em 390/768/1440 (fidelidade-visual APPROVED; `90-visual-shell`, `92-header-tablet`). Telas: slices |
| TEL-11 | Fora de escopo (editorial, suporte, atividade, ofertas, downloads) não aparenta sucesso; links externos coerentes | parcial | `qa-fundacao-shell` "nenhum link morto; /em-breve não aparenta sucesso" e "todos os hrefs internos do shell resolvem". Ações auxiliares das telas: slices |
| TEL-12 | Estados não desenhados seguem o padrão visual | parcial | `PageStates` (404, `/em-breve`) no padrão do shell (fidelidade-visual). Estados de dados (vazio, erro, skeleton): slices |

## Catálogo e detalhe (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAT-1 | Busca, filtros, ordenação e paginação na URL; sobrevivem a refresh e histórico | OK | `01-catalog` "busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico"; `catalogSearchSchema` + `validateSearch` em `src/routes/index.tsx` |
| CAT-2 | Filtros combináveis; mudança de filtro reinicia paginação | OK | `01-catalog` mesma spec: após filtrar a URL perde `page` e a requisição leva `page=1` |
| CAT-3 | Consultas refletem parâmetros enviados à API | OK | `01-catalog`: `waitForRequest` confere `categories`, `networks`, `sort`, `page` na chamada à API |
| CAT-4 | Resultado vazio, falha e respostas fora de ordem tratados | OK | `01-catalog` (vazio, `catalog.empty`, erro 503 com retry, fora de ordem), `12-skeletons` (queda de rede + retry) |
| DET-1 | Acesso direto ao detalhe | OK | `02-detail` acesso direto + refresh com `?edition=` |
| DET-2 | NFT inexistente | OK | `02-detail` NFT inexistente ("NFT não encontrado") e id malformado (404) |
| DET-3 | Edição indisponível | OK | `02-detail` edição esgotada (chip desabilitado, deep link, compra bloqueada) e NFT totalmente esgotado |
| DET-4 | Limite de quantidade | OK | `02-detail` limite de quantidade: stepper, erro no campo (`aria-describedby`), 409 da API mapeado ao campo |
| FAV-1 | Favoritos persistem para o usuário autenticado | parcial | S1: `04-favorites` persiste após refresh; lista `/favorites` é da S2 |

## Carrinho (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAR-1 | Adicionar, alterar e remover respeitando disponibilidade por NFT/edição | parcial | Mock: POST/PATCH/DELETE de linha e 409 (harness "guest cart, merge on login"). UI: S3 |
| CAR-2 | Persistência após refresh | parcial | Mock persiste em localStorage (harness "persist across reload"); `useCart` por dono. UI: S3 |
| CAR-3 | Itens do visitante preservados ao autenticar | parcial | Mock `POST /cart/merge` idempotente (harness); `establishSessionAndMergeCart` existe, mas nenhum E2E o exercita (falta a tela de login) |
| CAR-4 | Aplicar/remover cupom; inválido e expirado tratados | parcial | Mock COUPON_INVALID / COUPON_EXPIRED (harness `coupon.invalid`, `coupon.expired`, "guest cart"). UI: S3 |
| CAR-5 | Subtotal, desconto, taxa de rede e total coerentes com a API | parcial | Mock `POST /quotes` (harness: `networkFee '0.0003'`, desconto). UI: S3 |
| CAR-6 | Reflete preço/disponibilidade recebidos com carrinho aberto | — | `reconcile.ts` invalida carrinho e cotação em `nft.updated`, mas não há teste nem UI |
| MON-1 | ETH como string decimal com precisão em cálculo e apresentação; quantidades inteiras | parcial | `ethSchema` em todos os contratos de valor (grep `src/api/contracts`); `src/lib/money.ts` (decimal.js); lint `noFloatMoney` (sonda: `parseFloat` dá erro). Grep `Number(`/`parseFloat` em `src`: zero uso fora do comentário de `money.ts`. **Lacunas:** `Number()` só é proibido em contracts e money (sonda em `src/lib/navigation.ts`: sem erro); `money.ts` sem nenhum teste; `mocks.spec.ts:492` usa `Number(n.price)`. Apresentação: slices |
| MON-2 | Cotação da API é a referência para finalizar | parcial | Contrato `POST /orders { quoteId, quoteVersion }` + `QUOTE_STALE` (harness `checkout.price-changed`); ARCHITECTURE §6. UI: S3 |

## Pagamento e confirmação (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| PAG-1 | Validação dos campos do layout e revisão antes do envio | — | Tela não existe (S3) |
| PAG-2 | Carteiras cadastradas, seleção de rede, simulação de conexão/recusa/desconexão | parcial | Mock connect, `rejected` e disconnect (harness "profile, avatar, password and wallets", `wallet.reject`). UI: S3 |
| PAG-3 | Revalidar preço, disponibilidade, cupom e taxas antes de confirmar; mudança exige nova confirmação | parcial | Mock `checkout.price-changed` (QUOTE_STALE) e `checkout.sold-out` (harness). UI e reconfirmação: S3 |
| PAG-4 | Sem pedido duplicado em clique repetido ou reenvio após timeout | parcial | Mock: replay com a mesma chave devolve o mesmo pedido (200), chave reaproveitada com outro corpo dá 409 (harness "orders are idempotent", `order.timeout-after-create`). UI: S3 |
| PAG-5 | Estados pendente/confirmado/recusado com recuperação após refresh ou reconexão | parcial | Mock `payment.hold`/`settleOrder`; reconciler não regride terminal (`05-unit-cache`). UI: S3 |
| PAG-6 | Confirmação exibida só para pedido confirmado na simulação | parcial | = ELIM-3 |
| PAG-7 | Itens preservados em falha; após confirmação remove só itens/quantidades comprados | parcial | Mock: harness "confirming an order subtracts the receipt quantities from the cart (later additions stay)". UI: S3 |
| PAG-8 | Recibo reproduz snapshot; mudanças no catálogo não alteram; referências/links simulados | parcial | Mock: recibo imutável após `updateNft` (harness "orders are idempotent"); `explorerUrl` só https (`05-unit-cache`). UI: S3 |

## Conta e sessão (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CON-1 | Cadastro, login, logout e sessão integrados à API simulada | parcial | Sessão de boot e logout pela UI ("Sair": `20-session-tabs` "logout explícito"); mock de auth (harness "auth: validation, 401s and logout"). Telas de login e cadastro: S2 |
| CON-2 | Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação | OK | `qa-fundacao-shell` "guard _authed": cada uma das 5 rotas sem sessão vai para o login com redirect, e com sessão abre e mantém após refresh; o mock responde 401 em endpoints `session` (harness). Revalidar quando as telas entrarem |
| CON-3 | Sessão recuperável após refresh | OK | `qa-fundacao-shell` "com sessão, cada rota privada abre e refresh mantém"; `00-smoke` "com sessão a rota privada abre e o socket reconecta como usuário"; token opaco válido após reload (harness) |
| CON-4 | Expiração durante navegação e checkout, preservando contexto para retomada | parcial | `21-session-clock-expiry` (desktop e mobile; REV: 18 passed): navegação → `reason=expired`, `redirect=/wallets`, rascunho mantido; checkout aberto → timer redireciona antes da requisição. **Falta:** checkout real com `session.expire-on-checkout` no `POST /orders` (o caso 2 hoje passa sem nada para verificar, REV F5) e a correção de SEG #13 |
| CON-5 | Logout/troca de usuário limpa cache privado e subscriptions | parcial | `20-session-tabs` (cache `['u']` vazio, socket guest, guard), `qa-volta2` "cancelamento…", SEG `crosstab.sec`. Troca de usuário pela UI de login: S2 |
| CON-6 | Validação de cadastro, perfil, senha e carteiras, incluindo erros da API | parcial | Mock: `fieldErrors` em register, profile, password e wallets, mais `forms.server-validation` e `register.email-taken` (harness). Formulários: S2/S5 |
| CON-7 | Alterações confirmadas permanecem após refresh | parcial | Mock persiste perfil e carteiras com `version` (harness "persist across reload", CONFLICT_VERSION). UI: S5 |
| CON-8 | Credenciais fictícias; senhas nunca em claro | OK | Harness "passwords are only stored hashed" (`mock:db:v1` sem `Senha@123`, `passwordHash` de 64 hex); SEG "senha e token…": nada no console, storage ou URL; domínios `example.test` (`src/mocks/README.md`) |

## Integração e estado (§4)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| INT-1 | Contratos tipados transporte → estado → interface | parcial | zod em request e response (`src/api/contracts`), `DataTag` nas keys, `tsc` exit 0. Camada de interface: slices |
| INT-2 | Estados loading, vazio, erro, sucesso, atualização em segundo plano | — | `Skeleton` e `PageStates` existem, mas nenhuma tela de dados os usa |
| INT-3 | Invalidação coerente após mutations e eventos | parcial | Eventos: `reconcile.ts` (`05-unit-cache`); reconexão invalida `['nfts']` e pedidos. Mutations: nenhuma |
| INT-4 | Cancelamento/descarte de respostas obsoletas | parcial | `ownedQueryFn` descarta a resposta de um dono trocado (`qa-volta2` "cancelamento…"); REST em voo x evento (`05-unit-cache`); `cancelQueries(['u'])` no teardown. Catálogo fora de ordem na UI: S1 |
| INT-5 | Isolamento por usuário e por parâmetros | parcial | `src/queries/keys.ts` (`['u', userId]`, `['guest', id]`, lista normalizada); `20-session-tabs`. Telas: slices |
| INT-6 | Recuperação de falhas sem duplicar operações | parcial | Retry só em TRANSIENT/5xx/0 (`src/queries/client.ts`, ARCHITECTURE §7); idempotência no mock (harness). UI: S3 |
| INT-7 | Rotas inexistentes e acesso direto a qualquer tela | OK | `00-smoke` "404 para rota inexistente e id malformado" e "deep link e refresh"; `qa-fundacao-shell` "rotas públicas: deep link e refresh" + guard nas 5 privadas; `vercel.json` rewrite SPA. Revalidar o conteúdo de cada tela por deep link nas slices |
| INT-8 | Atualização otimista com rollback (≥1) | OK | `04-favorites` falha: estado otimista visível, rollback, aviso "desfeita", retry; `src/queries/favorites.ts` |
| INT-9 | Política de cache, retries e sincronização documentada | OK | ARCHITECTURE §7 (staleTime por key, retries, invalidação, timeout) e §8 (reconciliação), lidos nesta auditoria; `src/queries/client.ts` |

## Contratos REST (§5)

Status sobre contrato + mock (harness executado no verify). O consumo pela UI está nas linhas de telas e fluxos.

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| API-1 | Sessão/conta: cadastro, login, sessão, logout, expiração | OK | Harness "auth: validation, 401s and logout", `session.expired`, `session.expire-on-checkout`; ARCHITECTURE §2.2 |
| API-2 | NFTs: listagem com busca/filtros/ordenação/paginação; detalhe | OK | Harness "catalog filters, sort, search and facets" (filtro, sort, `q`, `pageSize` inválido 422, NOT_FOUND) |
| API-3 | Favoritos: consulta, inclusão, remoção | parcial | GET e PUT verificados (harness "persist across reload", `favorites.fail`); a remoção **bem-sucedida** (`DELETE /favorites/:id` → `favorited:false`) não tem asserção, só o 503 sob falha |
| API-4 | Carrinho: consulta, inclusão, alteração, remoção | OK | Harness "guest cart, merge on login (idempotent) and coupons" (POST, PATCH, DELETE, 404 na segunda remoção) |
| API-5 | Cotação: cupom, disponibilidade, descontos, taxas, total | OK | Harness "guest cart…" (quote polygon, desconto), `coupon.*`, `checkout.sold-out` |
| API-6 | Pedidos: criação idempotente; consulta de estado e recibo | OK | Harness "orders are idempotent by Idempotency-Key" (201, replay 200, GET recibo) |
| API-7 | Perfil: consulta, dados/avatar, senha | OK | Harness "profile, avatar, password and wallets" |
| API-8 | Carteiras: consulta, cadastro, atualização | OK | Harness "profile, avatar, password and wallets", "wallet update with a stale version answers 409" |
| API-9 | Erros: validação, sessão inválida, sem permissão, inexistente, conflito de disponibilidade, falha transitória | OK | Harness (VALIDATION, UNAUTHENTICATED, SESSION_EXPIRED, FORBIDDEN `auth.forbidden`, NOT_FOUND, CONFLICT_AVAILABILITY, TRANSIENT `http.500.once`/`http.503`); `qa-volta2` "QA-004/005 runtime" |
| API-10 | Idempotency key: mesma tentativa → mesmo pedido; mesma chave com conteúdo diferente → conflito | OK | Harness "orders are idempotent": replay `id` igual, corpo diferente → 409 IDEMPOTENCY_CONFLICT; sem chave → 422 |
| API-11 | Contratos documentados | OK | ARCHITECTURE §2 (convenções, endpoints, erros, search params) e §3 (eventos); `src/api/contracts/endpoints.ts` (fonte única) |

## Mocking (§6)

Status sobre a camada de mocks. O efeito de cada cenário na UI (carregamento, feedback e recuperação) fica nas linhas de telas, CAT, CAR, PAG e E2E.

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| MSW-1 | Mocks na camada de rede, reusados em dev, demo e testes | OK | SW do MSW + `ws.link`; `VITE_ENABLE_MOCKS=true` em `.env.development` e `.env.production`; a suíte roda contra o build de produção (`vite preview`) |
| MSW-2 | Nenhuma resposta fictícia em componentes, hooks ou Axios | OK | Grep: o único import de `src/mocks` fora dele é `src/main.tsx:10` (permitido). Sonda ESLint `no-restricted-imports` (executada). Grep de ids e e-mails de seed fora de `src/mocks`: só comentários em contracts. Revalidar por slice |
| MSW-3 | Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras, pedidos | OK | Harness "two tabs share one DB", "confirming an order subtracts…", "every DB change emits" |
| MSW-4 | Persistência local + reset para cenário conhecido | OK | Harness "reset restores the seed, scenarios and drops created data", "persist across reload", "corrupted or wrong-version persisted DB is discarded" |
| MSW-5 | Lentidão, latência variável, timeouts, sem conexão, HTTP de erro, configuráveis e reproduzíveis | OK | Cenários `latency.slow`, `latency.variable` (determinístico, QA-007 corrigido), `network.timeout`, `network.offline`, `http.500.once`, `http.503`; seleção por `?scenario=` e `setScenarios` (harness) |
| MSW-6 | Fixtures variadas para filtros/paginação; ≥2 usuários | OK | Harness "seed is deterministic and rich" (60 NFTs, 4 tipos de edição, ≥5 esgotados, 9 categorias); alice e bob (`src/mocks/README.md`) |
| MSW-7 | Cenário: sucesso e vazio | OK | `default`, `catalog.empty` (harness "scenarios" + "every scenario of the contract is exercised") |
| MSW-8 | Cenário: latência variável e fora de ordem | OK | `latency.variable`, `catalog.out-of-order` (harness) |
| MSW-9 | Cenário: falha de conexão e 4xx/5xx | OK | `network.offline`, `network.timeout`, `http.500.once`, `http.503` (harness) |
| MSW-10 | Cenário: sessão expirada e não autorizado | OK | `session.expired`, `session.expire-on-checkout`, `auth.forbidden` (harness) |
| MSW-11 | Cenário: conflito de cadastro / validação | OK | `register.email-taken`, `forms.server-validation` (harness) |
| MSW-12 | Cenário: cupom inválido / expirado | OK | `coupon.invalid`, `coupon.expired` (harness) |
| MSW-13 | Cenário: preço alterado / edição esgotada durante compra | OK | `checkout.price-changed`, `checkout.sold-out` (harness) |
| MSW-14 | Cenário: timeout após criação do pedido com recuperação idempotente | OK | `order.timeout-after-create` (harness) |
| MSW-15 | Cenário: pagamento confirmado e recusado | OK | `payment.confirmed`, `payment.declined`, `payment.hold` (harness) |
| MSW-16 | Eventos via MSW com binding Socket.IO; transporte e limitações documentados | OK | `@mswjs/socket.io-binding@0.2.0` + `ws.link`; ARCHITECTURE §11 (transporte, heartbeat, auth no frame bruto, sem acks); `00-smoke` "tempo real" |
| MSW-17 | Ativado por configuração e disponível no build de demonstração | OK | `src/main.tsx` (`VITE_ENABLE_MOCKS`), `.env.production`; suíte verde contra o build de produção. Produção pública desatualizada: ver DEL-2 |
| MSW-18 | Mudanças nos dados refletem em REST e eventos correspondentes | OK | Harness "realtime: … every DB change emits" (`updateNft` → evento com `version` == REST) |

## Tempo real (§7)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| RT-1 | `nft.updated` atualiza preço/disponibilidade em catálogo, detalhe e carrinho | parcial | S1: `01-catalog` e `02-detail` (nft.updated via `__mock.updateNft` -> socket.io-client -> preço/disponibilidade na tela + `role=status`); carrinho: S3 |
| RT-2 | `order.updated` atualiza pedido e apresenta confirmação/recusa | parcial | Reconciler aplica e não regride terminal (`05-unit-cache`); harness entrega `pending → confirmed` só ao dono. UI: S3 |
| RT-3 | Eventos com id estável, recurso afetado e versão | OK | `src/api/contracts/events.ts` (envelope zod); harness (`id` `evt_…`, `version` > 1, `resource.id`); `00-smoke` payload fora do contrato → `invalid` |
| RT-4 | Tolerar duplicatas e eventos antigos sem regredir nem reaplicar efeitos | parcial | `00-smoke` via socket: duplicate (`applied` continua 1) e stale. Efeitos da UI (anúncio `aria-live`, banner) ainda não existem |
| RT-5 | Reconciliação com REST após reconexão | parcial | `00-smoke`: `drop()` → reconexão (`connections=2`). A invalidação REST após reconectar não tem asserção |
| RT-6 | Eventos de sessão anterior não afetam outro usuário | OK | `00-smoke` "order.updated de outro usuário é descartado" (`foreign`); harness "events are scoped to the owner", "revoked and expired sessions lose their sockets"; `20-session-tabs` (socket volta a guest) |
| RT-7 | Listeners/subscriptions liberados no fim do ciclo de vida | parcial | Teardown desconecta o socket (`20-session-tabs`); `reconciler.dispose()`. Listeners por componente: slices |
| RT-8 | Cenário: NFT no carrinho muda → UI informa e atualiza resumo → checkout bloqueia cotação desatualizada | parcial | Só o mock: `checkout.price-changed` (nft.updated + QUOTE_STALE, harness). UI: S3 |
| RT-9 | Queda de conexão com pedido pendente → recupera sem nova compra; confirmado/recusado terminais | parcial | Mock `payment.hold` + `drop` + idempotência (harness); reconciler terminal (`05-unit-cache`). UI: S3 |

## Interface e acessibilidade (§8)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| UI-1 | Fidelidade: tipografia, cores, espaçamentos, hierarquia, imagens, proporções | parcial | Shell: fidelidade-visual APPROVED (header, footer e tab bar dentro de ±2 px). Telas: slices |
| UI-2 | Desktop/tablet/mobile; avaliado em 390, 768, 1440 | parcial | Shell em 390/768/1440 (fidelidade; `92-header-tablet` de 768 a 1440 sem sobreposição). Telas: slices |
| UI-3 | Skeletons com shimmer (catálogo, detalhe, resumo do carrinho), sem CLS, respeitando reduced motion | parcial | S1: `12-skeletons` (catálogo e detalhe: shimmer, mesma geometria, CLS < 0.05, reduced-motion); resumo do carrinho: S3 |
| A11Y-1 | Navegação por teclado e foco visível | parcial | `qa-fundacao-shell` "teclado" (skip link, header, tab bar e Sheet), `07-focus`, `qa-volta2` QA-002/006. Telas: slices |
| A11Y-2 | Controle de foco em diálogos e drawers | parcial | `00-smoke` "menu mobile: abre, Esc, devolve o foco"; `qa-volta2` "lazy: AccountDropdown / Sheet… sem perder o foco". Diálogos das telas: slices |
| A11Y-3 | Semântica, labels e erros associados | parcial | `91-a11y-shell` (axe sem crítico ou sério, verify a11y 9). Formulários: S2/S3/S5 |
| A11Y-4 | Alternativas textuais | parcial | axe no shell (`91-a11y-shell`). Imagens de NFT: slices |
| A11Y-5 | Contraste e estados não dependentes só de cor | parcial | axe no shell (contraste). Estados das telas: slices |
| A11Y-6 | Feedback acessível de mutations e tempo real | parcial | S1: toasts (região `aria-live` "Notificações") em favoritos/carrinho; `role=status` do tempo real (`02-detail`, `01-catalog`) |
| A11Y-7 | Sem overflow horizontal e sem perda com zoom | parcial | `scrollWidth == clientWidth` em 390/768/1440 (fidelidade); `92-header-tablet`. Zoom 200% não testado |
| UI-4 | Assets do arquivo usados; substituições e ajustes de a11y documentados | parcial | ARCHITECTURE §13 (desvios D6–D8 do shell). Assets das telas: slices |

## Testes (§9)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| E2E-01 | Busca, filtros combinados, ordenação, paginação, histórico | — | |
| E2E-02 | Acesso direto ao detalhe e inexistente | OK | `tests/e2e/02-detail.spec.ts` |
| E2E-03 | Cadastro, login, expiração, logout, troca de usuário | parcial | Expiração: `21-session-clock-expiry`; logout e troca: `20-session-tabs` (login via API). Cadastro e login pela UI: S2 |
| E2E-04 | Favoritos com falha e recuperação | — | |
| E2E-05 | Carrinho, quantidades, remoção, cupom, persistência refresh/login | — | |
| E2E-06 | Compra completa até recibo | — | |
| E2E-07 | Falha de pagamento, clique repetido, timeout com mesmo pedido | — | |
| E2E-08 | Perfil, avatar, senha, carteiras com erros | — | |
| E2E-09 | Preço/disponibilidade via Socket.IO no checkout | — | |
| E2E-10 | Duplicados/antigos, desconexão, pedido pendente | parcial | `00-smoke` "tempo real" (duplicado, antigo, reconexão, via socket). Pedido pendente: S3. As asserções leem o `realtime-probe` oculto; §9 pede observar a interface |
| E2E-11 | Teclado, foco de diálogos, validação | parcial | Teclado e foco do shell (`qa-fundacao-shell`, `00-smoke` menu mobile). Validação de formulários: slices |
| E2E-12 | Skeletons em lentidão, falha e retry | — | |
| E2E-13 | Chromium desktop + mobile | OK | `playwright.config.ts` (desktop 1440 + Pixel 7 390); verify roda os dois |
| E2E-14 | Regressão visual: início, detalhe, carrinho, pagamento; baselines versionadas | parcial | Início e detalhe (win32): `90-visual-catalog`; carrinho, pagamento e linux pendentes |
| E2E-15 | Estado isolado; controle de relógio, latência e eventos | parcial | `tests/fixtures.ts` (`boot` isola o storage e reseta o mock), `page.clock` em `21-session-clock-expiry`, `mock.emit`, cenários de latência. Cenários sensíveis a tempo das telas: slices |
| E2E-16 | Relatório HTML e traces de falha | OK | Reporter `html` + `trace: 'retain-on-failure'` (`playwright.config.ts`); `.github/workflows/verify.yml` publica o relatório e os traces |

## Performance (§10)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| LH-1 | Início e detalhe, mobile e desktop, build otimizado, cenário padrão | — | Nada de Lighthouse no repositório |
| LH-2 | Perf ≥90, A11y ≥95, BP ≥95, SEO ≥90 (ou justificado) | — | |
| LH-3 | 3 medições, mediana; LCP, CLS, TBT | — | |
| LH-4 | Config, relatórios HTML/JSON, versões, ambiente versionados | — | |
| LH-5 | Sem simplificações exclusivas para a nota | — | |

## Entrega (§12)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| DEL-1 | Código, lockfile, assets, mocks, fixtures, testes, configs de auditoria | parcial | `package-lock.json`, `src/mocks`, `tests/`, `scripts/verify.mjs`. Faltam a configuração do Lighthouse e os assets das telas |
| DEL-2 | Deploy público == código; mocks e tempo real funcionando | — | `origin/main` = a067d1a, atrás de main (41b2d79); a produção não tem a CSP (SEG #12). Exige push, deploy e `BASE_URL=<prod> npx playwright test` |
| DEL-3 | Acesso direto e refresh no ambiente publicado | parcial | Contra `vite preview`: `00-smoke` "deep link e refresh", `qa-fundacao-shell`; rewrite SPA em `vercel.json`. Em produção só no spike 3 (build antigo) |
| DEL-4 | README: setup, env, credenciais, cenários/reset, comandos, reprodução de falhas | — | `README.md` não existe (só `src/mocks/README.md`) |
| DEL-5 | ARCHITECTURE: contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios Figma | parcial | `ARCHITECTURE.md` §2–§13 cobre todos os tópicos (lido nesta auditoria); precisa refletir as telas no fim |
| DEL-6 | Comandos: dev c/ mocks, build, preview, typecheck, lint, Playwright, Lighthouse | parcial | `package.json` scripts; `npm run lighthouse` → `lighthouse/run.mjs` inexistente |
| DEL-7 | Executa de checkout limpo sem serviços privados | parcial | `.github/workflows/verify.yml` roda de checkout limpo, sem backend; o passo visual fica vermelho até haver baselines `linux` (ARCHITECTURE §7.1) |
| DEL-8 | README declara uso de IA | — | Sem README |
