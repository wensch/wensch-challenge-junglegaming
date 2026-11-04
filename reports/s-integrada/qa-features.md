# qa-features — s-integrada (S1+S2+S3) — 2026-11-04
Veredito: APPROVED

Escopo: leitura dos specs 01..12 contra o §9; exploratório novo `tests/e2e/qa-integrada.spec.ts` (6 testes, desktop + mobile 390 px, 6/6 verdes contra o preview em :4173): visitante adiciona pela UI no detalhe, reload no carrinho, login com merge, cupom persistido após reload, checkout, reload, envio, pendente (reload mantém pendente, sem recibo), `settleOrder` confirmed -> recibo (e após reload) / declined -> terminal sem recibo e carrinho preservado; logout e troca alice -> bob sem carrinho/pedido/dados de alice.

Eliminatórios: confirmação só com `status === 'confirmed'` (OrderPage/Receipt; pendente nunca mostra recibo); nenhum `Number()`/`parseFloat` sobre ETH fora de `src/mocks` (grep); eventos apenas via `socket.ts` -> reconciler (único `.handle(` fora dos mocks); `setQueryData` em specs só no teste unitário de reconciler com QueryClient isolado (`05-unit-cache`), não na app.

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | baixa | Numeração dos specs não segue os grupos do §9 (ex.: `05-cart` e `05-unit-cache`; grupo 3 em `03-conta-sessao`/`20`/`21`; 9 em `09-realtime-checkout`). Cobertura existe nos 12 grupos, só o mapeamento é implícito. | `grep` dos títulos dos testes | Tabela grupo -> spec em `docs/requirements-matrix.md` |
| 2 | baixa | Fluxo catálogo -> recibo era provado em pedaços (carrinho preparado por REST em `06-compra`); nenhum teste único via UI. | Lacuna fechada por `qa-integrada.spec.ts` | Manter o novo spec |
| 3 | baixa | Eventos de ordem observados também pelo `realtime-probe` (atributos ocultos); as asserções principais em `10-pedido-pendente` já são de UI (recibo/pendente/recusado). | `10-pedido-pendente.spec.ts` | Nenhuma, aceitável |
| 4 | baixa | `waitForTimeout` em `01-catalog:122`, `12-skeletons:32`, `20-session-tabs:122`, `mocks.spec:438,683` (regra "sem waitForTimeout"). | grep | Trocar por expect com polling / `page.clock` |

Sem achados alta/crítica.
