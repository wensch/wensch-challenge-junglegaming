# STATUS

**Fase atual:** Etapa D concluída (parcialmente) — **aguardando "prossiga"** e duas decisões do usuário (Figma, publicação).
**Última atualização:** 2026-11-03

## Etapas
| Etapa | Status | Evidência |
|---|---|---|
| A — Pesquisa | OK | docs/challenge.md; versões em PLANO.md §1; skills em PLANO.md §8 |
| B — Plano | OK | PLANO.md, docs/requirements-matrix.md |
| C — Andaime | OK | .claude/agents/ (12), CLAUDE.md, .claude/commands/run-pipeline.md, .claude/settings.json + hooks, scripts/verify.mjs, git init |
| D — Spikes | 1 OK · 2 BLOQUEADO · 3 PARCIAL | ver abaixo |

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

## Spike 2 — Figma: **BLOQUEADO**
- MCP do Figma autenticado (conta "Mateus Wensch"), mas o arquivo `Ff0SksUi7UFtPWUO8kyNtw` retorna "you don't have edit access" em todas as ferramentas (inclusive leitura).
- Tentativa via navegador: o link abre como URL interna (redirecionamento para o app desktop); não foi possível capturar.
- **Ação do usuário:** no Figma, "Duplicate to your drafts" e enviar o link da cópia **ou** exportar os frames (desktop e mobile) em PNG 1x/2x para `design/ref/`.

## Spike 3 — Deploy Vercel: **PARCIAL**
- Feito: `vercel.json` (rewrite SPA, `Service-Worker-Allowed`, `no-cache` no worker, cache imutável em `/assets`, headers de segurança). Build de produção + `vite preview` serviu rota profunda com SPA fallback e MSW ativo (spike 1 navega para `/some/deep/route`).
- Bloqueios: (a) Vercel CLI não autenticada e falha no Windows (EPERM ao criar symlinks dos builders); (b) criação do repositório no GitHub foi **negada pelo controle de permissões** (publicação externa) — corretamente, exige aprovação explícita.
- Conector Vercel autenticado (time "wensch's projects"); deploy via Git integration é o caminho previsto.
- **Ação do usuário:** autorizar criar repo **privado** `wensch/nft-marketplace-challenge` + projeto Vercel ligado a ele (ou rodar `vercel login` e habilitar Developer Mode do Windows).

## Próximo passo
Após "prossiga": Fase 1 (fundação) via `/run-pipeline fundacao`.
