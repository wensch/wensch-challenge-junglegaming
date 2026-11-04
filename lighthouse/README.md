# Lighthouse

Execucao: `npm run lighthouse` (build de producao + `vite preview` na porta 4191, cenario padrao dos mocks; `LH_SKIP_BUILD=1` pula o build, `LH_PORT`, `LH_RUNS` ajustam). 3 execucoes por pagina e perfil, mediana. Relatorios HTML/JSON em `lighthouse/reports/2026-11-04//`, resumo em `summary.md`/`summary.json`, ambiente em `environment.md`.
Nota: a porta 4190 e bloqueada pelo Chrome/fetch (ERR_UNSAFE_PORT), por isso 4191.

## Medianas (2026-11-04/)

| Pagina | Perfil | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms | FCP ms | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| inicio (/) | mobile | **70** | 100 | 100 | 100 | 5852 | 0.000 | 374 | 903 | 945 |
| detalhe (/nft/nft_002) | mobile | **68** | 100 | 100 | 100 | 5600 | 0.000 | 475 | 905 | 1581 |
| inicio (/) | desktop | 97 | 100 | 100 | 100 | 1242 | 0.000 | 8 | 244 | 329 |
| detalhe (/nft/nft_002) | desktop | 98 | 100 | 100 | 100 | 1154 | 0.000 | 5 | 241 | 326 |

Metas: Perf >= 90, A11y >= 95, BP >= 95, SEO >= 90. Atingidas, exceto Performance mobile (ver "Resultado final e justificativa").


## Resultado final e justificativa (LH-2)

Medianas de 3 execucoes validas por celula (tabela acima), build de producao com os mocks ativos (cenario padrao), medidas sozinhas na maquina, sem outros processos. Atingidas em todas as celulas: A11y (100), Best Practices (100), SEO (100), CLS (0) e Performance desktop (97 / 98). **Nao atingida: Performance mobile (70 / 68 contra a meta de 90).**

Por que a nota mobile fica abaixo, com os dados medidos:

- A nota usa o LCP **simulado** (Slow 4G de 1,6 Mbps, RTT de 150 ms, CPU 4x mais lenta): 5,8 s. O LCP **observado** no mesmo carregamento e de ~0,65 s (TTFB 10 ms, espera pelo recurso 549 ms, download 48 ms, renderizacao 45 ms) e o FCP e de 0,9 s. A diferenca e custo de bytes e de CPU simulados, nao latencia real.
- O carregamento inicial baixa **528 KB gzip de JavaScript** (56 scripts): **175 KB (um terco) sao a camada de mocks** (MSW, handlers e seed), que o enunciado exige no build de demonstracao, e 353 KB sao do app (React, TanStack Router e Query, zod, Axios, Socket.IO client, Radix e o codigo das telas). A 1,6 Mbps, so transferir isso custa ~2,6 s antes de executar; o `bootstrap` ainda gasta ~516 ms de script e o chunk dos mocks ~365 ms (CPU 4x).
- O que foi feito sem alterar o comportamento: `modulepreload` do grafo de boot e das rotas de entrada, seed preguicoso em paralelo ao start do worker, skeletons com geometria final (CLS 0), `favicon.ico` e `robots.txt`, fonte com preload e `font-display`, cache imutavel dos assets. Ganho: BP e SEO de 96 / 92 para 100, CLS do detalhe de 0,143 para 0. A Performance mobile mudou pouco (67 / 66 para 70 / 68) porque os preloads reduzem espera de rede, nao os bytes nem a CPU.
- O que ainda cortaria mais (adiar `socket.io-client`, dividir `createLucideIcon`, partir mais o `bootstrap`) renderia por estimativa ~5 pontos, nao 20. Chegar a 90 exigiria remover pecas da stack obrigatoria ou tirar o MSW do caminho do medidor, e o item LH-5 do enunciado proibe simplificacoes feitas so para a nota. Por isso a nota fica medida e justificada, sem esse tipo de atalho.
- Fora do build de demonstracao (sem a camada de mocks, que e uma ferramenta de teste), o app entregaria ~33% menos JS no mesmo caminho.

## Diagnostico (primeira medicao, antes das correcoes)

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
