# perf-agent — perf — 2026-11-05
Veredito: CHANGES_REQUESTED (meta Perf mobile >= 90 NAO atingida: 78 / 79)
## Achados
| # | Severidade | Descricao | Evidencia | Correcao sugerida |
|---|---|---|---|---|
| 1 | alta | Perf mobile 78 (inicio) e 79 (detalhe), meta 90. Antes 68/68. Desktop 98/99, A11y/BP/SEO 100, CLS 0 | `npm run lighthouse` (3x, mediana), lighthouse/README.md "Rodada de otimizacao 2" | Dividir `vendor` por rota (radix so onde usado), `import()` de socket.io-client apos o 1o render, enxugar chunk dos mocks (176 KB gz) |
| 2 | info | Imagens WebP + srcset: hero 130 KB -> 7 KB (240w) no mobile; sem efeito na nota (LCP simulado dominado por JS) | scripts/optimize-images.mjs, public/nft | - |
| 3 | info | `advancedChunks` vendor: +10 pontos, TBT 446 -> 204 ms. Chunk `realtime` compartilhado com os mocks quebrou BP (WebSocket real antes do MSW); revertido | vite.config.ts | - |
| 4 | info | Specs 12-skeletons, 13-overflow, 90/91, 01-catalog, mocks.spec (desktop+mobile): 140 passed, 2 skipped; tsc + eslint limpos | playwright | - |
