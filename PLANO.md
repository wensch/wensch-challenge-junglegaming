# PLANO — Marketplace de NFTs

Fonte de verdade dos requisitos: [docs/challenge.md](docs/challenge.md). Rastreabilidade: [docs/requirements-matrix.md](docs/requirements-matrix.md). Resultados dos spikes: [STATUS.md](STATUS.md).

## 1. Decisões de stack (versões verificadas no npm em 2026-11-03)

| Camada | Pacote | Versão | Observação |
|---|---|---|---|
| Build | vite / @vitejs/plugin-react | 8.3.x / 6.2.x | SPA estática; code-splitting por rota |
| UI | react / react-dom | 19.3.x | StrictMode ligado |
| Linguagem | typescript | **6.0.3 (fixo)** | TS 7.0 existe, mas typescript-eslint 8.72 exige `<6.1` |
| Rotas | @tanstack/react-router + router-plugin | 1.170 / 1.168 | file-based, `validateSearch` com zod, `beforeLoad` para rotas privadas |
| Estado remoto | @tanstack/react-query | 5.105 | `signal` repassado ao Axios; keys com `userId` |
| HTTP | axios | 1.21 | instância única `src/api/client.ts`, interceptors de auth/erro |
| Tempo real | socket.io-client | 4.8.4 | `transports: ['websocket']` (ver STATUS: limitação do binding) |
| Mocks | msw **2.15.0 (fixo)** + @mswjs/socket.io-binding **0.2.0** | — | binding exige `msw ^2.10.2`; MSW 3.x incompatível |
| Validação | zod | 4.6 | schemas de contrato compartilhados entre app e mocks |
| Formulários | react-hook-form + @hookform/resolvers | 7.91 / 7.0 | erros da API mapeados para campos |
| Dinheiro | decimal.js | 10.6 | ETH sempre string; Decimal só para soma/formatação; total oficial vem da cotação |
| Estilo | tailwindcss + @tailwindcss/vite | 4.3 | tokens do Figma em `@theme` |
| Componentes | shadcn (CLI) | 4.23 | Radix por baixo; Dialog/Sheet/Select/Toast (sonner) adaptados aos tokens |
| E2E | @playwright/test + @axe-core/playwright | 1.64 / 4.14 | Chromium desktop 1440 + mobile 390 (+ tablet 768 em visual) |
| Auditoria | lighthouse (CLI, Node API) | 13.6 | 3 execuções × 2 páginas × 2 perfis, mediana |
| Deploy | Vercel (Git integration) | — | `vercel.json` com rewrite SPA e headers do SW |

## 2. Arquitetura (resumo; detalhe vai para ARCHITECTURE.md na Fase 1)

```
src/
  main.tsx              # liga MSW ANTES de importar o app (engine.io captura WebSocket no load)
  bootstrap.tsx         # RouterProvider + QueryClientProvider
  routes/               # file-based (TanStack Router); _authed.tsx protege checkout/perfil/carteiras/favoritos/pedidos
  api/
    client.ts           # instância Axios (baseURL, token, x-request-id, normalização de erro -> ApiError)
    contracts/*.ts      # zod schemas + tipos (Nft, Cart, Quote, Order, User, Wallet, Event envelopes)
    endpoints/*.ts      # funções tipadas por recurso (recebem AbortSignal)
  queries/              # queryOptions/mutations por recurso; queryKeys factory com userId
  realtime/
    socket.ts           # ciclo de vida do socket por sessão (connect com auth.token, disconnect no logout)
    reconcile.ts        # aplica nft.updated / order.updated no cache: dedupe por id, version monotônica
  features/{catalog,nft,cart,checkout,order,auth,profile,wallets}/
  components/ui/        # shadcn adaptado
  lib/money.ts          # Decimal helpers + formatEth
  mocks/                # SÓ aqui existem dados fictícios
    db/                 # store em memória + persistência localStorage, seed determinística, reset
    fixtures/           # NFTs (~60, variados), 2+ usuários, cupons, carteiras
    handlers/*.ts       # REST por recurso, usando os mesmos zod contracts
    realtime.ts         # ws.link(origem) + toSocketIo; heartbeat; filtro por token; emit de nft/order
    scenarios.ts        # cenários nomeados (latência, falhas, expiração, preço alterado, timeout pós-criação...)
    control.ts          # window.__mock: reset, setScenario, emit, drop, advance order (usado por testes e painel demo)
tests/e2e/01..12-*.spec.ts, tests/visual/*.spec.ts, tests/fixtures.ts (fixture que reseta mocks por teste)
lighthouse/             # run.mjs, config, reports/ (html+json), environment.md
```

Regras-chave:
- **Mocks só na rede.** Nenhum componente/hook/cliente importa `src/mocks`. Lint rule `no-restricted-imports` garante.
- **Eventos reais.** Testes disparam eventos via `window.__mock.emit` (lado servidor do mock) → frames Socket.IO → `socket.io-client` → handlers do app. Nunca tocar no cache a partir do teste.
- **Isolamento por usuário.** Query keys privadas = `['u', userId, ...]`. Logout/troca: `socket.disconnect()`, `queryClient.removeQueries({queryKey:['u']})`, cancelamento de in-flight; eventos validados por `userId` no envelope + socket por sessão.
- **Dinheiro.** Strings decimais em todo contrato; zod `z.string().regex(/^\d+(\.\d{1,18})?$/)`; UI nunca faz `Number(eth)`.
- **Idempotência.** `Idempotency-Key` = UUID por tentativa de compra, guardado em `sessionStorage` com o hash do payload (cotação). Reenvio/timeout reusa a chave; mock devolve o mesmo pedido; mesma chave + corpo diferente = 409.
- **Revalidação.** Checkout envia `quoteId` + `quoteVersion`; servidor rejeita (409 `QUOTE_STALE`) se preço/estoque/cupom/taxa mudou; UI mostra diff e exige nova confirmação.
- **Pedido pendente.** `order.updated` move pending → confirmed|declined (terminais; version monotônica). Recuperação: rota `/orders/$id` refaz GET; reconexão do socket dispara `invalidateQueries` dos recursos ativos.
- **Otimista com rollback:** favoritos (onMutate/onError/onSettled) e quantidade no carrinho.

## 3. Slices, tarefas e critérios de aceite

Dependências: F1 (fundação) → {S-catálogo, S-conta, S-checkout} em paralelo (checkout depende de contratos de carrinho + auth básico) → F3.

### F1 — Fundação (arquiteto-contratos + plataforma-mocks, sequencial)
1. Contratos zod de todos os recursos + envelopes de evento + `ApiError` (codes: VALIDATION, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT_AVAILABILITY, QUOTE_STALE, IDEMPOTENCY_CONFLICT, TRANSIENT). **Congelados** antes das telas.
2. Mock DB + seed + persistência + reset; cenários; control API; handlers REST completos; realtime.
3. Axios client, QueryClient (política documentada), router com `_authed`, layout (header/footer Figma), 404.
4. Tokens Figma → `@theme`; shadcn init; fontes locais.
5. ESLint, `verify`, CI (GitHub Actions: verify em Chromium), fixture Playwright de isolamento.
Aceite: `verify` verde com smoke; todos os cenários do §6 do enunciado acionáveis por nome.

### S1 — Catálogo (implementador-catalogo)
Início (destaques, catálogo, busca, filtros, ordenação, paginação na URL), detalhe (galeria, edição, quantidade, favoritos, adicionar ao carrinho), NFT inexistente, skeletons. Aceite: requisitos CAT-* e DET-* da matriz com teste 01/02/04/12.

### S2 — Conta (implementador-conta)
Login (retorno ao fluxo via `?redirect=`), cadastro (409 e-mail), sessão (GET /session no boot), expiração (401 → modal/redirect preservando contexto), logout/troca, perfil (dados, avatar upload simulado, senha), carteiras (principal/secundária, rede). Aceite: CONTA-* com testes 03/08/11.

### S3 — Checkout (implementador-checkout)
Carrinho (guest id → merge no login), cupom, cotação, pagamento (dados, carteira+rede, conectar/recusar/desconectar), revisão, envio idempotente, pendente/confirmado/recusado, recibo snapshot, remoção parcial do carrinho. Aceite: CAR-*, PAG-* com testes 05/06/07.

### F3 — Integração e resiliência
Tempo real ponta a ponta (catálogo/detalhe/carrinho), stale quote no checkout, reconexão com pedido pendente, sessão expirada no checkout, isolamento entre usuários. Testes 09/10 + cenários extras.

### F4 — Auditorias
Lighthouse (3×, mediana), axe completo, baselines visuais (início, detalhe, carrinho, pagamento × desktop/mobile), revisão cruzada, matriz fechada.

### F5 — Release
README, ARCHITECTURE final, checkout limpo (`git clone` → `npm ci` → `npm run verify`), deploy == HEAD, checklist.

## 4. Agentes (definição final em `.claude/agents/`)

| Agente | Modelo | Ferramentas | Escreve em |
|---|---|---|---|
| arquiteto-contratos | opus | Read, Grep, Glob, Edit, Write, Bash | `src/api/contracts`, `ARCHITECTURE.md` |
| plataforma-mocks | sonnet | Read, Grep, Glob, Edit, Write, Bash | `src/mocks` |
| implementador-catalogo / -checkout / -conta | sonnet | Read, Grep, Glob, Edit, Write, Bash | sua feature (worktree) |
| fidelidade-visual | sonnet | Read, Grep, Glob, Bash, Write | `reports/` |
| qa-features | sonnet | Read, Grep, Glob, Edit, Write, Bash | `tests/`, `BUGS.md` |
| auditor-requisitos | opus | Read, Grep, Glob, Bash, Write | `reports/`, `docs/requirements-matrix.md` |
| seguranca | opus | Read, Grep, Glob, Bash, Write | `reports/` |
| revisor-frontend-senior | opus | Read, Grep, Glob, Bash, Write | `reports/` |
| a11y-performance | sonnet | Read, Grep, Glob, Bash, Write | `reports/`, `lighthouse/` |
| release | haiku | Read, Grep, Glob, Edit, Write, Bash | README, CI, configs |

A restrição "escreve só em `reports/`" é aplicada por hook (`.claude/hooks/guard-writes.mjs`), não só por prompt.

## 5. `npm run verify`
`scripts/verify.mjs` executa em sequência e para no primeiro erro: `tsc -b` → `eslint .` → `vite build` → Playwright funcional (desktop + mobile, sem `@visual`/`@a11y`) → `@visual` → `@a11y` (axe: falha em violações critical/serious). Saída resumida em `reports/verify-latest.md`.

## 6. Riscos e contingência

| Risco | Status | Contingência |
|---|---|---|
| MSW + socket.io-client | **Resolvido no spike** (ver STATUS) | — ; limitações documentadas |
| Figma sem acesso via MCP (exige edição) | **Aberto** | usuário duplica o arquivo para seus drafts; alternativa: PNGs exportados em `design/ref/` |
| Deploy bloqueado (publicação externa requer aprovação) | **Aberto** | aguardando aprovação para repo privado + Vercel Git; alternativa: usuário faz `vercel login` |
| Vercel CLI no Windows (EPERM em symlink) | Conhecido | deploy via Git integration ou Developer Mode do Windows |
| Lighthouse Performance com MSW (SW + bundle de mocks) | Esperado | mocks em chunk separado e lazy; medir honestamente e justificar |
| TS 7 / MSW 3 | Evitado | versões fixadas; documentado |
| Escopo × 48h | Alto | ordem de prioridade do BRIEFING §7 |

## 7. Cronograma (relativo ao "prossiga")

| Horas | Entrega |
|---|---|
| 0–4 | F1 fundação + contratos congelados + mocks completos |
| 4–18 | S1/S2/S3 em paralelo (worktrees), gates por slice |
| 18–30 | F3 integração + E2E 01–12 |
| 30–38 | F4 auditorias e correções |
| 38–44 | F5 release, checkout limpo |
| 44–48 | buffer |

## 8. Skills e plugins candidatos (nenhum instalado ainda)

Já disponíveis no ambiente (sem instalar nada): `vercel-react-best-practices`, `web-design-guidelines`, `ui-ux-pro-max:ui-styling` (shadcn/Tailwind), `code-review`, `security-review`, `frontend-design`.

Candidatos do registro `skills.sh` (instalar só após ler o conteúdo):
| Skill | Fonte | Por quê |
|---|---|---|
| `shadcn-ui/ui@shadcn` | repositório oficial do shadcn (405K installs) | CLI e convenções da versão atual |
| `microsoft/playwright-cli@playwright-cli` | Microsoft, oficial (206K) | inspeção da UI pelo QA |
| `currents-dev/playwright-best-practices-skill` | Currents, mantenedor conhecido de tooling Playwright (102K) | padrões de isolamento/flakiness |
| `addyosmani/web-quality-skills@accessibility` | Addy Osmani (66K) | checklist a11y/Lighthouse |
Descartados: skills de TanStack Query de terceiros sem vínculo com o projeto TanStack (docs oficiais bastam); `playwright-stealth-verify` (fora de propósito).
