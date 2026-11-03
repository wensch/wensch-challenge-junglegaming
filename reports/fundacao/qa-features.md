# qa-features — fundacao — 2026-11-03
Veredito: CHANGES_REQUESTED

Servidor: preview em http://localhost:4173 (main 6205fed; mesmo build de 6a48902 para estes arquivos). Nada de build/verify rodado.

## Execução
- Suíte existente (`00-smoke`, `mocks`, `90-visual-shell`, `91-a11y-shell`) em desktop e mobile: 96 passed, 2 skipped (testes específicos de projeto), 0 falhas. Os 24 cenários de `mocks.spec.ts` passam.
- Novo spec permanente `tests/e2e/qa-fundacao-shell.spec.ts`: 56 passed, 2 skipped; inclui 3 testes `test.fail` que documentam BUG-QA-001 (x2 projetos) e BUG-QA-002 (x2). Remover as marcas ao corrigir.
- Cobertura do novo spec: deep link + refresh de todas as rotas públicas e privadas (com e sem sessão); `?redirect=` com 9 variantes maliciosas; todos os links do shell resolvem e `/em-breve` mostra "Nenhuma ação foi realizada" sem `role=status` de sucesso; Tab no header (desktop); Sheet com foco preso, Esc devolve o foco e tab bar por teclado (mobile).

## Stack
- Nenhum `fetch`/XHR fora de `src/mocks`; todas as chamadas passam por `src/api/client.ts` (Axios, instância única). Socket só via `src/realtime/socket.ts` (`socket.io-client`).
- Importações de `mocks` fora de `src/mocks`: apenas `src/main.tsx` (dynamic import); as demais ocorrências são comentários.

## Mock × contrato
- O `route()` valida entrada (query/body) e saída com os schemas de `endpoints.ts`; sem divergência de schema de sucesso observada (status de sucesso vem de `def.status`, 200 no replay).
- Idempotência (mesma chave = mesmo pedido 200; corpo diferente = 409 IDEMPOTENCY_CONFLICT), reset, isolamento de `order.updated` entre Alice e Bob: verdes em `mocks.spec.ts`.
- Divergências de status/erro: BUG-QA-003, 004, 005.

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | alta (latente) | BUG-QA-001: `safeRedirectSchema` aceita `/<TAB>/evil.com`; vira `//evil.com` ao resolver | spec `login redirect="/\t/evil.com"` | rejeitar caracteres de controle e checar origem com `new URL` |
| 2 | média | BUG-QA-002: foco no h1 na carga completa; primeiro Tab pula skip link e header | spec `primeiro Tab apos carga completa...` | focar h1 só em navegação client-side |
| 3 | média | BUG-QA-003: mock devolve 422 VALIDATION em vez de 409 CONFLICT_VERSION (conhecido) | `profile.ts`, `wallets.ts` | emitir CONFLICT_VERSION e atualizar mocks.spec |
| 4 | baixa | BUG-QA-004: `createOrder` devolve NOT_FOUND não declarado | `handlers/orders.ts` vs `endpoints.ts` | declarar no contrato |
| 5 | baixa | BUG-QA-005: endpoints guest devolvem VALIDATION não declarado | `GET /cart` sem credenciais -> 422 | declarar no contrato |
| 6 | baixa | BUG-QA-006: `/em-breve` não foca o título | `UnavailablePage` | usar PageFrame/foco |
