# STATUS

**Fase atual:** Fase 2 — slices S1 catálogo ‖ S2 conta ‖ S3 checkout em paralelo. Fase 1 (`fundacao`) **CONCLUÍDA**.
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
| Gates volta 1: fidelidade ‖ qa ‖ segurança | 3 agentes | **CHANGES_REQUESTED** ×3 — [fidelidade](reports/fundacao/fidelidade-visual.md) · [qa](reports/fundacao/qa-features.md) · [segurança](reports/fundacao/seguranca.md) · [BUGS](BUGS.md) |
| Revisor sênior volta 1 | revisor-frontend-senior | **CHANGES_REQUESTED** — 25 achados (5 altos) · [relatório](reports/fundacao/revisor-frontend-senior.md) |
| Volta 2: mocks (DB entre abas, pós-compra, CONFLICT_VERSION, restos do spike) | plataforma-mocks | **OK** — verify GREEN, R2 passa; merge 3d52cf7. Obs.: `latency.variable` falhou 1× com 6 workers (175 ms vs limite 150 ms), possível flake |
| Volta 2: sessão entre abas, reconcile sem regressão, redirect, header, CSP, baselines CI, contratos v1.2.0 | arquiteto-contratos | **OK** — merge 0c27e52 |
| verify em main (0c27e52) | orquestrador | **GREEN** — e2e 169 ✓ (11 skip), visual 6 ✓, a11y 9 ✓ |
| Gates volta 2 | fidelidade ‖ qa ‖ segurança | **APPROVED** ×3 |
| Revisor sênior volta 2 | revisor-frontend-senior | **CHANGES_REQUESTED** — 5 altos da volta 1 OK; novo alto N1 (expiração natural da sessão vira "visitante", perde contexto/rascunho) · [relatório](reports/fundacao/revisor-frontend-senior.md) |
| Volta 3: N1 + R3 | arquiteto-contratos | **OK** — V1 do revisor passa (reason=expired, redirect=/wallets, draftKept=true); merge aab300a |
| verify em main (aab300a) | orquestrador | 1ª execução RED (1 falha: qa-volta2 "CSP sem violação", desktop); 2ª **GREEN** (e2e 205 ✓, visual 6 ✓, a11y 9 ✓). Isolado: 12/12. **Flake intermitente sob carga, em aberto** |
| Revisor sênior volta 3 | revisor-frontend-senior | **APPROVED** — sem alto/crítico · [relatório](reports/fundacao/revisor-frontend-senior.md) |
| Reteste segurança volta 3 | seguranca | **APPROVED** — 14/14 testes de segurança · [relatório](reports/fundacao/seguranca.md) |
| Endurecimento pré-slices (F1 boot MSW sem controller, F6) | plataforma-mocks | **OK** — merge c2dde91 |
| Endurecimento pré-slices (F1 teste, F2 sessão fantasma, #13, F3, F7) | arquiteto-contratos | **OK** — CSP stress 80/80; merge b9cec4e |
| `Number()` proibido em todo src/tests fora de mocks (auditor #1, #5) | orquestrador | **OK** |
| **verify final em main** | orquestrador | **GREEN 3× seguidas** (e2e 215 ✓, visual 6 ✓, a11y 9 ✓) |
| Matriz de requisitos | auditor-requisitos | **OK** — 39 OK · 75 parcial · 33 pendente; nenhum eliminatório violado · [relatório](reports/fundacao/auditor-requisitos.md) |
| Volta 3: R1/R2 mocks + flake QA-007 | plataforma-mocks | **OK** — verify GREEN (e2e 199 ✓); merge 998f27c |
| **Ação do usuário** | — | rodar o workflow `visual-baselines` (workflow_dispatch) no GitHub e commitar `tests/__screenshots__/linux/`; até lá o passo visual do CI falha de propósito |

## Fase 2 — slices
| Slice | Agente | Porta | Status |
|---|---|---|---|
| S1 catálogo | implementador-catalogo | PW_PORT 4181 | volta 1 em andamento |
| S2 conta | implementador-conta | PW_PORT 4182 | volta 1 em andamento |
| S3 checkout | implementador-checkout | PW_PORT 4183 | volta 1 em andamento |

## Próximo passo
Integrar cada slice ao entregar (verify verde), rodar gates por slice.

Antes de abrir as slices (revisor): favorites.ts fica com a S1, cart-mutations.ts/useAddToCart com a S3 (cart.ts congelado), SiteHeader por bloco (S1 busca, S3 badge, S2 AccountDropdown), routeTree.gen.ts regenerado no merge.

Decisões de F1a aceitas pelo orquestrador: recusa de carteira = 200 `{status:'rejected'}`; recurso alheio = 403 FORBIDDEN; token em localStorage (trade-off documentado em ARCHITECTURE §4); 12 códigos de erro (PLANO será atualizado em F1c).
