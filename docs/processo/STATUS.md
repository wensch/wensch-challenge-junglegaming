# STATUS

**Fase atual:** ENTREGA PRONTA — todas as fases concluídas; `main` = produção = CI verde (e7f39d6).
**Última atualização:** 2026-11-03

## Etapas
| Etapa | Status | Evidência |
|---|---|---|
| A — Pesquisa | OK | docs/challenge.md; versões em PLANO.md §1; skills em PLANO.md §8 |
| B — Plano | OK | PLANO.md, docs/requirements-matrix.md |
| C — Andaime | OK | .claude/agents/ (12), CLAUDE.md, .claude/commands/run-pipeline.md, .claude/settings.json + hooks, scripts/verify.mjs, git init |
| D — Spikes | 1 OK · 2 OK (3 frames pendentes) · 3 OK | ver abaixo |

`npm run verify` → **GREEN** (reports/verify-latest.md): typecheck, lint, build, e2e (desktop+mobile), visual, a11y (estes dois ainda sem specs).

## Spike 1 — MSW + socket.io-client (browser e Playwright): **OK**
Evidência: `tests/e2e/00-spike.spec.ts` passa em desktop e mobile. Cobre REST via MSW, conexão real do `socket.io-client`, evento cliente→servidor, evento servidor→cliente disparado por handler REST e pelo teste (`window.__mock.emit`), filtro por token, heartbeat após 65s de relógio falso, queda e reconexão automática.

Descobertas (registradas em CLAUDE.md):
1. **Ordem de carga:** engine.io-client captura `globalThis.WebSocket` no load do módulo → `main.tsx` inicia o MSW e só então faz `import('./bootstrap')`.
2. **URL do `ws.link`:** o MSW remove o prefixo `/socket.io/` do URL antes de casar → o link precisa ser a origem pura. Padrões com `/socket.io/` nunca casam (não documentado; custou a maior parte do spike).
3. **Heartbeat:** o binding 0.2.0 forja o handshake (`pingInterval 25000`) mas não envia pings → cliente cairia em ~30s. O mock envia `'2'` a cada 20s.
4. **Auth:** o binding ignora o payload do CONNECT; o mock lê `auth.token` do frame bruto `40{...}` para filtrar eventos por usuário.
5. **Limitações do binding:** só namespace padrão, eventos de texto, sem acks/binário → `transports: ['websocket']`, sem acks no protocolo da app.
6. **Versões:** binding exige `msw ^2.10.2` → `msw@2.15.0` fixo (MSW 3.0.3 é incompatível). `typescript@6.0.3` fixo (typescript-eslint não suporta TS 7).

## Spike 2 — Figma: **OK (com pendências)**
- O original exige edição → usada a cópia do usuário `ua5xsyQarfBRq7v7ZxWXPr`. 15 frames mapeados, tokens de cor e tipografia extraídos (docs/figma.md), metadados completos salvos (.spike/figma-meta.xml).
- 12 de 15 frames exportados em 1x para `design/ref/`. **Pendentes:** Desktop/Cadastro, Desktop/Carteiras, Mobile/Carrinho.
- **Risco novo:** o MCP do Figma no plano Starter atingiu o limite de chamadas; `get_design_context` por tela e export de assets em 2x podem ficar indisponíveis. Contingência: metadados XML (posições/tamanhos), PNGs 1x, recorte das 5 ilustrações do frame de Início, ou export manual pelo usuário.

## Spike 3 — Deploy Vercel: **OK**
- Repositório: https://github.com/wensch/wensch-challenge-junglegaming (público). Commits e deploy no nome do usuário, sem trailers de IA (a pedido).
- Projeto Vercel `wensch-challenge-junglegaming` (time "wensch's projects"). Produção: **https://wensch-challenge-junglegaming.vercel.app**
- Verificado: `/`, `/some/deep/route` e `/nft/42` → 200 (SPA fallback); `mockServiceWorker.js` com `no-cache` e `Service-Worker-Allowed: /`; headers de segurança presentes.
- `BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test 00-spike` → **2 passed** (MSW + socket.io-client funcionando em produção).
- A CLI da Vercel não é usada (EPERM de symlink no Windows); deploy via conector/Git.

## Skills instaladas (projeto: `.claude/skills/`, `skills-lock.json`)
shadcn (shadcn-ui/ui), playwright-cli (microsoft), playwright-best-practices (currents-dev), accessibility (addyosmani/web-quality-skills). Cada SKILL.md foi lido antes e os 94 arquivos foram varridos por padrões perigosos: nada encontrado.

## Fase 1 — fundacao
| Etapa | Agente | Status |
|---|---|---|
| F1a contratos + ARCHITECTURE + money + lint | arquiteto-contratos | **OK** — contratos v1.0.0 congelados, verify GREEN, merge d9b3727 |
| F1b mocks (DB, cenários, handlers, realtime, __mock) | plataforma-mocks | **OK** — 60 NFTs, 31 rotas, 24 cenários, 70 testes verdes; merge c6b7d16 |
| F1c shell (Axios, QueryClient, router/_authed, layout, 404, tokens, shadcn, CI) + contratos v1.1.0 | arquiteto-contratos | **OK** — merge 6a48902 |
| verify em main (6a48902) | orquestrador | **GREEN** — typecheck, lint, build, e2e, visual 4/4, a11y 9/9 (+1 skip intencional) |
| Gates volta 1: fidelidade ‖ qa ‖ segurança | 3 agentes | **CHANGES_REQUESTED** ×3 — [fidelidade](../../reports/fundacao/fidelidade-visual.md) · [qa](../../reports/fundacao/qa-features.md) · [segurança](../../reports/fundacao/seguranca.md) · [BUGS](../../BUGS.md) |
| Revisor sênior volta 1 | revisor-frontend-senior | **CHANGES_REQUESTED** — 25 achados (5 altos) · [relatório](../../reports/fundacao/revisor-frontend-senior.md) |
| Volta 2: mocks (DB entre abas, pós-compra, CONFLICT_VERSION, restos do spike) | plataforma-mocks | **OK** — verify GREEN, R2 passa; merge 3d52cf7. Obs.: `latency.variable` falhou 1× com 6 workers (175 ms vs limite 150 ms), possível flake |
| Volta 2: sessão entre abas, reconcile sem regressão, redirect, header, CSP, baselines CI, contratos v1.2.0 | arquiteto-contratos | **OK** — merge 0c27e52 |
| verify em main (0c27e52) | orquestrador | **GREEN** — e2e 169 ✓ (11 skip), visual 6 ✓, a11y 9 ✓ |
| Gates volta 2 | fidelidade ‖ qa ‖ segurança | **APPROVED** ×3 |
| Revisor sênior volta 2 | revisor-frontend-senior | **CHANGES_REQUESTED** — 5 altos da volta 1 OK; novo alto N1 (expiração natural da sessão vira "visitante", perde contexto/rascunho) · [relatório](../../reports/fundacao/revisor-frontend-senior.md) |
| Volta 3: N1 + R3 | arquiteto-contratos | **OK** — V1 do revisor passa (reason=expired, redirect=/wallets, draftKept=true); merge aab300a |
| verify em main (aab300a) | orquestrador | 1ª execução RED (1 falha: contracts-regressions "CSP sem violação", desktop); 2ª **GREEN** (e2e 205 ✓, visual 6 ✓, a11y 9 ✓). Isolado: 12/12. **Flake intermitente sob carga, em aberto** |
| Revisor sênior volta 3 | revisor-frontend-senior | **APPROVED** — sem alto/crítico · [relatório](../../reports/fundacao/revisor-frontend-senior.md) |
| Reteste segurança volta 3 | seguranca | **APPROVED** — 14/14 testes de segurança · [relatório](../../reports/fundacao/seguranca.md) |
| Endurecimento pré-slices (F1 boot MSW sem controller, F6) | plataforma-mocks | **OK** — merge c2dde91 |
| Endurecimento pré-slices (F1 teste, F2 sessão fantasma, #13, F3, F7) | arquiteto-contratos | **OK** — CSP stress 80/80; merge b9cec4e |
| `Number()` proibido em todo src/tests fora de mocks (auditor #1, #5) | orquestrador | **OK** |
| **verify final em main** | orquestrador | **GREEN 3× seguidas** (e2e 215 ✓, visual 6 ✓, a11y 9 ✓) |
| Matriz de requisitos | auditor-requisitos | **OK** — 39 OK · 75 parcial · 33 pendente; nenhum eliminatório violado · [relatório](../../reports/fundacao/auditor-requisitos.md) |
| Volta 3: R1/R2 mocks + flake QA-007 | plataforma-mocks | **OK** — verify GREEN (e2e 199 ✓); merge 998f27c |
| **Ação do usuário** | — | rodar o workflow `visual-baselines` (workflow_dispatch) no GitHub e commitar `tests/__screenshots__/linux/`; até lá o passo visual do CI falha de propósito |

## Fase 2 — slices
| Slice | Agente | Porta | Status |
|---|---|---|---|
| S1 catálogo | implementador-catalogo | — | **entregue** — merge 539fb16 |
| S2 conta | implementador-conta | — | **entregue** — merge 2962718 |
| S3 checkout | implementador-checkout | — | **entregue** — merge dbf2418 |
| **verify em main com S1+S2+S3** | orquestrador | **GREEN** — e2e 374 ✓, visual 22 ✓, a11y 28 ✓, 0 flaky |
| Gates rodada 1 (main integrado) | QA · segurança · revisor sênior · fidelidade | QA **APPROVED** ([rel](../../reports/s-integrada/qa-features.md)) · Segurança **APPROVED** ([rel](../../reports/s-integrada/seguranca.md)) · Revisor **APPROVED**, 5 médios/7 baixos ([rel](../../reports/s-integrada/revisor-frontend-senior.md)) · Fidelidade **CHANGES_REQUESTED**, 2 altos (overflow a 768 px em Detalhe e Perfil) ([rel](../../reports/s-integrada/fidelidade-visual.md)) |
| Volta 2: S3 checkout | implementador-checkout | **OK** — merge dcf43a4 |
| Volta 2: S1+S2 (overflow 768 px, favoritos seriais, owner checks) | implementador-conta | **OK** — merge 0d52b21; verify em main GREEN (390 e2e, 22 visuais, 28 a11y) |
| Push + CI | orquestrador | main em fd8f5b5 no GitHub; produção serve fd8f5b5 (READY); baselines Linux: 22 (a1e3bbf, local) |
| Matriz de requisitos | auditor-requisitos | 121 OK · 18 parcial · 8 pendente ([rel](../../reports/s-integrada/auditor-requisitos.md)) |
| README + ARCHITECTURE final | release | **OK** — 63fe476 (README com declaração de IA) |
| Lighthouse | a11y-performance + orquestrador | **medido** (3×, mediana): A11y 100, BP 100, SEO 100, CLS 0 em todas; Perf desktop 97/98; **Perf mobile 68/68 (meta 90) — justificada** (528 KB gz de JS, 1/3 = mocks exigidos; LCP observado ~0,8 s, simulado 5,8 s) · [lighthouse/](../../lighthouse/README.md) |
| Correções de UI/perf (CLS Detalhe, favicon/robots, ícones, boot preload) + página Lista de interesse | implementador-catalogo, plataforma-mocks | **OK** — merges 9b18084 e d121337 |
| Teste instável corrigido | orquestrador | `20-session-tabs` "token vencido" falhava 24/50 (corrida entre dois caminhos corretos); agora fixa o resultado: 50/50 |
| Push | orquestrador | origin/main = 9b0f011 |
| Checkout limpo (clone do GitHub → npm ci → verify) | orquestrador | **GREEN** no commit 9b0f011: 408 e2e, 22 visuais, 28 a11y |
| CI GitHub Actions (Ubuntu, com 22 baselines Linux) | orquestrador | **success** em 16 min (push 9b0f011) |
| Produção (Vercel) | orquestrador | serve **9b0f011** (READY); suíte completa contra a produção: **458 passed, 22 skipped, 0 failed** |
| Reteste final do delta | revisor sênior + QA | **APPROVED** ×2 ([revisor](../../reports/s-integrada/revisor-frontend-senior.md), [QA](../../reports/s-integrada/qa-features.md)); achado médio de teste (cliques rápidos) corrigido com teste de mutação |
| Matriz de requisitos | auditor-requisitos | **fechada: 137 OK · 10 parcial · 0 pendente**; nenhuma pendência bloqueia a entrega; 6 eliminatórios OK ([rel](../../reports/s-integrada/auditor-requisitos.md)) |
| Lacunas de teste (A11Y-2/E2E-11 foco em diálogos, A11Y-7 zoom 200%, RT-7 listeners) | qa-features | **OK** — specs 15/16/17; 2 defeitos reais corrigidos: BUG-QA-011 (foco volta a "Confirmar compra" ao fechar a revisão) e BUG-QA-012 (reflow do rodapé a 320 px); BUG-QA-013 (contadores de listeners) fica como limitação |
| Estado final | orquestrador | **verify local GREEN** (456 e2e, 22 visuais, 27 a11y; 2 flaky só no retry) · **CI Ubuntu success** no push e7f39d6 (14m34s) · **produção serve e7f39d6** (READY) · suíte contra a produção em 1a976f9: 502 passed, 0 failed, 5 flaky só no retry |
| Incidentes do CI na reta final (resolvidos) | orquestrador | (1) baselines Linux do rodapé mobile desatualizadas após BUG-QA-012 → regeneradas pelo workflow `visual-baselines` (só 3 de 22 mudaram; rodapé antigo vazava da coluna a 390 px); (2) `95-a11y-checkout` falhava por contraste falso: o botão "Enviar pedido" nasce desabilitado e anima opacidade 0,5→1 ao habilitar; axe medindo no meio da transição → teste agora espera o botão habilitado e as animações finitas (84/84 sem retry) |

## Orçamento de uso
Ciclo enxuto em vigor (CLAUDE.md): QA + revisor sênior por slice; segurança só em conta e checkout; reteste só do diff; máx. 2 agentes em paralelo; auditor em Sonnet.
CI verde em main (23de732) com baselines Linux; produção em 3557ac2 com CSP.

## Notas de integração (orquestrador)
- Desvios do Figma renumerados sem colisão: S2 = D9–D13, S1 = D14–D18, S3 = D19–D21 (ARCHITECTURE §13).
- Instabilidade corrigida: `21-session-clock-expiry` exigia que o GET vencesse o caminho de expiração local (as duas rotas são corretas); agora fixa o resultado (200/200 sem retry). `playwright.config.ts`: 4 workers locais, 1 retry (testes que só passam no retry aparecem como "flaky").
- Pendente: baselines Linux de S1/S2/S3 (rodar workflow `visual-baselines`), `README.md`, Lighthouse, push (cada push publica em produção).

## Adiado de propósito
- Deduplicação entre slices (dois `Field`, duas `useWallets`, três hooks de credencial, dois mapeadores de erro, mensagens de `QuoteIssue`): refatoração depois da integração, sem mudança de comportamento (revisor item 5).
- BUG-QA-009 (5 `waitForTimeout`), baixas de segurança 1–5, tabela grupo→spec do §9 na matriz.

## Abertas de propósito (não bloqueiam a entrega)
- **Lighthouse mobile:** Performance 68/68 contra a meta de 90, justificada com dados em `lighthouse/README.md` (LCP observado ~0,8 s, simulado 5,8 s; 528 KB gz de JS, um terço é a camada de mocks exigida no build de demonstração; LH-5 proíbe simplificar para a nota). A11y, BP e SEO em 100; CLS 0; desktop 97/98.
- **Matriz:** 141 OK · 6 parciais (LH-2; UI-1/UI-2/TEL-10: imagem do Detalhe 404 px, leitura do gate esclarecida em D31, medição formal não refeita; TEL-11/TEL-12).
- Deduplicação entre slices (dois `Field`, duas `useWallets`, hooks de credencial, mapeadores de erro); BUG-QA-009 (6 `waitForTimeout`); BUG-QA-010 (link "Lista de interesse" fora do menu do sheet mobile); BUG-QA-013; baixas de segurança 1–5; R2–R5 do revisor.
- Testes que só passam no retry sob carga (aparecem como "flaky", nunca silenciosos): varrimento de CSP logado (`contracts-regressions`), `95-a11y-checkout` mobile (já corrigido pela espera de estado), rotas públicas contra a produção por latência de rede.

## Como reproduzir a evidência
`npm ci && npm run verify` (clone limpo verificado em 9b0f011) · `BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test` · `npm run lighthouse` · CI: GitHub Actions `verify` · baselines Linux: workflow `visual-baselines`.

## Estado final — 2026-11-05
- Home igual ao Figma (ordem, nomes com token, preços, Spotlight), 36 NFTs em 4 páginas, arte do Hero em 3x (WebP), busca em barra de largura total (D44), dica de ENS dinâmica, nomes de item sem corte, auto-recuperação do service worker do mock.
- `npm run verify`: GREEN na main (11:08). CI `verify` do commit c55fb77: success. Deploy Vercel do mesmo SHA: READY.
- Suíte contra produção: 550 passed, 3 flaky (passaram no retry), 1 falha corrigida no teste (reload abortado no boot frio; 36/36 depois).
- Pendências conhecidas: ver "Limitações conhecidas" no README (Confirmação e checkout em 768 px sem medição; imagem do Detalhe 404 vs 444 px; Performance mobile do Lighthouse justificada).
