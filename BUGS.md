# BUGS

Formato: id · severidade · slice · passos · esperado · obtido · evidência · status.

## BUG-QA-001 · alta (latente) · fundacao · Open redirect: `safeRedirectSchema` aceita `/<TAB>/evil.com`
- Passos: abrir `/login?redirect=%2F%09%2Fevil.com`.
- Esperado: valor descartado (como `//evil.com`, `https://evil.com`, `/\evil.com`).
- Obtido: a página renderiza e `redirect` permanece `"/\t/evil.com"`; `new URL(redirect, origin)` resolve para `http://evil.com` (parsers WHATWG removem TAB/LF/CR). O schema só checa `startsWith('//')` e `'/\'`. Hoje o login é stub (sem consumo), mas a S2 usará esse valor para navegar; risco de open redirect pós-login. Mesmo vale para `/\n/evil.com`, `/\r/evil.com`.
- Correção sugerida: em `src/api/contracts/common.ts`, rejeitar controles (`/[\u0000-\u001f\u007f]/`) e validar com `new URL(v, 'http://x').origin === 'http://x'`.
- Evidência: `tests/e2e/shell-routes-guards.spec.ts` (`login redirect="/\t/evil.com"`, marcado `test.fail`; remover a marca ao corrigir).
- Status: FECHADO (reteste volta 2). Controles `/checkout?x=1` e `/nft/nft_004#a` preservados; `//evil.com`, `/<TAB|LF|CR|NUL>/evil.com`, `/.//evil.com`, `/..//evil.com`, `/a/..//evil.com`, `/%2e//evil.com`, `/\evil.com`, `https://evil.com` viram `null` no schema e `redirect` fica ausente na URL do browser. Evidência: `tests/e2e/contracts-regressions.spec.ts` (reteste QA-001) + `shell-routes-guards.spec.ts`, verdes em desktop e mobile.

## BUG-QA-002 · média · fundacao · Foco vai para o `<h1>` na carga completa; Tab pula skip link e header
- Passos: abrir `/login` (ou carregar/recarregar qualquer página com `PageFrame`) e pressionar Tab.
- Esperado: primeiro Tab no skip link "Pular para o conteúdo".
- Obtido: `PageFrame` chama `h1.focus()` no mount (também no primeiro load); o ponto de partida da navegação passa a ser o h1, o primeiro Tab vai ao conteúdo e skip link/header só por Shift+Tab. `/em-breve` não foca o h1 (inconsistente).
- Correção sugerida: focar o h1 apenas em navegações client-side (não na carga inicial) e fazê-lo também em `/em-breve`.
- Evidência: spec `primeiro Tab apos carga completa alcanca o skip link` (`test.fail`, BUG-QA-002).
- Status: FECHADO (reteste volta 2). Primeiro Tab após carga completa cai em "Pular para o conteúdo" em `/`, `/login`, `/register`, `/cart`, `/em-breve`, `/nft/nft_004`; `07-focus.spec.ts` confirma foco no h1 só em navegação client-side.

## BUG-QA-003 · média · fundacao · CONFLICT_VERSION não é emitido pelo mock (conhecido)
- `PATCH /profile` e `PATCH /wallets/:id` com `version` antiga respondem 422 `VALIDATION` (`fieldErrors.version`); o contrato v1.1.0 declara 409 `CONFLICT_VERSION` (`resource`, `currentVersion`). Origem: `src/mocks/handlers/profile.ts`, `wallets.ts`. Teste em `mocks.spec.ts` ('stale version') afirma 422 e precisa ser atualizado junto.
- Status: FECHADO (reteste volta 2). PATCH com `version` antiga responde 409 `CONFLICT_VERSION` com `resource.kind` (`profile`/`wallet`) e `currentVersion = version+1`; `endpoints.ts` declara o código em updateProfile e updateWallet. Evidência: `contracts-regressions.spec.ts` (QA-003) e `mocks.spec.ts` (stale version).

## BUG-QA-004 · baixa · fundacao · `createOrder` pode responder NOT_FOUND, não declarado em `errors`
- `POST /orders` com `walletId` inexistente -> 404 `NOT_FOUND` (`src/mocks/handlers/orders.ts`), mas `endpoints.ts` lista `['VALIDATION','FORBIDDEN','QUOTE_STALE','CONFLICT_AVAILABILITY','IDEMPOTENCY_CONFLICT']`. Declarar NOT_FOUND ou responder VALIDATION.
- Status: FECHADO (reteste volta 2). `createOrder.errors` inclui NOT_FOUND; `POST /orders` com carteira inexistente responde hoje 422 VALIDATION (também declarado), então runtime e contrato coincidem. Evidência: `contracts-regressions.spec.ts` (QA-004/005).

## BUG-QA-005 · baixa · fundacao · Endpoints `guest` respondem VALIDATION sem declará-lo
- `GET /cart` (errors `[]`), `DELETE /cart/coupon`, `removeCartItem` sem `X-Guest-Id` nem token -> 422 `VALIDATION` (`fieldErrors['X-Guest-Id']`). Contrato não lista VALIDATION para esses endpoints. Atualizar `errors` ou tratar na doc.
- Status: FECHADO (reteste volta 2). `getCart`, `removeCartItem`, `removeCoupon` declaram VALIDATION; `GET /cart` sem X-Guest-Id responde 422 VALIDATION. Evidência: `contracts-regressions.spec.ts`.

## BUG-QA-006 · baixa · fundacao · `/em-breve` não move o foco para o título após navegação
- Outras páginas (`PageFrame`) focam o h1; `UnavailablePage` não. Leitores de tela não anunciam a troca. Ver BUG-QA-002.
- Status: FECHADO (reteste volta 2). Navegação client-side do rodapé para `/em-breve` deixa o h1 focado; carga completa não move o foco. Evidência: `contracts-regressions.spec.ts`, `07-focus.spec.ts`.

## BUG-QA-007 · baixa · fundacao · `latency.variable` (mocks.spec) com margem frágil; NÃO reproduzido na volta 2
- Passos: `BASE_URL=http://localhost:4173 npx playwright test tests/e2e/mocks.spec.ts -g latency.variable --repeat-each=10` (6 workers padrão: 20/20 verdes; 16 workers, repeat 15: 30/30 verdes; suíte completa 2x verde).
- Esperado: teste determinístico. Obtido: uma falha anterior (175 ms contra limite de 150 ms), não reproduzida.
- Causa provável: a asserção final compara a duração medida por `performance.now()` de duas rodadas da mesma sequência semeada (`Math.abs(a[i]-b[i]) < 150`). O atraso nominal é igual, mas cada medição soma o jitter de `setTimeout` + fila do MSW/worker; com 6 workers disputando CPU (e delays de até 2100 ms) o jitter de uma rodada isolada pode passar de 150 ms. É falha de margem do teste, não do mock. Classificado como risco de flake (baixo).
- Correção sugerida (dono dos mocks/QA): comparar o atraso solicitado (exposto pelo mock/`latency.ts`) em vez do tempo medido, ou tolerância proporcional (`max(150, 15% do atraso)`) com `test.retry` apenas para esse caso.
- Status: FECHADO (volta 3). O mock expõe o atraso sorteado no cabeçalho de resposta `X-Mock-Delay-Ms` (`src/mocks/http.ts`); o teste compara a sequência nominal entre as duas rodadas (igualdade exata, preserva o determinismo por semente) e usa só limites folgados para o tempo medido. Evidência: `--repeat-each=10` (20/20 verdes, desktop+mobile-harness) e `verify` verde.

## BUG-QA-008 · baixa · fundacao · Chunk `AccountDropdown` é baixado também no mobile, onde o dropdown não aparece
- Passos: viewport 390 px, logar e observar requests (`contracts-regressions.spec.ts`, teste lazy, log `chunks antes do clique`).
- Esperado: no mobile só `MobileMenuSheet` (sob demanda/prefetch no hover/foco). Obtido: `AccountDropdown-*.js` carregado logo após o login mesmo em 390 px (header oculto), além de `MobileMenuSheet-*.js` ao abrir o menu.
- Impacto: um chunk a mais no mobile (performance, sem efeito funcional). Foco: Sheet e dropdown abrem com foco dentro do diálogo/menu e Esc devolve o foco ao gatilho (sem flash nem foco perdido).
- Status: aberto (baixa, opcional).

## BUG-QA-009 · baixa · integrada · `waitForTimeout` remanescente em specs
- Passos: `grep -n waitForTimeout tests/e2e/*.ts` -> `01-catalog:122`, `12-skeletons:32`, `20-session-tabs:122`, `mocks.spec:438,683`.
- Esperado: sem espera arbitrária (regra de QA). Obtido: 5 ocorrências (passam, risco de flake/asserção negativa fraca).
- Evidência: `reports/s-integrada/qa-features.md`. Status: aberto (baixa).

## BUG-QA-010 · baixa · reteste final · Sheet do menu mobile não tem "Lista de interesse"
- Passos: 390 px, logado, "Abrir menu". Esperado: link para `/favorites` como no dropdown desktop. Obtido: só Perfil/Carteiras; a página é alcançável pela aba "Favoritos" da barra inferior e pelo rodapé.
- Status: aberto (baixa, opcional). O coração do card no catálogo é `md:hidden` por desenho (desktop favorita no detalhe).

## BUG-QA-011 · média · a11y · Revisão do pagamento não devolve o foco a "Confirmar compra" ao fechar
- Passos: logado com item no carrinho, `/checkout`, conectar carteira, focar "Confirmar compra" e pressionar Enter (abre "Revisar pedido"), pressionar Esc. Idêntico em desktop e mobile 390.
- Esperado (WCAG 2.4.3 / padrão de diálogo): diálogo fecha e o foco volta ao botão que o abriu.
- Obtido: diálogo fecha e `document.activeElement` é `<body>` (o botão continua conectado e habilitado; registro de focusin/focusout mostra só `focusout` de "Voltar e editar", sem nenhum `focusin`). Hipótese: o Radix guardou `body` como elemento anterior porque o botão perdeu o foco na abertura (o `Button` usa `disabled` ligado a `quote`; reabertura dispara `quote.refetch()`), ou o `CheckoutForm` não fornece `onCloseAutoFocus` apontando para o botão. Correção sugerida: `onCloseAutoFocus` do `ReviewDialog` focando o botão de submit via ref.
- Evidência: `tests/e2e/15-foco-dialogos.spec.ts` (`test.fixme`, BUG-QA-011); armadilha de foco, Tab/Shift+Tab e Esc passam no teste irmão.
- Status: corrigido. `ReviewDialog` recebe `returnFocusRef` (botão "Confirmar compra") e usa `onCloseAutoFocus` para focá-lo se ainda estiver montado e habilitado. Evidência: `15-foco-dialogos` (Esc devolve o foco) passa em desktop e mobile, 5x sem retry.

## BUG-QA-012 · média · a11y · Reflow a 320 CSS px: o rodapé gera rolagem horizontal em todas as telas (WCAG 1.4.10)
- Passos: viewport 320x568; abrir `/`, `/nft/nft_001`, `/login`, `/cart`, `/checkout`, `/profile`, `/favorites`.
- Esperado: `document.documentElement.scrollWidth <= clientWidth` (sem rolagem horizontal).
- Obtido: `scrollWidth` = 360 em todas. Causa comum: `<section class="grid grid-cols-[3rem_1fr] gap-x-4 md:block lg:pr-4">` do rodapé (`SiteFooter`) mede 312 px a partir de x=48 (direita em 360); o texto interno (h2/p com 248 px) não encolhe. Em emulação mobile o viewport de layout cresce para 360 e a barra inferior fixa passa a ser mais larga que 320 (efeito derivado). Em 640 px (zoom 200% de 1280) não há overflow; o conteúdo principal (fora do rodapé) cabe em 320 e os botões de ação ficam visíveis e clicáveis no desktop.
- Correção sugerida: `min-w-0` nas colunas `1fr` e quebra de linha nos textos do rodapé (ou `grid-cols-[3rem_minmax(0,1fr)]`).
- Evidência: `tests/e2e/16-zoom-reflow.spec.ts` (`test.fixme`, BUG-QA-012); sondagem por elemento descrita acima.
- Status: corrigido. Causa real: a grade do rodapé tinha coluna implícita `auto` (min-content 360 px) além do `1fr` da seção; agora `grid-cols-[minmax(0,1fr)]` na grade e `minmax(0,1fr)` na seção (md+ inalterado). Evidência: `16-zoom-reflow` inclui o documento inteiro a 320 px, com clique em ambos os projetos, 5x sem retry.

## BUG-QA-013 · baixa · realtime · Sem como medir listeners do socket e conexões do servidor simulado
- Esperado (RT-7): poder afirmar que, após logout/troca/navegação, os listeners do socket e as conexões abertas voltam ao baseline.
- Obtido: o app expõe só `data-connections` (connects do socket atual, zera no stop), `data-status`, `data-user` e `data-applied`; `window.__mock` não expõe a contagem de conexões abertas nem `socket.listeners`. O spec `17-liberacao-listeners.spec.ts` mede o que existe (assinantes do QueryCache, que incluem a assinatura do reconciler; observers; um único evento aplicado exatamente uma vez; evento do usuário anterior não aplicado), mas sockets zumbis só seriam detectados indiretamente.
- Faltaria expor: `window.__mock.connectionCount()` (conexões abertas no `Set` de `src/mocks/realtime.ts`) e, no `realtime-probe`, `data-listeners` (soma de `socket.listeners` dos eventos de `EVENT_TYPES`) e `data-event-subscribers` (`eventListeners.size`).
- Status: aberto (baixa, opcional).

## BUG-QA-014 · média · a11y · Tablet 768 px: ponto do carrossel do Hero viola `target-size` (WCAG 2.5.8, axe "serious")
- Passos: viewport 768x1024; abrir `/`; rodar axe (wcag2a/aa/21/22aa).
- Esperado: nenhuma violação crítica/séria (alvos de toque >= 24 px sem sobreposição).
- Obtido: `target-size` serious em `.size-6[type="button"]:nth-child(4)` (botões `Destaque N de M` de `src/features/catalog/Hero.tsx`, `size-6` = 24 px, `md:ml-[548px]`). A 1440 e 390 px não ocorre (`91-a11y-catalog`).
- Correção sugerida: investigar a sobreposição do 4º ponto com a arte do Hero a 768 px (z-index/posição do grupo) ou garantir 24 px livres.
- Evidência: `tests/e2e/tablet-768.spec.ts` (`test.fixme` "início", BUG-QA-014); 5/5 repetições falharam igual.
- Status: **corrigido**. Causa: o grupo de pontos tinha `md:ml-[548px]` (margem do frame de 1440 px), que a 768 px colocava o 4º ponto sobre o link da arte; agora a margem vale só a partir de 1200 px (`min-[1200px]:ml-[548px]`) e abaixo disso os pontos ficam alinhados à esquerda. `tablet-768.spec.ts` "início" reativado (4× sem retry, 56/56 junto com `91-a11y-catalog`).
