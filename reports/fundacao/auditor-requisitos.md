# auditor-requisitos — fundacao — 2026-11-04
Veredito: APPROVED (escopo fundação; nenhum eliminatório violado no código atual — o produto ainda não é entregável)

Base: main 41b2d79 (src idêntico a a79823d, último verify GREEN). Placar da matriz: **39 OK · 75 parcial · 33 pendente (147)**.
Executado: `npx tsc -b --noEmit`, `npx eslint .` (exit 0); `05-unit-cache` (6 ✓, Node); sondas do ESLint por stdin; greps de imports de mocks, `Number(`/`parseFloat`, `setQueryData` em testes, query keys. Specs de navegador não rodadas (evidência: verify de a79823d e relatórios dos gates).

## Eliminatórios
| ID | Status | Falta |
|---|---|---|
| ELIM-1 | parcial | Lighthouse ausente; nenhum `useMutation` em src |
| ELIM-2 | pendente | Nenhum fluxo de compra/conta (rotas são placeholders) |
| ELIM-3 | parcial | Infra pronta (cenários payment.*, pedido terminal imutável); falta tela de confirmação + E2E "sem confirmed não há recibo" |
| ELIM-4 | parcial | Isolamento entre abas/usuários provado; faltam telas privadas reais e troca de usuário pela UI; segurança #13 antes da S3 |
| ELIM-5 | parcial | Eventos passam pelo socket.io-client; falta efeito visível na UI (RT-1/RT-2) |
| ELIM-6 | parcial | Suíte executável; falta cobertura do §9 (1–12); flake F1 em correção |

## Pendências que bloqueiam entrega
1. Fluxos principais S1–S3 (ELIM-2, TEL-1..9). 2. Lighthouse e `npm run lighthouse` (STK-9, LH-*, DEL-6). 3. Mutations do TanStack Query + otimista com rollback (STK-3, INT-8). 4. Tela de confirmação + E2E de `confirmed` (ELIM-3, PAG-6). 5. E2E do §9 (1–12) e visual das 4 telas. 6. Produção atrás de main, sem CSP (DEL-2). 7. README (DEL-4, DEL-8). 8. Baselines visuais linux (DEL-7, E2E-14). 9. Flake F1.

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | média | `Number()` só é proibido em contracts e money; em componentes/queries passa | `echo "export const p=(s:string)=>Number(s)+parseFloat(s)" \| npx eslint --stdin --stdin-filename src/lib/navigation.ts` → só parseFloat acusa | Aplicar a regra de coerção numérica a todo src fora de mocks, com exceções pontuais (quantidade, página) |
| 2 | média | `src/lib/money.ts` sem teste | grep `lib/money\|formatEth` em tests/ → 0 | Spec Node cobrindo soma, arredondamento, 18 casas, formatação |
| 3 | média | `05-unit-cache` usa `reconciler.handle()`/`setQueryData` direto: legítimo como unidade, mas não vale como evidência de RT-*/§9 | tests/e2e/05-unit-cache.spec.ts:55-57 | Marcar `@unit` ou mover para tests/unit; nunca citar como evidência de RT-* |
| 4 | média | Matriz citava `00-spike.spec.ts`, removido | `ls tests/e2e` | Corrigido na matriz |
| 5 | baixa | `mocks.spec.ts:492` usa `Number(n.price)` para checar ordenação | arquivo:linha | Comparar com lib/money |
| 6 | baixa | E2E de tempo real conferem o `realtime-probe` oculto, não a UI | 00-smoke.spec.ts:91-140 | Nas slices, conferir preço/estado visíveis |
| 7 | baixa | Harness não cobre remoção bem-sucedida de favorito | grep `'/favorites` em mocks.spec.ts | Adicionar DELETE → favorited:false |
| 8 | baixa | ARCHITECTURE §4 aponta credenciais no README, que não existe | `ls README.md` | Criar na entrega |
