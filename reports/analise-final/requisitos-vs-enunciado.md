# auditor-requisitos — analise-final — 2026-11-04
Veredito: APPROVED (com ressalvas documentais e de prova; nenhum eliminatório violado)

Método: leitura de `docs/challenge.md` §1–§12 contra código, specs, README, ARCHITECTURE, lighthouse/. Não confiei na matriz. Não rodei build/Playwright (instrução). Executado por mim: `npx tsc -b --noEmit` (exit 0), greps abaixo.

Contagem (93 itens): ATENDE 87 · PARCIAL 4 · NÃO ATENDE 0 · FRACO 2.

## Greps eliminatórios (reproduzíveis, em `C:\Users\WenschZada\source\repos\nft-marketplace-challenge`)
- `grep -rnE "Number\(|parseFloat" src | grep -v ^src/mocks` → só o comentário `src/lib/money.ts:3`. Há `parseInt(x,10)` apenas em quantidade (`PurchasePanel.tsx:40,93,104`) e estrelas (`StarRating.tsx:7`): inteiros, não ETH. `src/mocks` também sem `Number(`/`parseFloat`. ESLint barra (`eslint.config.js` `noAppNumberCoercion`, `noFloatMoney`).
- `grep -rnE "from ['\"](@/mocks|\.\./mocks)|import\(.*mocks" src tests | grep -v ^src/mocks` → só `src/main.tsx:10`. ESLint cobre `src/**` e `tests/**` e `import()` dinâmico.
- Tests e cache: nenhum `setQueryData`/setter para simular evento. `05-unit-cache.spec.ts` usa `QueryClient` em Node para testar o reconciliador (teste unitário, não substitui socket). `account-helpers.ts`, `17-liberacao-listeners`, `20-session-tabs` leem `getQueryCache()` via fibra React, só leitura, para afirmar chaves/limpeza.
- Confirmação: `OrderPage.tsx:89` só renderiza `order-confirmed` com `data?.status === 'confirmed'`; `CheckoutForm.tsx:201` apenas navega para `/orders/$id`; não há `toast.success` de compra (os dois `toast.success` são carrinho `PurchasePanel.tsx:115` e favoritos `favorites.ts:112`).
- Chaves privadas: `src/queries/keys.ts` (`PRIVATE_PREFIX='u'`); nenhum `queryKey: ['orders'|'cart'|...]` literal fora de `keys.ts`. Visitante usa `['guest', id]` e `['session']` fica fora (documentado, ARCH §4/§9).
- Senhas: `src/mocks/crypto.ts` SHA-256 com salt; `passwordHash` no db; cliente guarda só token (`kurio.session`). Senha em claro só em `src/mocks/seed.ts:17-18` (seed fictício) e README. Nenhum `console` com senha. Fraqueza: SHA-256 rápido (aceito e documentado, ARCH §4).

## Tabela por item
| # | Item (§) | Veredito | Evidência | Lacuna |
|---|---|---|---|---|
| 1 | Stack obrigatória usada de verdade (§2) | ATENDE | `package.json`; Router `src/routes/`, Query `src/queries/`, Axios `src/api/client.ts`, socket `src/realtime/socket.ts:40`, MSW `src/mocks/`, shadcn `src/components/ui`, Playwright, `lighthouse/run.mjs` | — |
| 2 | Início: destaques, catálogo, busca, filtros, ordenação, navegação (§3) | ATENDE | `01-catalog` (destaques/grade, busca+filtros+ordenação+URL) | busca desktop é painel derivado (D16) |
| 3 | Detalhe: galeria, info, edição, qtd, favoritos, compra | ATENDE | `02-detail`, `04-favorites` | miniatura única (seed) D18 |
| 4 | Carrinho: qtd, remoção, cupom, resumo | ATENDE | `05-cart` | — |
| 5 | Pagamento: dados, carteira/rede, revisão, envio | ATENDE | `06-compra`, `07-pagamento-falhas` | D19 (diálogo de revisão, campos read-only) |
| 6 | Confirmação: resultado, transação, itens, taxas, total | ATENDE | `06-compra`, `Receipt.tsx` | altura 753 vs 821 px (D22); ícone "thank you" omitido |
| 7 | Login: auth, validação, retorno | ATENDE | `03-conta-sessao` (retorno ao destino; redirect externo descartado) | é rota, Figma mostra modal (D9) |
| 8 | Cadastro: criação, validação, conflito | ATENDE | `03-conta-sessao` (EMAIL_TAKEN, `register.email-taken`), `11-formularios-teclado` | — |
| 9 | Perfil: dados, avatar, senha | ATENDE | `08-perfil-carteiras` (avatar, senha, 409 versão) | — |
| 10 | Carteiras: principal e secundária | ATENDE | `08-perfil-carteiras` (secundária vazia, duplicado, persistência) | — |
| 11 | Frames desktop+mobile; perfil/carteiras/confirmação em mobile | ATENDE | projetos `desktop`+`mobile` rodam as mesmas specs (`playwright.config.ts`); `13-overflow` 390/768/1440; baselines `94-visual-conta` mobile | confirmação mobile sem baseline visual própria |
| 12 | Editorial/suporte/atividade/ofertas/downloads não aparentam sucesso | ATENDE | `sections.ts` → `/em-breve` ("Nenhuma ação foi realizada"); newsletter e login social desabilitados (`SiteFooter.tsx`, `LoginForm.tsx:49`) | — |
| 13 | Links externos/auxiliares coerentes | ATENDE | Todos `<Link>` internos ou `/em-breve`; externos reais: compartilhar LinkedIn/Twitter/mailto (`NftDetailPage.tsx:42-44`, com `rel`), `Receipt.tsx:106` Etherscan | Etherscan abre `etherscan.io/tx/<hash fictício>` (404 no site real); aviso "simulado" só em `sr-only`. Compartilhar some no mobile (`max-md:hidden`). Nenhum link vai a lugar nenhum |
| 14 | Busca/filtros/ordenação/paginação na URL, sobrevivem a refresh/histórico | ATENDE | `01-catalog:22` | — |
| 15 | Filtros combináveis; mudança zera paginação | ATENDE | `useCatalogSearch.ts`, `01-catalog:22` | — |
| 16 | Consultas refletem params; vazio, falha, fora de ordem | ATENDE | `01-catalog:77,89,106,115`, `keys.ts`+`AbortSignal` | — |
| 17 | Detalhe: direto, inexistente, edição indisponível, limite de qtd | ATENDE | `02-detail:12,31,40,52,58` | — |
| 18 | Favoritos persistem para usuário autenticado | ATENDE | `04-favorites:20`, `04b-favorites-page` | — |
| 19 | Carrinho add/alterar/remover com disponibilidade | ATENDE | `05-cart:45` | — |
| 20 | Carrinho após refresh; itens do visitante preservados ao autenticar | ATENDE | `05-cart:22,180` | — |
| 21 | Cupom aplicar/remover, inválido/expirado | ATENDE | `05-cart:95` | — |
| 22 | Subtotal/desconto/taxa/total vindos da API | ATENDE | `OrderTotals.tsx`, ARCH §5 (cliente não soma) | — |
| 23 | Refletir preço/disponibilidade com carrinho aberto | ATENDE | `05-cart:131` (via `window.__mock`) | — |
| 24 | ETH string decimal; qtd inteira; cotação da API é a referência | ATENDE | `src/lib/money.ts` (decimal.js), `money-unit.spec.ts`, `diffQuotes` usa `eq()` | — |
| 25 | Validar campos e permitir revisão | ATENDE | `ReviewDialog.tsx`, `06-compra:13` | — |
| 26 | Carteiras cadastradas, rede, conexão/recusa/desconexão | ATENDE | `07-pagamento-falhas:51` | — |
| 27 | Revalidar preço/disp./cupom/taxas; mudança exige nova confirmação | ATENDE | `CheckoutForm.tsx:166-176,127-133`, `StaleChanges.tsx`, `07:151`, `09-realtime-checkout` | — |
| 28 | Impedir pedidos duplicados (clique repetido, reenvio após timeout) | ATENDE | `submitting` ref + `Idempotency-Key` por fingerprint (`attempt.ts`), `07:69,90,111`, `14-reteste-final` | caminho UI de `IDEMPOTENCY_CONFLICT` (`CheckoutForm.tsx:221`) só provado via REST no harness |
| 29 | Pendente/confirmado/recusado com recuperação após refresh/reconexão | ATENDE | `10-pedido-pendente:33,59,96` | — |
| 30 | Confirmação só para pedido confirmado na simulação | ATENDE | `OrderPage.tsx:89`, `06-compra:113`, `10:96` | — |
| 31 | Itens preservados em falha; remove só comprado | ATENDE | `07:25`, `06-compra:89` (remoção parcial) | — |
| 32 | Recibo é snapshot | ATENDE | `06-compra:71` (inclusive após refresh), `Receipt.tsx` lê só o pedido | — |
| 33 | Cadastro, login, logout, sessão recuperável após refresh | ATENDE | `03:11,114`, `store.ts` | token em localStorage (documentado) |
| 34 | Expiração em navegação e checkout, contexto preservado | ATENDE | `03:91`, `07:178`, `21-session-clock-expiry` | — |
| 35 | Logout/troca limpam cache privado e subscriptions | ATENDE | `03:114,140`, `20-session-tabs`, `teardownSession` (`queries/session.ts`) | — |
| 36 | Validação (cadastro, perfil, senha, carteiras) incl. erros da API; persistência | ATENDE | `08`, `11`, `forms.server-validation` | — |
| 37 | Credenciais fictícias; sem senha em claro | ATENDE | ver greps | SHA-256 rápido no mock (documentado) |
| 38 | Contratos tipados transporte→estado→UI | ATENDE | zod em `src/api/contracts`, `queryOptions` tipados com `DataTag`, tsc exit 0 | — |
| 39 | Estados loading/vazio/erro/sucesso/background | ATENDE | `12-skeletons`, `01:77,106`, `08:181` | — |
| 40 | Invalidação coerente após mutations e eventos | ATENDE | ARCH §7/§8, `reconcile.ts`, `05-cart:131` | — |
| 41 | Cancelamento/descarte de respostas obsoletas | ATENDE | `AbortSignal`, `keepNewest`, `ownedQueryFn`, `01:115` | — |
| 42 | Isolamento por usuário e por parâmetros | ATENDE | `keys.ts`, `03:140`, `04b`, `06-compra:113`, `20-session-tabs` | — |
| 43 | Recuperação sem duplicar operações | ATENDE | `07:90`, `14-reteste-final` | — |
| 44 | Rotas inexistentes e acesso direto a qualquer tela | ATENDE | `02:31`, `01:95`, `qa-fundacao-shell`, `vercel.json` rewrite | — |
| 45 | Otimismo com rollback | ATENDE | `04-favorites:42`, `05-cart:76` | — |
| 46 | Política de cache/retries/sincronização documentada | ATENDE | ARCHITECTURE §7 (tabela de staleTime, retries, invalidação) e §8 | — |
| 47 | Router (rotas, search, guarda), Query, Axios | ATENDE | `routes/_authed.tsx`, `validateSearch`, `client.ts` único cliente | — |
| 48 | 8 recursos REST | ATENDE | `src/api/contracts/endpoints.ts` + ARCH §2.2 (sessão, NFTs, favoritos, carrinho, cotação, pedidos, perfil, carteiras) | — |
| 49 | 6 tipos de erro (validação, sessão, permissão, 404, conflito, transitória) | ATENDE | `errors.ts`, ARCH §2.3, `mocks.spec.ts` | — |
| 50 | Idempotência (mesma chave = mesmo pedido; conteúdo diferente = conflito) | ATENDE | `mocks.spec.ts` (IDEMPOTENCY_CONFLICT), `07:90` | — |
| 51 | MSW em camada de rede; sem respostas fictícias em app | ATENDE | greps; `src/mocks/handlers/*` | — |
| 52 | Estado consistente, persistência, reset | ATENDE | `db.ts` (localStorage versionado), `window.__mock.reset`, README | — |
| 53 | Lentidão, latência variável, timeout, offline, HTTP erro | ATENDE | `scenarios.ts` (`latency.*`, `network.*`, `http.*`) | — |
| 54 | Fixtures variados, ≥2 usuários | ATENDE | `seed.ts` (Alice, Bob; catálogo paginável) | — |
| 55 | Cenários determinísticos listados no §6 | ATENDE | `scenarios.ts` (23 cenários cobrindo todos os bullets), README tabela | — |
| 56 | Binding Socket.IO e limitações documentados | ATENDE | README "Tempo real simulado", ARCH §11 | — |
| 57 | Cenários exercitam `socket.io-client` | ATENDE | `tests/fixtures.ts` → `window.__mock.emit` → frame ws → `src/realtime/socket.ts` | — |
| 58 | Mocks por configuração e no build de demo | ATENDE | `VITE_ENABLE_MOCKS`, `.env.production`, `src/main.tsx` | `window.__mock` exposto em produção (aceito: build de demo) |
| 59 | `nft.updated` e `order.updated` | ATENDE | `reconcile.ts:136,229`, `01:127`, `02:94`, `10` | — |
| 60 | Eventos com id estável, recurso, versão | ATENDE | `contracts/events.ts`, ARCH §3 | — |
| 61 | Duplicatas e antigos não regridem | ATENDE | `10:74`, `05-unit-cache.spec.ts` | — |
| 62 | Reconexão reconcilia com REST | ATENDE | `socket.ts:76`, `10:59` | — |
| 63 | Evento de sessão anterior não atualiza outro usuário | ATENDE | `reconcile.ts:229`, `20-session-tabs`, `17` | — |
| 64 | Listeners/subscriptions liberados | ATENDE | `socket.ts:58-60`, `17-liberacao-listeners` | — |
| 65 | Cenário de 4 passos (preço muda → aviso → resumo → checkout barra) | ATENDE | `09-realtime-checkout:14,41,56` | — |
| 66 | Interrupção com pedido pendente; terminais | ATENDE | `10:33,59,96` | — |
| 67 | Skeleton+shimmer em catálogo, detalhe, resumo; sem CLS; reduced motion | ATENDE | `12-skeletons:9,37,45,51`, `05-cart:158,203` | — |
| 68 | 7 obrigações de a11y | ATENDE | teclado/foco `11`,`15-foco-dialogos`; semântica/labels `11`; axe `91/93/95` (contraste, alt); live regions (`role=status/alert`); zoom `16-zoom-reflow`; overflow `13` | alt decorativo (`alt=""`) em promos |
| 69 | Assets do arquivo, imagens e fontes locais | ATENDE | `public/nft`, `public/fonts` (OFL), `design/assets` | — |
| 70 | Documentar substituição de asset e ajustes de a11y vs layout | PARCIAL | ARCH §13 D1–D40 (D5 ícones sociais, D17, D32, D21), `docs/figma.md` | espalhado; sem lista consolidada de assets substituídos/omitidos; README cita "D1 a D32" mas existe D40 |
| 71 | Tablet 768 | PARCIAL | `13-overflow` (390/768/1440 geométrico), `92-header-tablet` (visual do header), D30 | axe e regressão visual não rodam em 768; sem frame; só layout derivado |
| 72 | Preservar tipografia/cores/espaços/proporções do Figma (§8, 20 pts) | FRACO | tokens `@theme`, `design/ref`, relatórios de medição em `reports/s-integrada/fidelidade-img/measure.json` | Baselines visuais são auto-referentes (não comparam com Figma). Último relatório de fidelidade versionado é `CHANGES_REQUESTED` (`reports/s-integrada/fidelidade-visual.md`) e não há re-medição formal após D30/D31; dev de alturas D14/D22 |
| 73 | 12 grupos de E2E | ATENDE | 1→`01`; 2→`02`; 3→`03,20,21`; 4→`04,04b`; 5→`05`; 6→`06`; 7→`07`; 8→`08`; 9→`09`; 10→`10`; 11→`11,15`; 12→`12` | — |
| 74 | Chromium desktop e mobile | ATENDE | `playwright.config.ts` projects desktop 1440 / mobile 390 | — |
| 75 | Regressão visual de início, detalhe, carrinho, pagamento; baselines versionadas, dados estáveis | ATENDE | `tests/__screenshots__/{win32,linux}`, `90-visual-catalog`, `96-visual-checkout`, `updateSnapshots:'none'` no CI | tolerância `maxDiffPixelRatio 0.01` é folgada |
| 76 | Estado isolado por teste | ATENDE | `tests/fixtures.ts` (storage limpo + `reset`) | — |
| 77 | Controle de relógio, latência e eventos | FRACO | latência por cenário; eventos por `__mock`; `page.clock` só em `21-session-clock-expiry` e `20-session-tabs` | pagamento pendente→confirmado depende de 1,5 s reais; 6 `waitForTimeout` remanescentes (`01`,`12`,`20`,`mocks`) |
| 78 | Relatório HTML e traces de falhas | ATENDE | `reporter html`, `trace:'retain-on-failure'`, artefatos no CI | `retries:1` mascara flake (aparece como "flaky") |
| 79 | Verificações observam UI; RT via socket, REST via MSW | ATENDE | specs usam locators/asserts de UI; `mocks.spec.ts` bate nos handlers | — |
| 80 | Lighthouse: config, 3 medições, medianas, HTML/JSON, versões, ambiente | ATENDE | `lighthouse/config/{mobile,desktop}.mjs`, `run.mjs`, `reports/2026-11-04/` (12 pares HTML/JSON, `summary.*`), `environment.md` (LH 13.6.0, Chromium 156, Node 26.8.1) | rodado em preview local, não na produção; execuções com `NO_NAVSTART` descartadas e repetidas (documentado) |
| 81 | Metas Perf ≥90 / A11y ≥95 / BP ≥95 / SEO ≥90 | PARCIAL | A11y/BP/SEO 100; desktop 97/98; **mobile 70/68** | 2 de 16 células abaixo da meta |
| 82 | LCP, CLS, TBT registrados e justificativa | ATENDE | `lighthouse/README.md` "Resultado final e justificativa" (LCP 5,8 s simulado vs 0,65 s observado; 528 KB gz, 1/3 mocks) | justificativa honesta, mas causa raiz é carga do MSW no caminho crítico |
| 83 | Elim.: uso efetivo da stack | ATENDE | linha 1 | — |
| 84 | Elim.: fluxos não só visuais | ATENDE | compra ponta a ponta via REST/MSW (`06`, `07`) | — |
| 85 | Elim.: compra confirmada sem resposta da simulação | ATENDE | `OrderPage.tsx:89`; tentei achar caminho: navegação pós-POST vai para página que lê `status`; sem toast; 409/timeout não confirmam | — |
| 86 | Elim.: exposição entre usuários | ATENDE | `06-compra:113`, `04b`, `auth.forbidden`, `reconcile.ts:229`, `['u',id]` + `ownedQueryFn` | mock DB em localStorage legível por DevTools (inerente à simulação) |
| 87 | Elim.: eventos simulados diretamente na UI | ATENDE | greps; `RealtimeBridge` só recebe do `socket.io-client` | `05-unit-cache` usa `setQueryData` num QueryClient em Node (unitário) |
| 88 | Elim.: ausência de E2E executáveis | ATENDE | verify verde (orquestrador), 40 specs | — |
| 89 | Deploy obrigatório, rotas diretas/refresh | ATENDE | `vercel.json` rewrite; produção 502 testes (orquestrador) | não verifiquei a URL (instrução) |
| 90 | README com todos os itens | PARCIAL | setup, env (`.env.example`), credenciais, cenários/reset, comandos, tabela de falhas — todos presentes | `README.md:178` e ARCH §12 (l.295) dizem que `/favorites` é "Em construção", mas `FavoritesPage.tsx`, D40 e `04b` provam que existe; "D1 a D32" desatualizado |
| 91 | ARCHITECTURE com contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios | ATENDE | §2,3,4,5,7,8,11,12,13 | texto estratificado por rodadas (marcado); stale em §12 |
| 92 | Comandos dev/build/preview/tipos/lint/Playwright/Lighthouse | ATENDE | `package.json` scripts | — |
| 93 | Checkout limpo, sem backend privado | ATENDE | `npm ci`+verify verde em clone (orquestrador); nenhum serviço externo | — |

## (a) O que falta ou é frágil, por impacto (pesos §11)
1. Fidelidade visual (20): sem comparação automatizada com o Figma; baselines são auto-referentes e o último relatório de fidelidade versionado é `CHANGES_REQUESTED` sem re-medição formal; alturas divergem por D14 (editorial omitido), D22, D11.
2. Performance (5): mobile 70/68 abaixo de 90; justificado, mas é a única meta explicitamente falha.
3. Documentação (5): README/ARCH ainda afirmam `/favorites` "em construção" (contradiz o código e a D40); falta lista consolidada de assets/ajustes de a11y; D1–D32 vs D40.
4. Testes (10): controle de relógio pouco usado fora de sessão; `waitForTimeout` remanescentes; `retries:1`; tolerância visual 1%; 768 sem axe/visual; caminho UI de `IDEMPOTENCY_CONFLICT` sem E2E.
5. Fluxos (20): login/cadastro como rota, não modal (D9), confirmação como rota; "Diário da Cunhagem" omitido (D14).
6. BUG-QA-010 (link Lista de interesse fora do sheet mobile) e BUG-QA-013 abertos (baixa).

## (b) Além do pedido
Sincronização de sessão entre abas (`20-session-tabs`); CSP completa com teste de violações (`06-csp`); `safeRedirectSchema` anti open-redirect; `keepNewest` e reaplicação de evento sobre REST atrasado; página de favoritos; CONFLICT_VERSION em perfil/carteira; fonte e assets locais; CI Linux com baselines e workflow de regeneração; detecção de zoom/reflow a 200%.

## (c) Riscos numa avaliação rígida
- O avaliador abre README e lê "Em construção" em `/favorites`, depois acha a página funcionando: sinal de documentação descuidada.
- Perf mobile 70 será lida como meta falha mesmo com justificativa; "mocks no caminho crítico" é argumento defensável, mas LH pede "sem simplificações", então não há remédio fácil.
- `window.__mock` exposto em produção e `05-unit-cache` com `setQueryData` podem ser lidos como "setters/cache" por um revisor apressado; mitigação: o teste é unitário e o cliente nunca chama `__mock`.
- Fidelidade 20 pts sem prova automática contra o Figma; frames ausentes (tablet, perfil/carteiras mobile) são derivados.
- Flakes aceitos via `retries:1` (testes "flaky" só no retry).
- Link "Ver no Etherscan" abre página real inexistente (tx fictícia).
