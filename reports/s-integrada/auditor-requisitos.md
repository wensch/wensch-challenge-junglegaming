# auditor-requisitos — s-integrada — 2026-11-04
Veredito: CHANGES_REQUESTED

Base: main fd8f5b5 (= origin/main). Sem build, preview nem verify (instrução do orquestrador); evidência = verify GREEN (390 e2e, 22 visuais, 28 a11y), relatórios QA/SEG/REV/FID, leitura dos specs e greps. Matriz: 121 OK · 18 parcial · 8 pendente (`—`).

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | crítica | Lighthouse inexistente (ELIM-1, STK-9, LH-1..5, DEL-6) | `ls lighthouse` falha; `package.json` aponta para `lighthouse/run.mjs` | Em andamento por outro agente; versionar config, 3 medições, relatórios HTML/JSON |
| 2 | alta | README ausente (DEL-4, DEL-8) | `ls README.md` falha | Setup, env, credenciais, cenários/reset, comandos, falhas, declaração de IA |
| 3 | alta | Baselines Linux só do shell (6 de 28); CI visual vermelho (E2E-14, DEL-7, ELIM-6) | `find tests/__screenshots__/linux -type f` = 6; win32 = 22 | Rodar workflow `visual-baselines`, revisar e commitar |
| 4 | média | Deploy igual ao HEAD não confirmado e smoke em produção não executado (DEL-2) | `git ls-remote origin main` = fd8f5b5; curl da produção = 200, sem build id | `BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test` após o deploy |
| 5 | média | Checkout limpo não executado (DEL-7) | Nenhum `npm ci` em clone novo | Executar depois de README e baselines |
| 6 | média | Fidelidade: relatório `CHANGES_REQUESTED` sem reverificação; imagem do Detalhe 404 contra 444 px; Confirmação não medida (UI-1, UI-2, TEL-10) | `reports/s-integrada/fidelidade-visual.md` #3; 768 px coberto depois por `13-overflow` | Reexecutar fidelidade-visual |
| 7 | média | Flake F1 sem reconfirmação (ELIM-6); REV #4 e #5 sem correção registrada | um verify verde | Rodar o gate 2 vezes antes da entrega |
| 8 | baixa | Sem spec de foco preso no diálogo de revisão (A11Y-2, E2E-11); sem teste de liberação de listeners (RT-7); zoom 200% não testado (A11Y-7) | grep `toBeFocused` em `06`/`07` = vazio | Adicionar specs |

## Eliminatórios
ELIM-2, 3, 4 e 5: OK. ELIM-1: parcial (só falta Lighthouse). ELIM-6: parcial (baselines Linux e estabilidade do gate). Greps limpos: zero `Number(`/`parseFloat` em ETH fora dos mocks, zero import de `src/mocks` fora de `src/main.tsx`, cache/setters só em `05-unit-cache` (unidade, QueryClient isolado), chaves privadas sempre `['u', userId]`.

## Pendências que bloqueiam entrega
Lighthouse; README (DEL-4, DEL-8); baselines Linux das telas novas; checkout limpo (DEL-7); deploy == HEAD com smoke em produção (DEL-2). Todas confirmadas.

---

# Fechamento final — 2026-11-04 — base main 824a22f
Veredito: APPROVED (sem bloqueios; ressalvas listadas como "Não bloqueia")

Matriz: 137 OK · 10 parcial · 0 pendente (147 linhas). Antes: 121 · 18 · 8. Não rodei build, preview, Playwright nem verify (instrução); a evidência executada vem do orquestrador (clone limpo em 9b0f011: verify GREEN, 408 e2e, 22 visuais, 28 a11y; CI Ubuntu success; produção 458 passed, 0 failed) e dos meus greps/`ls` em 824a22f.

## Eliminatórios
| ID | Status | Evidência |
|---|---|---|
| ELIM-1 | OK | Stack completa, agora com Lighthouse (`lighthouse/run.mjs`, config, environment.md, 12 relatórios HTML/JSON em `reports/2026-11-04/`) |
| ELIM-2 | OK | `qa-integrada`, `06`, `03`, `05`, `08`, verify do clone limpo |
| ELIM-3 | OK | `10` "confirmação só vem da simulação", `qa-integrada`, SEG |
| ELIM-4 | OK | SEG `s2s3.sec` (alice/bob), `20-session-tabs`, `04b-favorites-page`, chaves `['u', userId]` via factory |
| ELIM-5 | OK | `09`, `10`, `05`, `00-smoke` só por `window.__mock`; grep `setQueryData`/`.handle(` em `tests` fora de `05-unit-cache` = zero |
| ELIM-6 | OK | Clone limpo GREEN + CI Ubuntu success (16 min) + produção sem falhas |

## Achados (rodada final)
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | baixa | LH-2 parcial: Perf mobile 70/68 contra 90, justificada | `lighthouse/README.md`, `summary.md`; LH-5 proíbe simplificar | Aceitável pelo "ou justificado"; opcionalmente reduzir JS inicial |
| 2 | baixa | BUG-QA-009: `waitForTimeout` em `tests` | `grep -rn waitForTimeout tests` = 6 | Trocar por espera de condição |
| 3 | baixa | Parciais de fidelidade/a11y (UI-1, UI-2, TEL-10..12, A11Y-2, A11Y-7, RT-7, E2E-11) | Matriz | Specs de foco do diálogo de revisão, zoom 200%, medir Confirmação |
| 4 | baixa | Contagem: `tests/__screenshots__/linux` tem 22 arquivos (a descrição do orquestrador citava 28 baselines; 28 é o total de a11y) | `find ... -type f \| wc -l` = 22 | Nenhuma; CI verde com 22 |
| 5 | baixa | Deploy == HEAD vale para 9b0f011; HEAD atual 824a22f só mudou testes/relatórios | `git log` | Refazer smoke se o app mudar |

## Pendências que bloqueiam entrega
Nenhuma.

Não bloqueia: deduplicação entre slices (revisor 5), BUG-QA-009, BUG-QA-010 (link "Lista de interesse" no sheet mobile), baixas de segurança 1 a 5, avisos de CRLF, R2 a R5 do revisor.
