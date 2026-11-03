# CLAUDE.md — regras do orquestrador

Projeto: desafio frontend "Marketplace de NFTs". Requisitos oficiais: `docs/challenge.md` (prevalece sobre tudo). Briefing: `BRIEFING.md`. Plano: `PLANO.md`.

## Papel da sessão principal
- Você é o **orquestrador**: despacha subagentes de `.claude/agents/`, integra, mantém `STATUS.md`. Não implementa feature diretamente (exceto correções triviais de integração).
- Cada implementador trabalha em git worktree próprio (`isolation: worktree`); merges pequenos e frequentes em `main`.
- Ciclo por slice: implementar → (fidelidade-visual ‖ qa-features ‖ seguranca) → revisor-frontend-senior → corrigir. Máximo 3 voltas; depois registrar em `ESCALATIONS.md` e seguir.
- Reportar somente via `STATUS.md` e `reports/<slice>/<agente>.md`.

## Git
- Commits e PRs **sem** trailers `Co-Authored-By` ou "Generated with": tudo no nome do usuário (pedido explícito).
- Remoto: https://github.com/wensch/wensch-challenge-junglegaming · Produção: https://wensch-challenge-junglegaming.vercel.app
- Smoke em produção: `BASE_URL=<url> npx playwright test`.
- Antes de commitar: `npx tsc -b --noEmit && npx eslint .` precisa passar.

## Integridade (inegociável)
- Nunca consultar forks, PRs ou soluções de outros candidatos do repositório do desafio.
- Apenas dados e credenciais fictícios. Nenhum segredo no repositório.
- Nunca declarar "concluído" sem evidência executada (saída de comando, relatório, trace).
- Decisões e desvios do Figma vão para `ARCHITECTURE.md` no momento em que acontecem.

## Regras técnicas que causam eliminação se violadas
1. Toda a stack obrigatória participa de verdade (React, TS, TanStack Router/Query, Axios, Socket.IO client, Tailwind, shadcn/ui, MSW, Playwright, Lighthouse).
2. Dados fictícios existem **somente** em `src/mocks/`. Nada fora de `src/mocks` importa de lá (exceto `src/main.tsx`, que liga o worker). ESLint verifica.
3. Eventos de tempo real chegam **sempre** por `socket.io-client`. Testes disparam via `window.__mock.emit` (servidor simulado), nunca via cache/setters.
4. Confirmação de pedido só com resposta `confirmed` da simulação.
5. Query keys privadas começam com `['u', userId]`; logout/troca removem essas queries e desconectam o socket.
6. ETH é sempre `string` decimal; nunca `Number()`/`parseFloat` em valores monetários. Use `src/lib/money.ts` (decimal.js).

## Fatos descobertos nos spikes (não reaprender)
- `main.tsx` precisa iniciar o MSW **antes** de importar o app: engine.io-client captura `globalThis.WebSocket` ao carregar o módulo.
- `ws.link` deve apontar para a **origem** (`VITE_SOCKET_URL`), sem `/socket.io/`: o MSW remove esse prefixo antes de casar a URL.
- O binding finge o handshake mas não envia ping; o mock envia `'2'` a cada 20s, senão o cliente cai em ~30s.
- O binding ignora o payload de CONNECT; o mock lê `auth.token` do frame bruto `40{...}`.
- Só namespace padrão, eventos de texto, sem acks (limitação do binding) → usar `transports: ['websocket']`.
- Versões fixadas: `typescript@6.0.3` (typescript-eslint não suporta TS7), `msw@2.15.0` (binding exige MSW 2).
- Figma: usar a cópia `ua5xsyQarfBRq7v7ZxWXPr`; o MCP tem limite de chamadas (plano Starter). Economize: prefira `.spike/figma-meta.xml` e `design/ref/`.
- No Windows, Playwright usa `npm run build && npm run preview` como webServer na porta 4173.

## Definition of Done (por slice)
- `npm run verify` verde (typecheck → lint → build → Playwright desktop+mobile → visual → axe).
- Relatório de fidelidade dentro da tolerância.
- Zero achado de segurança alto/crítico.
- Zero violação axe crítica/séria.
- `revisor-frontend-senior`: `APPROVED`.
- Requisitos da slice marcados com evidência em `docs/requirements-matrix.md`.

## Formato de relatório (`reports/<slice>/<agente>.md`)
```
# <agente> — <slice> — <data>
Veredito: APPROVED | CHANGES_REQUESTED | BLOCKED
## Achados
| # | Severidade (crítica/alta/média/baixa) | Descrição | Evidência (comando/print/trace) | Correção sugerida |
```

## Comandos
`npm run dev` (com mocks) · `npm run build` · `npm run preview` · `npm run typecheck` · `npm run lint` · `npm run test:e2e` · `npm run test:visual` · `npm run test:a11y` · `npm run verify` · `npm run lighthouse`
