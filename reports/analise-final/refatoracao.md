# Refatoração e qualidade estrutural — main (e7f39d6) — 2026-11-04
Veredito: o estado verde se confirma; há dívida estrutural segura de pagar. Nada bloqueia a entrega.

Método: leitura do código, `tsc` e `eslint` limpos; `tsc` com flags extras e `eslint strictTypeChecked` em config temporário (fora do repositório); `grep -w` para exports sem uso; `dist/` existente para o bundle.

## Contagens
| Medida | Resultado |
|---|---|
| Arquivos do app (fora de `src/mocks`) | 145, ~11,6 mil linhas |
| Pares duplicados | 5 já conhecidos + 10 novos |
| Exports sem importador fora do arquivo | 127 (8 símbolos totalmente mortos, 1 componente shadcn, 1 método) |
| Dependências sem uso | 0 |
| Cast `as` real no app / `!` | ~17 / 2 |
| `waitForTimeout` em testes / `console.log` de depuração | 6 / 8 (`qa-volta2.spec.ts`) |
| Comentários com marcador de processo | ~16 linhas em 12 arquivos |

## 1. Duplicação (impacto: manutenção)
1. `features/checkout/Field.tsx` × `features/forms/Field.tsx` (variantes de espaçamento, `role="alert"`, id, classes). Unificar mexe em baselines 94/96 e em a11y: **não agora**.
2. `useWallets` em `features/checkout/wallets.ts` e `queries/account.ts` (mesma chave, mais `accountQueries.wallets` morta). Manter só a de `queries/`.
3. Hooks de credencial idênticos: `useAccountUser`, `useUserCredential`, `useUserOwner`, `useCartOwner` (28 usos). Criar `queries/identity.ts`.
4. `applyFieldErrors` (`shared/forms.ts`) × `applyApiError` (`forms/apiErrors.ts`).
5. Mensagens de `QuoteIssue` em `CartPage`, `CheckoutForm`, `StaleChanges`.
6. `NETWORK_LABELS` em 3 lugares; rótulos de tipo de carteira em 2.
7. `shortAddress` com saída divergente (`…` × `...`); mudar o caractere altera o baseline `90-visual-catalog/detalhe`.
8. Regra de ENS repetida 3×; regex `referralCode` copiada 4×.
9. Foco no `h1` após navegação reimplementado 5×.
10. Padrão "hook copia `queryOptions` com chave-placeholder" 7× (gera fábricas mortas: `accountQueries`, `orderQueries`, `quoteQueryOptions`).
11. `requireUser` × `requireOwner` (mutations de carrinho lançam `Error`, as demais `ApiError`).
12. Persistência do rascunho do checkout escrita 2× em `CheckoutForm`; banner de conflito de versão repetido em `ProfilePage` e `WalletForm`; dois `RelatedNfts` (`cart/` e `nft/`).

## 2. Tamanho e responsabilidade
Maiores: `CheckoutForm.tsx` 374 linhas (um componente de ~293 misturando rascunho, aceite de cotação, envio idempotente, 7 ramos de erro e UI), `ProfilePage.tsx` 298, `WalletForm.tsx` 293, `CartPage.tsx` 270, `reconcile.ts` 258. `ReviewDialog` recebe 15 props; `onAnnounce` desce 3 níveis. `OrderPage.tsx:49-58` tem efeito de negócio (limpa tentativa/rascunho e invalida carrinho); o `reconcile.ts` também invalida o carrinho em `confirmed` (duas vias).

## 3. Fronteiras
`components/layout` importa de `features` (`AccountDropdown` → `profile/avatar`, `SiteHeader` → `catalog/HeaderSearch`). Ciclos de diretório: `catalog`↔`nft`, `checkout`↔`order`, `queries`↔`realtime`. Código de `queries` morando em `features/checkout/wallets.ts`. `errorMessageOf` (12 importadores) vive em `components/layout/PageStates`. Duas pastas "shared" (`features/forms`, `features/shared`). `CartPage` e `useNftUpdateMessage` assinam o socket direto (falta `useRealtimeEvent`).

## 4. Código morto
Mortos: `UnderConstruction`, `SelectField`, `gt`, `accountQueries`, `orderQueries`, `quoteQueryOptions`, `possibleErrors`, `CONTRACTS_VERSION`, `realtime.noteVersion`, `components/ui/label.tsx`. ~100 exports usados só internamente (de-exportar). 17 exports usados só por mocks/testes. `components.json` aponta alias `@/hooks` inexistente.

## 5. Query / Router
Só `index` e `nft.$id` fazem prefetch; as 6 rotas privadas buscam dados depois de montar (dá para `prefetchQuery` no `_authed`). `staleTime` de pedidos/favoritos fora do mapa `STALE`; `refetchOnWindowFocus: true` redundante; chave de lista de pedidos escrita à mão (falta `orderLists()`). `useEffect` que viraria derivação: `SearchForm.tsx:33`, `FilterPanel.tsx:61`, `CheckoutForm.tsx:130` (estado `accepted` duplica `quote.data`). 7 chamadas a APIs marcadas como obsoletas no Query.

## 6. TypeScript e lint
`tsconfig` já é estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`...). Sem custo: ligar `noImplicitOverride`, `noUncheckedSideEffectImports`, `noImplicitReturns` (0 erros). `types: ["vite/client","node"]` vaza tipos Node para o browser (separar `tsconfig.app`/`tsconfig.node`). ESLint usa `strict` sem type-checked, sem `jsx-a11y` e sem `no-floating-promises` em `tests/`. `strictTypeChecked` em `src/`: 137 achados, ~25 acionáveis (`no-unnecessary-condition` ×10, `no-unsafe-*` ×12, em `reconcile.ts:187-212` e `client.ts:107,132`). Os casts mais arriscados estão em `reconcile.ts:194,199,211` (assumem formato do cache sem validar).

## 7. Convenções
Identificadores e comentários em inglês, UI em português: coerente. Comentários de processo (F8, R4, R6, R7, "slice S1/S2/S3", "shell volta 2"): reescrever o "porquê", remover a etiqueta. `console.error` de resposta fora do contrato (`client.ts:223`) deve ficar; `socket.ts:70` e `:100` passam por um `lib/log.ts` mínimo (`warn` só em DEV).

## 8. Testes
Specs com nome de processo (`qa-volta2`, `qa-fundacao-shell`, `qa-integrada`, `14-reteste-final`) não têm baseline visual: renomear é seguro (atualizar `ARCHITECTURE.md`, `BUGS.md`, matriz, STATUS). **Não renomear** `90-*`, `92-*`, `94-*`, `96-*` (baselines usam o nome do arquivo). Helpers duplicados: `seriousViolations` ×4, `settle` ×3, `logoutThroughUi`, construtores de evento (`nftEvent`, `orderEvent`, `envelope`) ×5. `waitForTimeout`: `01-catalog:122`, `12-skeletons:32,71`, `20-session-tabs:125`, `mocks.spec:438,683`. `mocks.spec.ts` tem 799 linhas.

## 9. Bundle (gzip, caminho crítico ~349 KB)
`browser` (MSW) 172,6 KB; `bootstrap` 76,3 KB; chunk `createLucideIcon` 46,8 KB (nome automático: contém TanStack Query, axios, socket.io-client e engine.io-client); `contracts` 31,3 KB; React 22,4 KB. `contracts/index.ts` reexporta `scenarios` (dados só de mocks no chunk do app). `socket.io-client` poderia carregar depois do primeiro paint (exige cuidado com a corrida `stop()`/import). Chunks nomeados (`advancedChunks`) melhorariam cache e leitura.

## Priorização
| # | Item | Benefício | Esforço | Risco | Baselines/testes | Recomendação |
|---|---|---|---|---|---|---|
| 1 | Remover código morto e de-exportar | menos superfície | P | baixo | não | agora |
| 2 | `scenarios` fora de `contracts/index`; chunks nomeados | tira dados de mocks do caminho crítico | P | baixo | e2e | agora |
| 3 | Flags de tsconfig sem custo; regras de lint (`no-unnecessary-condition`, `no-unsafe-*`, `jsx-a11y`, `no-floating-promises` em tests) | pega regressão de tipo e a11y | P-M | baixo | não | agora |
| 4 | Comentários de processo e logger único | legibilidade | P | baixo | não | agora |
| 5 | Constantes duplicadas (labels, ENS, `referralCode`, foco do `h1`) | fonte única | P-M | baixo-médio | cuidado com `shortAddress` (baseline 90) | agora, separador parametrizado |
| 6 | Hook de credencial único; hooks de carteira em `queries/` | remove 3 duplicatas | M | médio | e2e 03, 07, 08, 09 | agora, commit separado |
| 7 | Mapeador de erro único; mensagens de `QuoteIssue` | remove 2 pares | P-M | médio (textos assertados) | e2e 05, 06, 07 | depois |
| 8 | Quebrar `CheckoutForm`; efeitos de negócio fora de `OrderPage`/`CartPage`; `useRealtimeEvent` | testabilidade | M-G | médio-alto (idempotência) | e2e 06, 07, 09, 10 | depois |
| 9 | `socket.io-client` lazy; `loader` nas rotas privadas; `useOwnedQuery` | menos JS no 1º paint | M | médio | e2e realtime | depois |
| 10 | Renomear specs `qa-*`/`14-*`; deduplicar helpers; sem `console.log` e `waitForTimeout` | higiene | P-M | baixo | atualizar docs; não tocar 90/92/94/96 | agora |
| — | Unificar os dois `Field` | um sistema de campos | G | alto | regenera baselines 94/96, muda a11y | não fazer agora |
