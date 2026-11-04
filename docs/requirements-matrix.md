# Matriz de requisitos

Fonte: [challenge.md](challenge.md) (seção entre parênteses). Status: `—` pendente · `parcial` · `OK` (só com evidência executada).
Evidência = spec Playwright, arquivo, relatório ou print. Mantida pelo agente **auditor-requisitos**.

**Última auditoria:** 2026-11-04, slice `s-integrada` (S1 catálogo + S2 conta + S3 checkout, rodada 2), base `main` fd8f5b5 (= `origin/main`, conferido com `git ls-remote`).
Evidência desta auditoria: leitura de `reports/s-integrada/{qa-features,seguranca,revisor-frontend-senior,fidelidade-visual}.md`, dos specs de `tests/e2e/` e de `src`; greps executados (abaixo). Por instrução do orquestrador **não** rodei build, preview nem verify: vale o `npm run verify` GREEN em fd8f5b5 (`reports/verify-latest.md`: typecheck, lint, build, e2e 390, visual 22, a11y 28). Os relatórios de QA (6/6 do `qa-integrada.spec.ts`) e de segurança (4/4 do `s2s3.sec.spec.ts`, `npm audit` 0) foram executados pelos respectivos agentes.
Greps executados em fd8f5b5: `Number(`/`parseFloat` em `src` fora de `src/mocks` = só o comentário de `src/lib/money.ts:3`; `Number(` em `tests` = zero; import de `@/mocks` ou `../mocks` fora de `src/mocks` = zero (resta `src/main.tsx`, permitido); `setQueryData`/`.handle(` em `tests` = só `05-unit-cache` (QueryClient isolado, teste de unidade); `queryKey: [` fora da factory = só `reconcile.ts`, com `owner` vindo de `queryKeys`; `fetch(`/`XMLHttpRequest` fora dos mocks = zero; `useMutation` em 8 arquivos de `src`; `eslint.config.js` proíbe `Number()` em todo o app fora dos mocks.
Abreviações: **verify** = verify fd8f5b5 · **harness** = `tests/e2e/mocks.spec.ts` · **QA/SEG/REV/FID** = relatórios de `reports/s-integrada/`.

## §9 Testes: grupo → spec

Os specs não seguem a numeração do §9 (QA #1). Todos rodam no verify, em desktop e mobile.

| §9 | Grupo | Spec(s) |
|---|---|---|
| 1 | Busca, filtros, ordenação, paginação, histórico | `01-catalog` |
| 2 | Detalhe direto e inexistente | `02-detail` |
| 3 | Cadastro, login, expiração, logout, troca de usuário | `03-conta-sessao`, `20-session-tabs`, `21-session-clock-expiry`, `07-pagamento-falhas` (expira no envio) |
| 4 | Favoritos com falha e recuperação | `04-favorites` |
| 5 | Carrinho, quantidades, remoção, cupom, persistência | `05-cart`, `qa-integrada` |
| 6 | Compra completa até o recibo | `06-compra`, `qa-integrada` |
| 7 | Falha de pagamento, clique repetido, timeout com o mesmo pedido | `07-pagamento-falhas` |
| 8 | Perfil, avatar, senha, carteiras com erros | `08-perfil-carteiras` |
| 9 | Preço/disponibilidade via Socket.IO no checkout | `09-realtime-checkout`, `05-cart` (nft.updated) |
| 10 | Duplicados/antigos, desconexão, pedido pendente | `10-pedido-pendente`, `00-smoke` (tempo real) |
| 11 | Teclado, foco de diálogos, validação | `11-formularios-teclado`, `07-focus`, `qa-fundacao-shell`, `08` (validação) |
| 12 | Skeletons em lentidão, falha e retry | `12-skeletons`, `05-cart` (estados, resumo lento), `08` (estados) |

Apoio: `mocks.spec` (harness do mock), `05-unit-cache` e `money-unit` (unidade), `13-overflow`, `90/94/96-visual-*`, `91/93/95-a11y-*`, `06-csp`.

## Pendências que bloqueiam entrega

1. **ELIM-1 / STK-9 / LH-1..5 / DEL-6: Lighthouse.** Confirmado ausente: não há diretório `lighthouse/` (o script `npm run lighthouse` aponta para `lighthouse/run.mjs`, inexistente) nem relatórios. Em andamento por outro agente (não verificável aqui).
2. **DEL-4 / DEL-8: README.** Confirmado: `README.md` não existe na raiz. Faltam setup, env, credenciais, cenários e reset, falhas, comandos e a declaração de uso de IA.
3. **E2E-14 / STK-8 / DEL-7: baselines visuais Linux.** Confirmado: `tests/__screenshots__/linux` tem 6 imagens (só shell e `92-header-tablet`); `win32` tem 22. Faltam catálogo, detalhe, carrinho, pagamento, login, cadastro, perfil e carteiras. O CI (`verify.yml`) fica vermelho no passo visual até isso. Gerar com o workflow `visual-baselines` (workflow_dispatch), revisar as imagens e commitar.
4. **DEL-7: checkout limpo.** Não executado (nenhum `npm ci` num clone novo nesta auditoria). Depende das pendências 1 a 3: sem README o setup não está documentado e o CI de checkout limpo falha no visual.
5. **DEL-2: deploy igual ao HEAD.** `git ls-remote origin main` = fd8f5b5 = HEAD (push feito) e a produção responde 200, mas **não confirmei** que o deploy servido é fd8f5b5 (sem build id exposto) e o smoke `BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test` não foi executado. Refazer depois de cada push (cada push publica).

Abertos que não bloqueiam: (a) FID tem veredito `CHANGES_REQUESTED` sem relatório de reverificação; os achados altos de 768 px (Detalhe, Perfil) têm cobertura posterior em `13-overflow` (verify verde, commit 0d52b21), mas a imagem principal do Detalhe (404 px contra 444 px no Figma, média) e a Confirmação (`/orders/$id`) nunca foram medidas; (b) REV médias #4 (`throw new Error` em vez de `ApiError`) e #5 (duplicações entre slices) sem evidência de correção; #1, #2 e #3 estão corrigidas (`OrderPage.tsx:53`, `OrderPage.tsx:45/94`, `favorites.ts:94`; specs `07` "abrir um pedido terminal antigo…", `10` "o foco vai para o título", `04` "cliques rápidos"); (c) flake F1 do CSP sweep sem reconfirmação da correção (um único verify verde); (d) `waitForTimeout` em 5 pontos (QA #4); (e) zoom 200% não testado (A11Y-7).

## Eliminatórios (§11)

| ID | Requisito | Status | Evidência e o que falta |
|---|---|---|---|
| ELIM-1 | Uso efetivo de toda a stack obrigatória (§2) | parcial | React, TS, Router, Query (queries e `useMutation` em 8 arquivos), Axios (zero `fetch` fora dos mocks), socket.io-client, Tailwind, shadcn, MSW e Playwright participam de verdade. **Falta:** Lighthouse (zero) |
| ELIM-2 | Fluxos principais funcionais (não apenas visuais) | OK | `qa-integrada` (6/6 pela UI: visitante adiciona, login com merge, cupom, checkout, pendente, confirmado/recusado, logout e troca), `06-compra`, `03`, `05-cart`, `08`; verify 390 e2e |
| ELIM-3 | Compra confirmada apenas com resposta da simulação | OK | `10-pedido-pendente` "recusado é terminal… confirmação só vem da simulação", `qa-integrada` (pendente: reload mantém pendente, sem recibo; `settleOrder confirmed` → recibo), `06-compra`, SEG passo 1; QA: `OrderPage`/`Receipt` só com `status === 'confirmed'` |
| ELIM-4 | Sem exposição de dados entre usuários | OK | SEG `s2s3.sec` (alice → bob: DOM, cache, storage, socket sem dados; 403/404 em recurso alheio; 4/4), `03` "troca de usuário pela tela de login", `20-session-tabs`, `qa-integrada`. Toda chave privada sai de `queryKeys` (`['u', userId]`, REV). Baixas SEG #1 a #5 abertas, nenhuma bloqueia |
| ELIM-5 | Eventos passam por `socket.io-client` (nunca direto na UI) | OK | `09`, `10`, `05-cart` e `00-smoke` disparam só por `window.__mock` (`emit`/`updateNft`/`settleOrder`) → MSW `ws.link` → socket.io-client → reconciler; único `.handle(` fora dos mocks é o do socket (QA). `05-unit-cache` usa QueryClient isolado, é teste de unidade e não é citado como evidência de §9 |
| ELIM-6 | Testes E2E executáveis | parcial | verify GREEN: 390 e2e + 22 visuais + 28 a11y, desktop e mobile, 12 grupos do §9 cobertos (tabela acima). **Falta:** baselines Linux (o CI de checkout limpo falha no visual) e reconfirmar a estabilidade do gate (flake F1; um verify verde só) |

## Stack (§2)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| STK-1 | React + TypeScript | OK | verify (`tsc -b --noEmit` PASS; REV: zero `any`/`@ts-*`) |
| STK-2 | TanStack Router em rotas, search params e proteção de fluxos privados (§4) | OK | `src/routes/*` (file-based, `autoCodeSplitting`), `validateSearch`, `_authed.beforeLoad`; `01-catalog` (URL), `03` (redirect), `qa-fundacao-shell` "guard _authed" |
| STK-3 | TanStack Query em consultas, mutations e sincronização de cache (§4) | OK | Mutations de carrinho, favoritos, pedido, conta e carteiras (8 arquivos); `05-cart` e `04-favorites` (otimismo e rollback); `realtime/reconcile.ts` (`09`, `10`) |
| STK-4 | Todas as chamadas REST via Axios (§4) | OK | `src/api/client.ts`; grep `fetch(`/`XMLHttpRequest` fora dos mocks = zero; `qa-volta2` "QA-004/005 runtime" |
| STK-5 | Socket.IO em tempo real | OK | `src/realtime/socket.ts`; `09`, `10`, `05-cart`, `00-smoke` via `window.__mock` |
| STK-6 | Tailwind CSS + shadcn/ui adaptado à identidade (§8) | OK | `src/index.css` `@theme`, `components.json`, `src/components/ui/*` usados nas telas (Dialog da revisão, Select, Sheet, Dropdown); FID mediu cores e tipografia das 8 telas |
| STK-7 | MSW para REST e eventos | OK | `src/mocks/browser.ts` + `ws.link`; toda a suíte de app roda sobre ele; harness exercita os 24 cenários |
| STK-8 | Playwright E2E + regressão visual | parcial | `playwright.config.ts` (desktop e mobile), verify: 390 e2e, 22 visuais, 28 a11y. Baselines só `win32` para as telas (Linux: 6 de 28) |
| STK-9 | Lighthouse | — | Sem dependência e sem `lighthouse/run.mjs` (pendência 1) |

## Telas (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| TEL-1 | Início: destaques, catálogo, busca, filtros, ordenação, navegação ao NFT | OK | `01-catalog`; `90-visual-catalog`; FID (hero e seções) |
| TEL-2 | Detalhe: galeria, informações, edição, quantidade, favoritos, compra | OK | `02-detail`, `04-favorites`, `05-cart` (adicionar), `qa-integrada` (compra a partir do detalhe) |
| TEL-3 | Carrinho: quantidades, remoção, cupom, resumo de valores | OK | `05-cart`, `96-visual-checkout` carrinho |
| TEL-4 | Pagamento: dados do colecionador, carteira e rede, revisão, envio | OK | `06-compra`, `07-pagamento-falhas`, `96-visual-checkout` pagamento |
| TEL-5 | Confirmação: resultado, id da transação, itens, taxas, total | OK | `06-compra` (recibo), `10-pedido-pendente`, `95-a11y-checkout` (pendente, confirmado, recusado). Fidelidade da tela não medida (FID) |
| TEL-6 | Login: autenticação, validação, retorno ao fluxo anterior | OK | `03` (retorno ao destino, credenciais erradas, redirect externo descartado), `11` (teclado e validação), `94-visual-conta` |
| TEL-7 | Cadastro: criação, validação, tratamento de conflito | OK | `03` (cria conta, `EMAIL_TAKEN` no campo, cenário `register.email-taken`), `11` (regras de senha) |
| TEL-8 | Perfil: dados, avatar, alteração de senha | OK | `08-perfil-carteiras` (dados após refresh, validação, erros da API, `CONFLICT_VERSION`, avatar, senha) |
| TEL-9 | Carteiras: principal e secundária, cadastro e edição | OK | `08-perfil-carteiras` (principal e secundária, EVM x Solana, duplicado, `CONFLICT_VERSION`) |
| TEL-10 | Frames desktop e mobile; perfil/carteiras/confirmação funcionais em mobile | parcial | Specs funcionais rodam no projeto mobile 390 (verify); FID mediu as telas em 390/768/1440. **Falta:** medir a Confirmação; imagem principal do Detalhe 404 px contra 444 px (média, FID #3) sem correção registrada |
| TEL-11 | Fora de escopo (editorial, suporte, atividade, ofertas, downloads) não aparenta sucesso; links externos coerentes | parcial | `qa-fundacao-shell` "nenhum link morto; /em-breve não aparenta sucesso". **Falta:** auditoria das ações auxiliares das telas novas (compartilhar, explorer) além de SEG (`noopener`, https) |
| TEL-12 | Estados não desenhados seguem o padrão visual | parcial | Estados cobertos funcionalmente (`05-cart`, `08`, `12`, `06` "Pedido indisponível") e `PageStates`. **Falta:** FID não mediu os estados de erro e vazio das telas novas |

## Catálogo e detalhe (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAT-1 | Busca, filtros, ordenação e paginação na URL; sobrevivem a refresh e histórico | OK | `01-catalog` "busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico" |
| CAT-2 | Filtros combináveis; mudança de filtro reinicia paginação | OK | `01-catalog` mesma spec |
| CAT-3 | Consultas refletem parâmetros enviados à API | OK | `01-catalog`: `waitForRequest` confere `categories`, `networks`, `sort`, `page` |
| CAT-4 | Resultado vazio, falha e respostas fora de ordem tratados | OK | `01-catalog` (vazio, 503 com retry, fora de ordem), `12-skeletons` |
| DET-1 | Acesso direto ao detalhe | OK | `02-detail` acesso direto + refresh com `?edition=` |
| DET-2 | NFT inexistente | OK | `02-detail` ("NFT não encontrado", id malformado) |
| DET-3 | Edição indisponível | OK | `02-detail` edição esgotada e NFT totalmente esgotado |
| DET-4 | Limite de quantidade | OK | `02-detail` stepper, erro no campo, 409 mapeado ao campo |
| FAV-1 | Favoritos persistem para o usuário autenticado | OK | `04-favorites` (persiste após refresh, desfavoritar, visitante vai ao login e volta, cliques rápidos em ordem) |

## Carrinho (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAR-1 | Adicionar, alterar e remover respeitando disponibilidade por NFT/edição | OK | `05-cart` "quantidade respeita a disponibilidade e remoção atualiza o resumo", `02-detail` |
| CAR-2 | Persistência após refresh | OK | `05-cart` "visitante: … persistência após refresh", "usuário logado: carrinho próprio persiste"; `qa-integrada` |
| CAR-3 | Itens do visitante preservados ao autenticar | OK | `05-cart` "itens do visitante preservados ao autenticar", `qa-integrada` (login com merge) |
| CAR-4 | Aplicar/remover cupom; inválido e expirado tratados | OK | `05-cart` "cupom válido, remoção, inválido e expirado"; `qa-integrada` (cupom persiste após reload) |
| CAR-5 | Subtotal, desconto, taxa de rede e total coerentes com a API | OK | `05-cart` "resumo vindo da cotação"; `96-visual-checkout` |
| CAR-6 | Reflete preço/disponibilidade recebidos com carrinho aberto | OK | `05-cart` "preço e disponibilidade chegam por nft.updated com o carrinho aberto" (`cart-announcer`) |
| MON-1 | ETH como string decimal com precisão em cálculo e apresentação; quantidades inteiras | OK | `ethSchema` nos contratos; `src/lib/money.ts` (decimal.js) com `money-unit` (float, subtração, arredondamento 18 casas); grep zero `Number(`/`parseFloat` em `src` e em `tests`; lint `noAppNumberCoercion` em todo o app |
| MON-2 | Cotação da API é a referência para finalizar | OK | `07` "409 QUOTE_STALE mostra o diff e exige nova confirmação", `09` (preço muda com checkout aberto); REV (envio bloqueado até "Aceitar novos valores") |

## Pagamento e confirmação (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| PAG-1 | Validação dos campos do layout e revisão antes do envio | OK | `06-compra` "com validação e revisão"; `95-a11y-checkout` (erros e revisão) |
| PAG-2 | Carteiras cadastradas, seleção de rede, simulação de conexão/recusa/desconexão | OK | `07` "carteira recusa a conexão e depois conecta; desconectar bloqueia o envio" |
| PAG-3 | Revalidar preço, disponibilidade, cupom e taxas antes de confirmar; mudança exige nova confirmação | OK | `07` (QUOTE_STALE), `09` (preço e esgotamento com o checkout aberto, cenário `checkout.price-changed`) |
| PAG-4 | Sem pedido duplicado em clique repetido ou reenvio após timeout | OK | `07` "clique repetido: um único POST", "timeout após criação: … mesma chave … mesmo pedido", "abrir um pedido terminal antigo não perde a chave"; SEG passo 2 (replay 200, corpo diferente 409) |
| PAG-5 | Estados pendente/confirmado/recusado com recuperação após refresh ou reconexão | OK | `10` (refresh pendente, queda de conexão, recusado permanece), `qa-integrada` |
| PAG-6 | Confirmação exibida só para pedido confirmado na simulação | OK | = ELIM-3 |
| PAG-7 | Itens preservados em falha; após confirmação remove só itens/quantidades comprados | OK | `07` "pagamento recusado: itens preservados", `06` "remoção parcial: só o comprado sai", `qa-integrada` (recusado preserva carrinho) |
| PAG-8 | Recibo reproduz snapshot; mudanças no catálogo não alteram; referências/links simulados | OK | `06` "recibo é snapshot … também após refresh"; SEG (`explorerUrl` só https, `rel="noopener noreferrer"`) |

## Conta e sessão (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CON-1 | Cadastro, login, logout e sessão integrados à API simulada | OK | `03` (cadastro, login, logout pela UI), `20-session-tabs`, harness auth |
| CON-2 | Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação | OK | `qa-fundacao-shell` "guard _authed" (5 rotas), `03` "rota privada sem sessão", `04` (visitante vai ao login) |
| CON-3 | Sessão recuperável após refresh | OK | `03` (sessão sobrevive ao refresh), `qa-fundacao-shell`, `00-smoke` |
| CON-4 | Expiração durante navegação e checkout, preservando contexto para retomada | OK | `03` "sessão expira durante a navegação", `21-session-clock-expiry`, `07` "sessão expira no envio: o checkout é retomado … com o mesmo rascunho" |
| CON-5 | Logout/troca de usuário limpa cache privado e subscriptions | OK | `03` "troca de usuário pela tela de login", `20-session-tabs`, SEG (cache, DOM, storage e socket de alice vazios para bob) |
| CON-6 | Validação de cadastro, perfil, senha e carteiras, incluindo erros da API | OK | `03`, `08` (cliente e `forms.server-validation`, `EMAIL_TAKEN`), `11` |
| CON-7 | Alterações confirmadas permanecem após refresh | OK | `08` (perfil após refresh, carteiras após refresh, avatar persiste) |
| CON-8 | Credenciais fictícias; senhas nunca em claro | OK | Harness "passwords are only stored hashed"; SEG passo 8 (senhas e tokens fora de storage, URL e console) |

## Integração e estado (§4)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| INT-1 | Contratos tipados transporte → estado → interface | OK | zod em request e response (`src/api/contracts`), `DataTag` nas keys, verify typecheck PASS, REV (zero `any`) |
| INT-2 | Estados loading, vazio, erro, sucesso, atualização em segundo plano | OK | `12-skeletons`, `05-cart` "estados", `08` "estados: skeleton, erro com nova tentativa e atualização em segundo plano" |
| INT-3 | Invalidação coerente após mutations e eventos | OK | `reconcile.ts` (`09`, `10`), `onSettled` das mutations (REV), `05-cart` (rollback) |
| INT-4 | Cancelamento/descarte de respostas obsoletas | OK | `qa-volta2` "cancelamento…" (`ownedQueryFn`), `01-catalog` fora de ordem, REV (`isCurrentOwner` após cada `await`) |
| INT-5 | Isolamento por usuário e por parâmetros | OK | `src/queries/keys.ts` (`['u', userId]`, `['guest', id]`), REV (sempre pela factory), SEG, `20-session-tabs` |
| INT-6 | Recuperação de falhas sem duplicar operações | OK | `07` (timeout com a mesma chave), `12-skeletons` (retry), retry só em TRANSIENT (REV) |
| INT-7 | Rotas inexistentes e acesso direto a qualquer tela | OK | `00-smoke` 404 e deep link, `qa-fundacao-shell`, `06` "pedido de outro usuário e id inexistente", `vercel.json` rewrite |
| INT-8 | Atualização otimista com rollback (≥1) | OK | `04-favorites` falha, `05-cart` "atualização otimista: falha da API reverte a quantidade" |
| INT-9 | Política de cache, retries e sincronização documentada | OK | ARCHITECTURE §7 e §8; `src/queries/client.ts` |

## Contratos REST (§5)

Status sobre contrato + mock (harness executado no verify) e, onde há, consumo pela UI.

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| API-1 | Sessão/conta: cadastro, login, sessão, logout, expiração | OK | Harness auth, `session.expired`; `03` pela UI |
| API-2 | NFTs: listagem com busca/filtros/ordenação/paginação; detalhe | OK | Harness "catalog filters…"; `01-catalog`, `02-detail` |
| API-3 | Favoritos: consulta, inclusão, remoção | OK | `04-favorites` (PUT e DELETE bem-sucedidos pela UI com persistência após refresh; 503 sob falha) |
| API-4 | Carrinho: consulta, inclusão, alteração, remoção | OK | Harness "guest cart…"; `05-cart` |
| API-5 | Cotação: cupom, disponibilidade, descontos, taxas, total | OK | Harness; `05-cart`, `09` |
| API-6 | Pedidos: criação idempotente; consulta de estado e recibo | OK | Harness "orders are idempotent…"; `06`, `10` |
| API-7 | Perfil: consulta, dados/avatar, senha | OK | Harness; `08` |
| API-8 | Carteiras: consulta, cadastro, atualização | OK | Harness (409 por versão); `08` |
| API-9 | Erros: validação, sessão inválida, sem permissão, inexistente, conflito de disponibilidade, falha transitória | OK | Harness; `qa-volta2` "QA-004/005 runtime"; SEG (403/404) |
| API-10 | Idempotency key: mesma tentativa → mesmo pedido; mesma chave com conteúdo diferente → conflito | OK | Harness; `07`; SEG passo 2 (200 com o mesmo `ord_*`; 409 `IDEMPOTENCY_CONFLICT`) |
| API-11 | Contratos documentados | OK | ARCHITECTURE §2 e §3; `src/api/contracts/endpoints.ts` |

## Mocking (§6)

Status sobre a camada de mocks. O efeito de cada cenário na UI está nas linhas de telas, CAT, CAR, PAG e E2E.

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| MSW-1 | Mocks na camada de rede, reusados em dev, demo e testes | OK | SW do MSW + `ws.link`; `VITE_ENABLE_MOCKS=true` em `.env.development` e `.env.production`; suíte contra o build de produção |
| MSW-2 | Nenhuma resposta fictícia em componentes, hooks ou Axios | OK | Grep: zero import de `src/mocks` fora dele além de `src/main.tsx`; ESLint `no-restricted-imports`; REV: fixtures só em `browser-*.js` (`grep -l "Aurora Digital" dist/assets/*.js`) |
| MSW-3 | Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras, pedidos | OK | Harness "two tabs share one DB", "confirming an order subtracts…"; `qa-integrada` |
| MSW-4 | Persistência local + reset para cenário conhecido | OK | Harness "reset restores the seed…", "persist across reload" |
| MSW-5 | Lentidão, latência variável, timeouts, sem conexão, HTTP de erro, configuráveis e reproduzíveis | OK | Cenários `latency.*`, `network.*`, `http.*` (harness); uso na UI em `12`, `05-cart`, `08` |
| MSW-6 | Fixtures variadas para filtros/paginação; ≥2 usuários | OK | Harness "seed is deterministic and rich" (60 NFTs); alice e bob |
| MSW-7 | Cenário: sucesso e vazio | OK | `default`, `catalog.empty` (harness; `01-catalog`) |
| MSW-8 | Cenário: latência variável e fora de ordem | OK | `latency.variable`, `catalog.out-of-order` (harness; `01-catalog`) |
| MSW-9 | Cenário: falha de conexão e 4xx/5xx | OK | `network.offline`, `network.timeout`, `http.500.once`, `http.503` (harness; `12`) |
| MSW-10 | Cenário: sessão expirada e não autorizado | OK | `session.expired`, `session.expire-on-checkout`, `auth.forbidden` (harness; `03`, `07`) |
| MSW-11 | Cenário: conflito de cadastro / validação | OK | `register.email-taken`, `forms.server-validation` (harness; `03`, `08`) |
| MSW-12 | Cenário: cupom inválido / expirado | OK | `coupon.invalid`, `coupon.expired` (harness; `05-cart`) |
| MSW-13 | Cenário: preço alterado / edição esgotada durante compra | OK | `checkout.price-changed`, `checkout.sold-out` (harness; `09`) |
| MSW-14 | Cenário: timeout após criação do pedido com recuperação idempotente | OK | `order.timeout-after-create` (harness; `07` "timeout após criação") |
| MSW-15 | Cenário: pagamento confirmado e recusado | OK | `payment.confirmed`, `payment.declined`, `payment.hold` (harness; `07`, `10`) |
| MSW-16 | Eventos via MSW com binding Socket.IO; transporte e limitações documentados | OK | `@mswjs/socket.io-binding`; ARCHITECTURE §11; `00-smoke`, `10` |
| MSW-17 | Ativado por configuração e disponível no build de demonstração | OK | `src/main.tsx` (`VITE_ENABLE_MOCKS`), `.env.production`; suíte verde contra o build. Produção pública: ver DEL-2 |
| MSW-18 | Mudanças nos dados refletem em REST e eventos correspondentes | OK | Harness "every DB change emits"; `05-cart`, `09` |

## Tempo real (§7)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| RT-1 | `nft.updated` atualiza preço/disponibilidade em catálogo, detalhe e carrinho | OK | `01-catalog`, `02-detail`, `05-cart` "preço e disponibilidade chegam por nft.updated com o carrinho aberto" |
| RT-2 | `order.updated` atualiza pedido e apresenta confirmação/recusa | OK | `10` (pendente → confirmado com foco no título, recusado), `qa-integrada` |
| RT-3 | Eventos com id estável, recurso afetado e versão | OK | `src/api/contracts/events.ts`; harness; `00-smoke` payload inválido |
| RT-4 | Tolerar duplicatas e eventos antigos sem regredir nem reaplicar efeitos | OK | `10` "eventos duplicados e antigos não reaplicam nem regridem o estado terminal"; `00-smoke` |
| RT-5 | Reconciliação com REST após reconexão | OK | `10` "conexão cai com o pedido pendente: ao reconectar o estado é recuperado do REST" |
| RT-6 | Eventos de sessão anterior não afetam outro usuário | OK | `00-smoke` (`foreign`), SEG passo 7 (`order.updated` de alice não chega a bob), `20-session-tabs` |
| RT-7 | Listeners/subscriptions liberados no fim do ciclo de vida | parcial | Teardown desconecta o socket (`03`, `20-session-tabs`, SEG passo 4); REV leu `onEvent` e `watch` com cleanup. **Falta:** teste que prove a liberação dos listeners por componente |
| RT-8 | Cenário: NFT no carrinho muda → UI informa e atualiza resumo → checkout bloqueia cotação desatualizada | OK | `05-cart` (resumo), `09` "preço muda com o checkout aberto: aviso, resumo novo e nova confirmação obrigatória" |
| RT-9 | Queda de conexão com pedido pendente → recupera sem nova compra; confirmado/recusado terminais | OK | `10` (refresh e queda de conexão sem nova compra; recusado terminal) |

## Interface e acessibilidade (§8)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| UI-1 | Fidelidade: tipografia, cores, espaçamentos, hierarquia, imagens, proporções | parcial | FID mediu fundo, fonte, hero, títulos; **aberto:** imagem do Detalhe 404 px contra 444 px, Confirmação não medida, sem relatório de reverificação |
| UI-2 | Desktop/tablet/mobile; avaliado em 390, 768, 1440 | parcial | `13-overflow` (telas públicas e da conta em 390/768/1440), `92-header-tablet`; FID. **Falta:** Confirmação e checkout em 768 sem medição |
| UI-3 | Skeletons com shimmer (catálogo, detalhe, resumo do carrinho), sem CLS, respeitando reduced motion | OK | `12-skeletons` (catálogo e detalhe, CLS, reduced-motion), `05-cart` "carrinho lento: skeleton do resumo sem CLS" |
| A11Y-1 | Navegação por teclado e foco visível | OK | `11` (Tab, Enter, foco visível), `07-focus`, `qa-fundacao-shell` "teclado" |
| A11Y-2 | Controle de foco em diálogos e drawers | parcial | `11` (menu da conta, Radix Select), `00-smoke` (menu mobile), `10` (foco no recibo). **Falta:** spec que prove foco preso e retorno no diálogo de revisão do pagamento (REV só leu o Radix) |
| A11Y-3 | Semântica, labels e erros associados | OK | `11` (`aria-describedby`, foco no primeiro inválido), `08`, `91/93/95` (axe sem crítico ou sério; verify a11y 28) |
| A11Y-4 | Alternativas textuais | OK | axe `91/93/95` (verify) sobre catálogo, detalhe, conta e checkout |
| A11Y-5 | Contraste e estados não dependentes só de cor | OK | axe (regra de contraste) no verify; erros com texto e `role=alert` |
| A11Y-6 | Feedback acessível de mutations e tempo real | OK | `cart-announcer` (`05-cart`), `role=status` (`01`, `02`), toasts em região `aria-live`, anunciador do checkout (REV #10 baixa: repetição de mensagem idêntica) |
| A11Y-7 | Sem overflow horizontal e sem perda com zoom | parcial | `13-overflow` em 390/768/1440 (telas públicas e da conta). **Falta:** zoom 200% e rolagem horizontal da Confirmação/checkout |
| UI-4 | Assets do arquivo usados; substituições e ajustes de a11y documentados | OK | ARCHITECTURE §13 (desvios D6 a D21); FID: "nenhum esconde defeito de layout" |

## Testes (§9)

Mapeamento grupo → spec na tabela do topo.

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| E2E-01 | Busca, filtros combinados, ordenação, paginação, histórico | OK | `tests/e2e/01-catalog.spec.ts` |
| E2E-02 | Acesso direto ao detalhe e inexistente | OK | `tests/e2e/02-detail.spec.ts` |
| E2E-03 | Cadastro, login, expiração, logout, troca de usuário | OK | `03-conta-sessao` (cadastro, login, expiração, logout, troca pela UI), `20`, `21` |
| E2E-04 | Favoritos com falha e recuperação | OK | `04-favorites` "falha da mutation desfaz o otimismo, avisa e a nova tentativa funciona" |
| E2E-05 | Carrinho, quantidades, remoção, cupom, persistência refresh/login | OK | `05-cart`, `qa-integrada` |
| E2E-06 | Compra completa até recibo | OK | `06-compra`, `qa-integrada` |
| E2E-07 | Falha de pagamento, clique repetido, timeout com mesmo pedido | OK | `07-pagamento-falhas` |
| E2E-08 | Perfil, avatar, senha, carteiras com erros | OK | `08-perfil-carteiras` |
| E2E-09 | Preço/disponibilidade via Socket.IO no checkout | OK | `09-realtime-checkout` |
| E2E-10 | Duplicados/antigos, desconexão, pedido pendente | OK | `10-pedido-pendente` (asserções na UI: recibo, pendente, recusado); `00-smoke` lê também o `realtime-probe` (QA #3, aceitável) |
| E2E-11 | Teclado, foco de diálogos, validação | parcial | `11`, `07-focus`, `08`. Falta o foco do diálogo de revisão (ver A11Y-2) |
| E2E-12 | Skeletons em lentidão, falha e retry | OK | `12-skeletons`, `05-cart` (estados), `08` (estados) |
| E2E-13 | Chromium desktop + mobile | OK | `playwright.config.ts` (desktop 1440 + Pixel 7 390); verify roda os dois |
| E2E-14 | Regressão visual: início, detalhe, carrinho, pagamento; baselines versionadas | parcial | `90-visual-catalog`, `96-visual-checkout` (carrinho, pagamento), `94-visual-conta` (verify: 22 visuais) com baselines `win32`. **Falta:** baselines Linux (6 de 28), pendência 3 |
| E2E-15 | Estado isolado; controle de relógio, latência e eventos | OK | `tests/fixtures.ts` (`boot` isola e reseta), `page.clock` em `21`, `mock.emit`, cenários de latência em `05-cart`, `08`, `12` |
| E2E-16 | Relatório HTML e traces de falha | OK | Reporter `html` + `trace: 'retain-on-failure'`; `.github/workflows/verify.yml` publica o relatório |

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
| DEL-1 | Código, lockfile, assets, mocks, fixtures, testes, configs de auditoria | parcial | `package-lock.json`, `src/mocks`, `tests/`, `scripts/verify.mjs`. Falta a configuração do Lighthouse |
| DEL-2 | Deploy público == código; mocks e tempo real funcionando | parcial | `origin/main` = HEAD = fd8f5b5; produção responde 200. **Falta:** confirmar que o deploy é fd8f5b5 e rodar `BASE_URL=<prod> npx playwright test` |
| DEL-3 | Acesso direto e refresh no ambiente publicado | parcial | Contra `vite preview`: `00-smoke`, `qa-fundacao-shell`, `06` (pedido por URL); rewrite SPA em `vercel.json`. Em produção só no spike 3 (build antigo) |
| DEL-4 | README: setup, env, credenciais, cenários/reset, comandos, reprodução de falhas | — | `README.md` não existe (só `src/mocks/README.md`) |
| DEL-5 | ARCHITECTURE: contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios Figma | OK | `ARCHITECTURE.md` §2 a §13 (contratos, eventos, sessão, cache, reconciliação, mocks, desvios D6 a D21); atualizar se mudar algo na rodada final |
| DEL-6 | Comandos: dev c/ mocks, build, preview, typecheck, lint, Playwright, Lighthouse | parcial | `package.json` scripts; `npm run lighthouse` → `lighthouse/run.mjs` inexistente |
| DEL-7 | Executa de checkout limpo sem serviços privados | parcial | `.github/workflows/verify.yml` roda sem backend; passo visual vermelho sem baselines Linux; README ausente; nenhum clone limpo executado |
| DEL-8 | README declara uso de IA | — | Sem README |
