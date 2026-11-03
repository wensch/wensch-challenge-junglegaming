---
description: Executa o ciclo de uma slice (implementar → fidelidade ‖ QA ‖ segurança → revisor sênior → corrigir, máx. 3 voltas)
argument-hint: <slice: fundacao|catalogo|conta|checkout|integracao|auditorias|release>
---
Slice alvo: **$ARGUMENTS**

Você é o orquestrador (ver `CLAUDE.md`). Execute para a slice `$ARGUMENTS`:

1. Leia `PLANO.md` (seção da slice), `docs/requirements-matrix.md` (linhas da slice) e `STATUS.md`.
2. Despache o implementador da slice (`implementador-*`, ou `arquiteto-contratos` + `plataforma-mocks` para `fundacao`) com a lista exata de requisitos (IDs da matriz) e critérios de aceite. Ele trabalha em worktree próprio.
3. Quando o implementador entregar com `npm run verify` verde, despache **em paralelo**: `fidelidade-visual`, `qa-features`, `seguranca`. Cada um grava `reports/$ARGUMENTS/<agente>.md`.
4. Depois, `revisor-frontend-senior` sobre o diff, considerando os três relatórios.
5. Se houver `CHANGES_REQUESTED` ou achado alto/crítico: devolva ao implementador com os achados (volta n+1). Máximo 3 voltas; na 3ª falha, registre em `ESCALATIONS.md` (slice, bloqueio, tentativas, evidência) e siga para a próxima slice.
6. Com o DoD do `CLAUDE.md` cumprido: faça merge do worktree em `main` (commit pequeno), rode `npm run verify` em `main`, peça ao `auditor-requisitos` que atualize a matriz, e atualize `STATUS.md` (fase, slice, veredictos, link dos relatórios, próximo passo).

Nunca declare a slice concluída sem a saída de `verify` e os relatórios gravados.
