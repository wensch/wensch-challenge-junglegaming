# BUGS

Formato: id · severidade · slice · passos · esperado · obtido · evidência · status.

## BUG-QA-001 · alta (latente) · fundacao · Open redirect: `safeRedirectSchema` aceita `/<TAB>/evil.com`
- Passos: abrir `/login?redirect=%2F%09%2Fevil.com`.
- Esperado: valor descartado (como `//evil.com`, `https://evil.com`, `/\evil.com`).
- Obtido: a página renderiza e `redirect` permanece `"/\t/evil.com"`; `new URL(redirect, origin)` resolve para `http://evil.com` (parsers WHATWG removem TAB/LF/CR). O schema só checa `startsWith('//')` e `'/\'`. Hoje o login é stub (sem consumo), mas a S2 usará esse valor para navegar; risco de open redirect pós-login. Mesmo vale para `/\n/evil.com`, `/\r/evil.com`.
- Correção sugerida: em `src/api/contracts/common.ts`, rejeitar controles (`/[\u0000-\u001f\u007f]/`) e validar com `new URL(v, 'http://x').origin === 'http://x'`.
- Evidência: `tests/e2e/qa-fundacao-shell.spec.ts` (`login redirect="/\t/evil.com"`, marcado `test.fail`; remover a marca ao corrigir).
- Status: corrigido na volta 2 (contratos v1.2.0, `safeRedirectSchema` + `toSafeRedirect`); `test.fail` removido. Aguarda reteste do QA.

## BUG-QA-002 · média · fundacao · Foco vai para o `<h1>` na carga completa; Tab pula skip link e header
- Passos: abrir `/login` (ou carregar/recarregar qualquer página com `PageFrame`) e pressionar Tab.
- Esperado: primeiro Tab no skip link "Pular para o conteúdo".
- Obtido: `PageFrame` chama `h1.focus()` no mount (também no primeiro load); o ponto de partida da navegação passa a ser o h1, o primeiro Tab vai ao conteúdo e skip link/header só por Shift+Tab. `/em-breve` não foca o h1 (inconsistente).
- Correção sugerida: focar o h1 apenas em navegações client-side (não na carga inicial) e fazê-lo também em `/em-breve`.
- Evidência: spec `primeiro Tab apos carga completa alcanca o skip link` (`test.fail`, BUG-QA-002).
- Status: corrigido na volta 2 (foco no h1 só após navegação client-side, `src/lib/navigation.ts`); `test.fail` removido. Aguarda reteste do QA.

## BUG-QA-003 · média · fundacao · CONFLICT_VERSION não é emitido pelo mock (conhecido)
- `PATCH /profile` e `PATCH /wallets/:id` com `version` antiga respondem 422 `VALIDATION` (`fieldErrors.version`); o contrato v1.1.0 declara 409 `CONFLICT_VERSION` (`resource`, `currentVersion`). Origem: `src/mocks/handlers/profile.ts`, `wallets.ts`. Teste em `mocks.spec.ts` ('stale version') afirma 422 e precisa ser atualizado junto.
- Status: aberto (já conhecido).

## BUG-QA-004 · baixa · fundacao · `createOrder` pode responder NOT_FOUND, não declarado em `errors`
- `POST /orders` com `walletId` inexistente -> 404 `NOT_FOUND` (`src/mocks/handlers/orders.ts`), mas `endpoints.ts` lista `['VALIDATION','FORBIDDEN','QUOTE_STALE','CONFLICT_AVAILABILITY','IDEMPOTENCY_CONFLICT']`. Declarar NOT_FOUND ou responder VALIDATION.
- Status: contrato alinhado na v1.2.0 (`createOrder.errors` inclui NOT_FOUND). Aguarda reteste.

## BUG-QA-005 · baixa · fundacao · Endpoints `guest` respondem VALIDATION sem declará-lo
- `GET /cart` (errors `[]`), `DELETE /cart/coupon`, `removeCartItem` sem `X-Guest-Id` nem token -> 422 `VALIDATION` (`fieldErrors['X-Guest-Id']`). Contrato não lista VALIDATION para esses endpoints. Atualizar `errors` ou tratar na doc.
- Status: contrato alinhado na v1.2.0 (VALIDATION declarado em getCart, removeCartItem, removeCoupon). Aguarda reteste.

## BUG-QA-006 · baixa · fundacao · `/em-breve` não move o foco para o título após navegação
- Outras páginas (`PageFrame`) focam o h1; `UnavailablePage` não. Leitores de tela não anunciam a troca. Ver BUG-QA-002.
- Status: corrigido na volta 2 (`/em-breve` usa `PageFrame`). Aguarda reteste.
