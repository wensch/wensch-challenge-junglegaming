# BUGS

Formato: id · severidade · slice · passos · esperado · obtido · evidência · status.

## BUG-QA-001 · alta (latente) · fundacao · Open redirect: `safeRedirectSchema` aceita `/<TAB>/evil.com`
- Passos: abrir `/login?redirect=%2F%09%2Fevil.com`.
- Esperado: valor descartado (como `//evil.com`, `https://evil.com`, `/\evil.com`).
- Obtido: a página renderiza e `redirect` permanece `"/\t/evil.com"`; `new URL(redirect, origin)` resolve para `http://evil.com` (parsers WHATWG removem TAB/LF/CR). O schema só checa `startsWith('//')` e `'/\'`. Hoje o login é stub (sem consumo), mas a S2 usará esse valor para navegar; risco de open redirect pós-login. Mesmo vale para `/\n/evil.com`, `/\r/evil.com`.
- Correção sugerida: em `src/api/contracts/common.ts`, rejeitar controles (`/[\u0000-\u001f\u007f]/`) e validar com `new URL(v, 'http://x').origin === 'http://x'`.
- Evidência: `tests/e2e/qa-fundacao-shell.spec.ts` (`login redirect="/\t/evil.com"`, marcado `test.fail`; remover a marca ao corrigir).
- Status: FECHADO (reteste volta 2). Controles `/checkout?x=1` e `/nft/nft_004#a` preservados; `//evil.com`, `/<TAB|LF|CR|NUL>/evil.com`, `/.//evil.com`, `/..//evil.com`, `/a/..//evil.com`, `/%2e//evil.com`, `/\evil.com`, `https://evil.com` viram `null` no schema e `redirect` fica ausente na URL do browser. Evidência: `tests/e2e/qa-volta2.spec.ts` (reteste QA-001) + `qa-fundacao-shell.spec.ts`, verdes em desktop e mobile.

## BUG-QA-002 · média · fundacao · Foco vai para o `<h1>` na carga completa; Tab pula skip link e header
- Passos: abrir `/login` (ou carregar/recarregar qualquer página com `PageFrame`) e pressionar Tab.
- Esperado: primeiro Tab no skip link "Pular para o conteúdo".
- Obtido: `PageFrame` chama `h1.focus()` no mount (também no primeiro load); o ponto de partida da navegação passa a ser o h1, o primeiro Tab vai ao conteúdo e skip link/header só por Shift+Tab. `/em-breve` não foca o h1 (inconsistente).
- Correção sugerida: focar o h1 apenas em navegações client-side (não na carga inicial) e fazê-lo também em `/em-breve`.
- Evidência: spec `primeiro Tab apos carga completa alcanca o skip link` (`test.fail`, BUG-QA-002).
- Status: FECHADO (reteste volta 2). Primeiro Tab após carga completa cai em "Pular para o conteúdo" em `/`, `/login`, `/register`, `/cart`, `/em-breve`, `/nft/nft_004`; `07-focus.spec.ts` confirma foco no h1 só em navegação client-side.

## BUG-QA-003 · média · fundacao · CONFLICT_VERSION não é emitido pelo mock (conhecido)
- `PATCH /profile` e `PATCH /wallets/:id` com `version` antiga respondem 422 `VALIDATION` (`fieldErrors.version`); o contrato v1.1.0 declara 409 `CONFLICT_VERSION` (`resource`, `currentVersion`). Origem: `src/mocks/handlers/profile.ts`, `wallets.ts`. Teste em `mocks.spec.ts` ('stale version') afirma 422 e precisa ser atualizado junto.
- Status: FECHADO (reteste volta 2). PATCH com `version` antiga responde 409 `CONFLICT_VERSION` com `resource.kind` (`profile`/`wallet`) e `currentVersion = version+1`; `endpoints.ts` declara o código em updateProfile e updateWallet. Evidência: `qa-volta2.spec.ts` (QA-003) e `mocks.spec.ts` (stale version).

## BUG-QA-004 · baixa · fundacao · `createOrder` pode responder NOT_FOUND, não declarado em `errors`
- `POST /orders` com `walletId` inexistente -> 404 `NOT_FOUND` (`src/mocks/handlers/orders.ts`), mas `endpoints.ts` lista `['VALIDATION','FORBIDDEN','QUOTE_STALE','CONFLICT_AVAILABILITY','IDEMPOTENCY_CONFLICT']`. Declarar NOT_FOUND ou responder VALIDATION.
- Status: FECHADO (reteste volta 2). `createOrder.errors` inclui NOT_FOUND; `POST /orders` com carteira inexistente responde hoje 422 VALIDATION (também declarado), então runtime e contrato coincidem. Evidência: `qa-volta2.spec.ts` (QA-004/005).

## BUG-QA-005 · baixa · fundacao · Endpoints `guest` respondem VALIDATION sem declará-lo
- `GET /cart` (errors `[]`), `DELETE /cart/coupon`, `removeCartItem` sem `X-Guest-Id` nem token -> 422 `VALIDATION` (`fieldErrors['X-Guest-Id']`). Contrato não lista VALIDATION para esses endpoints. Atualizar `errors` ou tratar na doc.
- Status: FECHADO (reteste volta 2). `getCart`, `removeCartItem`, `removeCoupon` declaram VALIDATION; `GET /cart` sem X-Guest-Id responde 422 VALIDATION. Evidência: `qa-volta2.spec.ts`.

## BUG-QA-006 · baixa · fundacao · `/em-breve` não move o foco para o título após navegação
- Outras páginas (`PageFrame`) focam o h1; `UnavailablePage` não. Leitores de tela não anunciam a troca. Ver BUG-QA-002.
- Status: FECHADO (reteste volta 2). Navegação client-side do rodapé para `/em-breve` deixa o h1 focado; carga completa não move o foco. Evidência: `qa-volta2.spec.ts`, `07-focus.spec.ts`.

## BUG-QA-007 · baixa · fundacao · `latency.variable` (mocks.spec) com margem frágil; NÃO reproduzido na volta 2
- Passos: `BASE_URL=http://localhost:4173 npx playwright test tests/e2e/mocks.spec.ts -g latency.variable --repeat-each=10` (6 workers padrão: 20/20 verdes; 16 workers, repeat 15: 30/30 verdes; suíte completa 2x verde).
- Esperado: teste determinístico. Obtido: uma falha anterior (175 ms contra limite de 150 ms), não reproduzida.
- Causa provável: a asserção final compara a duração medida por `performance.now()` de duas rodadas da mesma sequência semeada (`Math.abs(a[i]-b[i]) < 150`). O atraso nominal é igual, mas cada medição soma o jitter de `setTimeout` + fila do MSW/worker; com 6 workers disputando CPU (e delays de até 2100 ms) o jitter de uma rodada isolada pode passar de 150 ms. É falha de margem do teste, não do mock. Classificado como risco de flake (baixo).
- Correção sugerida (dono dos mocks/QA): comparar o atraso solicitado (exposto pelo mock/`latency.ts`) em vez do tempo medido, ou tolerância proporcional (`max(150, 15% do atraso)`) com `test.retry` apenas para esse caso.
- Status: FECHADO (volta 3). O mock expõe o atraso sorteado no cabeçalho de resposta `X-Mock-Delay-Ms` (`src/mocks/http.ts`); o teste compara a sequência nominal entre as duas rodadas (igualdade exata, preserva o determinismo por semente) e usa só limites folgados para o tempo medido. Evidência: `--repeat-each=10` (20/20 verdes, desktop+mobile-harness) e `verify` verde.

## BUG-QA-008 · baixa · fundacao · Chunk `AccountDropdown` é baixado também no mobile, onde o dropdown não aparece
- Passos: viewport 390 px, logar e observar requests (`qa-volta2.spec.ts`, teste lazy, log `chunks antes do clique`).
- Esperado: no mobile só `MobileMenuSheet` (sob demanda/prefetch no hover/foco). Obtido: `AccountDropdown-*.js` carregado logo após o login mesmo em 390 px (header oculto), além de `MobileMenuSheet-*.js` ao abrir o menu.
- Impacto: um chunk a mais no mobile (performance, sem efeito funcional). Foco: Sheet e dropdown abrem com foco dentro do diálogo/menu e Esc devolve o foco ao gatilho (sem flash nem foco perdido).
- Status: aberto (baixa, opcional).
