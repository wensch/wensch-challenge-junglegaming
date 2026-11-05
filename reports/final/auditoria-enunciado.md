# auditor-requisitos — final — 2026-11-05
Veredito: CHANGES_REQUESTED (apenas itens de documentação/higiene; nenhum eliminatório violado nas verificações feitas)

Escopo: leitura/grep sem reexecutar a suíte. `npx playwright test --list` rodou: 596 testes em 48 arquivos (desktop, mobile e harness).

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | média | Matriz de requisitos tem 6 linhas `parcial` (TEL-10, TEL-11, TEL-12, UI-1, UI-2, LH-2). O README (l.195) remete a ela. UI-1 cita imagem do Detalhe 404 px contra 444 px "sem correção registrada" e Confirmação/checkout em 768 sem medição. | `Grep '\| (parcial\|—) \|' docs/requirements-matrix.md` retornou 6 linhas (81-83, 213, 214, 253) | Medir ou corrigir os pontos e atualizar a matriz. Se não houver tempo, registrar como limitação em ARCHITECTURE §13/README. LH-2 é aceitável pois o enunciado permite "justificar". |
| 2 | baixa | Lighthouse mobile Performance 68 e 68 (meta ≥90). Justificado em `lighthouse/README.md` e no README (LCP simulado 5,8 s, 528 KB gz de JS, 178 KB de mocks). O enunciado exige justificativa e causas, o que existe. | `lighthouse/reports/2026-11-05/summary.md` | Aceitável. Opcional: code-splitting extra (lazy das rotas privadas), sem simplificar a auditoria. |
| 3 | baixa | README e CLAUDE.md/.claude/ (agents, skills, hooks) versionados e descritos na seção "Uso de IA". É declarado, não escondido, mas o repositório expõe o nome da ferramenta. O CLAUDE.md pede commits sem trailers, e isso não deve ser confundido com ocultar o uso de IA. | `README.md` l.167 e l.197-199 | Decisão do autor: manter (transparência) ou remover `.claude/` do versionamento. Não há contradição com o enunciado. |
| 4 | baixa | Não verificado: autoria/trailers dos commits. O hook do projeto bloqueou `git log` no shell. A memória do usuário exige autor Mateus Wensch e nenhum `Co-Authored-By` ou "Generated with". | Bash bloqueado (`system-level command`) | Antes do merge final rodar: `git log --format='%an|%ae|%cn' \| sort \| uniq -c` e `git log --format=%B \| grep -ciE 'co-authored\|generated with'` (esperado 0). |
| 5 | baixa | Licença/atribuição das imagens de NFT: só a fonte Roboto Mono tem licença (OFL) documentada. As imagens vêm do export do Figma feito pelo usuário (`docs/figma.md` l.52-53). Não existe nota explícita de licença/origem das artes. | Grep por licen/atribu em README/ARCHITECTURE/docs/figma.md | Acrescentar uma linha no README ou ARCHITECTURE: "imagens de NFT exportadas do arquivo Figma do desafio; uso restrito à avaliação". |
| 6 | baixa | `scripts/gen-agents.mjs` e `scripts/gen-icons.mjs` são ferramentas de processo versionadas, não são scripts npm. Os `console.log` em `lighthouse/run.mjs`, `scripts/verify.mjs` e `scripts/gen-*.mjs` são saída de CLI, não são resíduo. | Grep `console.log` em src/tests: 0 ocorrências | Opcional: mover `gen-agents.mjs` para `.claude/`. |

## Itens conferidos como OK
| Requisito do enunciado | Evidência curta |
|---|---|
| Stack (React 19, TS 6, TanStack Router/Query, Axios, socket.io-client, Tailwind 4, shadcn/radix, MSW 2.15, Playwright, Lighthouse) | `package.json` dependencies e devDependencies; `components.json`; `@mswjs/socket.io-binding` |
| Scripts: dev (mocks), build, preview, typecheck, lint, test:e2e, test:visual, test:a11y, verify, lighthouse | `package.json` scripts, todos presentes |
| Mocks só em `src/mocks`; nada fora importa deles | Grep `from '.*mocks'` fora de `src/mocks` em src/tests: 0. ESLint `no-restricted-imports` e `ImportExpression` em `eslint.config.js` l.28-61 (exceção: `src/main.tsx`) |
| ETH sem `Number()`/`parseFloat` | Grep `Number\(\|parseFloat` em `src`: só o comentário de `src/lib/money.ts:3`; lint também proíbe |
| Sem `console.log`/`debugger`/TODO/FIXME em src, tests | Grep: 0 ocorrências |
| Catálogo: busca, filtros, ordenação e paginação na URL, com reset de página ao mudar filtro | `nfts.ts` l.121-155 (`validateSearch` com `.catch`, `page` min 1); `01-catalog.spec.ts` l.22-71 (`page=2`, `goBack`, filtro remove `page=`, `page=999` e `page=abc` tratados) |
| Paginação: 36 NFTs, pageSize 9, 4 páginas, API devolve `meta.totalPages` | `seed.ts:57` `NFT_COUNT = 36`; `CATALOG_PAGE_SIZE = 9`; `catalog.ts` l.105-114; grade 3x3 testada |
| E2E dos 12 grupos do §9 | `--list`: 00 a 22 cobrem catálogo (01), detalhe (02), conta (03, 20, 21), favoritos (04, 04b), carrinho (05), compra (06, purchase-journey), pagamento (07, 18), perfil e carteiras (08), realtime (09), pendente (10, 17), teclado e foco (07, 11, 15), skeletons (12); matriz mapeia os 12 grupos |
| Regressão visual (início, detalhe, carrinho, pagamento) com baselines versionadas | Specs `90-*`, `94-*`, `96-*` com `@visual`; `tests/__screenshots__/{win32,linux}` rastreados |
| Chromium em desktop e mobile, relatório HTML, traces | README §Testes: projetos desktop 1440, mobile 390, `trace: 'retain-on-failure'`, `playwright-report/` |
| Lighthouse: 3 medições, medianas, config, HTML/JSON, ambiente | `lighthouse/{run.mjs,config/*,environment.md,README.md,reports/2026-11-05/*}`; A11y, BP e SEO 100, perf desktop 97 e 98 |
| README: setup, env, credenciais, cenários e reset, comandos, reprodução de falhas, tempo real | Seções de README l.25-124 |
| ARCHITECTURE.md: contratos, eventos, sessão, carrinho, cache e retries, reconciliação, UX, desvios do Figma | Seções 2-14 |
| `.env.example` sem segredos | Conteúdo: `VITE_ENABLE_MOCKS`, `VITE_API_URL`, `VITE_SOCKET_URL` (fictícios) |
| Lockfile, deploy (Vercel), SPA rewrite | `package-lock.json`, `vercel.json`, URL em CLAUDE.md |
| Sem lixo versionado | `.gitignore` cobre node_modules, dist, test-results, playwright-report, .vercel, `*.tsbuildinfo`, `.claude/worktrees/`. Arquivos rastreados: `.vercelignore` apenas. Maiores: PNGs de `design/ref` (≤4,8 MB) e baselines (≤1,8 MB) |
| Dependências sem uso | Não encontrei nenhuma suspeita. `sonner`, `zod`, `react-hook-form`, `decimal.js` e `tw-animate-css` são usadas pela arquitetura documentada. Não rodei `depcheck`. |

## Observação final
Não reexecutei o `verify`, a produção nem o Lighthouse por instrução. As afirmações de "passa" dependem do outro processo. O veredito é CHANGES_REQUESTED apenas pelo achado 1 (matriz com itens parciais e uma medição de fidelidade aberta) e pela verificação pendente do achado 4. Nenhum achado crítico ou alto.
