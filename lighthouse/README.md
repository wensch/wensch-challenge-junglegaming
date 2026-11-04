# Lighthouse

Execucao: `npm run lighthouse` (build de producao + `vite preview` na porta 4191, cenario padrao dos mocks; `LH_SKIP_BUILD=1` pula o build, `LH_PORT`, `LH_RUNS` ajustam). 3 execucoes por pagina e perfil, mediana. Relatorios HTML/JSON em `lighthouse/reports/2026-11-04//`, resumo em `summary.md`/`summary.json`, ambiente em `environment.md`.
Nota: a porta 4190 e bloqueada pelo Chrome/fetch (ERR_UNSAFE_PORT), por isso 4191.

## Medianas (2026-11-04/)

| Pagina | Perfil | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms | FCP ms | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| inicio (/) | mobile | 67 | 100 | 96 | 92 | 5447 | 0.000 | 486 | 904 | 989 |
| detalhe (/nft/nft_002) | mobile | 66 | 100 | 96 | 92 | 5341 | 0.000 | 560 | 902 | 1623 |
| inicio (/) | desktop | 98 | 100 | 96 | 92 | 1164 | 0.000 | 16 | 245 | 348 |
| detalhe (/nft/nft_002) | desktop | 93 | 100 | 96 | 92 | 1110 | 0.143 | 13 | 243 | 431 |

Metas: Perf >= 90, A11y >= 95, BP >= 95, SEO >= 90. Atingidas: A11y (100), BP (96), SEO (92) em todas; Perf desktop (98 / 93). **Nao atingida: Performance mobile (67 / 66)**, LCP ~5,4 s e TBT ~490-560 ms. CLS desktop do detalhe = 0,143 (acima de 0,1).

## Diagnostico

1. **Flake NO_NAVSTART (causa: `src/mocks/browser.ts:22-23,49-79`)**. Em perfil limpo o Service Worker do MSW ainda nao controla a pagina, entao `ensureControlled()` chama `location.reload()` (linha 79) e o documento carrega duas vezes. O trace do Lighthouse perde o navigationStart em parte das execucoes (observado: ~1/3 a 5 descartes por celula). O runner descarta e repete execucoes com runtimeError (contagem em `summary.json`, campo `discarded`); nada e escondido: a nota usa so execucoes validas. Em usuario real e so a primeira visita.
2. **LCP mobile 5,4 s (simulado 4x CPU + 3G lento)**. Decomposicao observada: TTFB 10 ms, **resource load delay ~540 ms**, load 50 ms, render 16 ms. A imagem LCP so e descoberta depois que o JS boota (`index.html` so tem `<div id=root>`; a imagem nasce no React). O caminho critico e: `main.tsx` -> `import('./mocks/browser')` (**browser-*.js, 479 kB / 177 kB gz, ~72 kB nao usado na carga**, e o MSW + mocks) -> seed + `worker.start` -> `import('./bootstrap')` (**bootstrap-*.js, 243 kB**) -> query -> render. Os imports sao sequenciais (`src/main.tsx:13-16`), nao paralelos.
3. **TBT mobile ~490-560 ms**: long tasks de `bootstrap` (3 de ~145-250 ms) e `createLucideIcon` chunk (142 kB, ~150 ms) + `browser-*.js` (script 570 ms de CPU nao-throttled/simulado). Parse/execucao do MSW e do bootstrap.
4. **CSS bloqueante**: `index-*.css` custa ~300 ms mobile (insight render-blocking).
5. **CLS 0,143 desktop no detalhe**: o unico deslocamento e o `<footer>` (`src/components/layout/SiteFooter.tsx:76`) empurrado quando o conteudo real substitui `DetailSkeleton` (`src/features/nft/NftDetailPage.tsx:66`): a altura do skeleton em desktop nao bate com a do conteudo carregado. Mobile e inicio: CLS 0.
6. Best Practices 96: `/favicon.ico` 404 (console). SEO 92: `robots.txt` ausente/invalido (`public/` nao tem `robots.txt`; o rewrite do `vercel.json` devolve HTML).

## Correcoes recomendadas (prioridade)

1. (alta, LCP/TBT) Paralelizar o boot em `src/main.tsx:13-16`: iniciar `import('./bootstrap')` como `modulepreload`/`Promise.all` com o MSW, mantendo a regra de carregar engine.io so depois do worker (importar o modulo, mas avaliar a ordem). Alternativa mais simples: `modulepreload` do chunk `browser` no plugin de `vite.config.ts:11-41` (hoje so o grafo do bootstrap) para eliminar a cascata.
2. (alta, TBT) Reduzir custo do chunk `browser-*.js`: carregar `@faker`/seed pesados sob demanda e tirar do caminho critico `buildSeed()` (`src/mocks/browser.ts:19`); verificar tree-shaking de MSW (72 kB nao usados).
3. (media, TBT) `createLucideIcon-*.js` (142 kB): importar icones por arquivo/named para que o chunk so tenha os usados; verificar com o visualizador de bundle.
4. (media, CLS) Fazer `DetailSkeleton` (`NftDetailPage.tsx:66`) reservar a mesma altura minima do conteudo em >= md (min-height no container), ou reservar min-height para o footer; alvo CLS < 0,1.
5. (media, LCP) Inline do CSS critico ou `media`/split do CSS nao critico (render-blocking ~300 ms mobile). Imagem LCP do detalhe ja usa `fetchPriority="high"` (`Gallery.tsx:41`), mas nao e descobrivel no HTML inicial; so o item 1 resolve isso sem SSR.
6. (baixa, BP/SEO) Adicionar `public/favicon.ico` (ou `<link rel=icon>` em `index.html`) e `public/robots.txt`; com `vercel.json` o rewrite `/(.*)` ja cobre, entao excluir `robots.txt` do rewrite se necessario.
7. (baixa, flake) `src/mocks/browser.ts:79`: evitar o reload na primeira visita (ex.: `clients.claim` ja no install) para o trace ficar estavel e o primeiro carregamento nao pagar duas vezes.

Nenhuma dessas correcoes simplifica o app: MSW, Socket.IO e demais itens da stack permanecem.
