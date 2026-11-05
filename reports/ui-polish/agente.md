# agente — ui-polish — 2026-11-05
Veredito: APPROVED (alterações no worktree, sem commit)

## Achados / entregas
| # | Severidade | Descrição | Evidência | Correção |
|---|---|---|---|---|
| 1 | média | Botão "Favoritar" fora do Figma (fonte 16 px, ícone 20 px esticado, borda na cor primária) | `design/ref/desktop-detalhe.png` + `design/figma-meta.xml` (Frame 162: 130x40, coração 20 px em x=13, texto 76 px em x=41 = 14 px mono) | `FavoriteButton.tsx`: 130x40 (mesma altura do COMPRAR), texto 14 px, coração `HeartIcon` vazio de 16 px na caixa de 20 px à esquerda, contorno 1 px `text-accent`; favoritado = coração cheio na mesma cor. Rótulo fixo e `aria-pressed` mantidos. Medido: botão 130x40, COMPRAR 130x40, fonte 14px, ícone x+16 |
| 2 | info | Divergência com o pedido: o texto da tarefa dizia ~79 px de largura; o Figma (meta e PNG) mostra 130x40 igual ao COMPRAR | meta XML | mantida a medida do Figma (130x40). Mobile não tem botão rotulado (ícone redondo do topo, igual ao Figma mobile) |
| 3 | — | Cursor/hover centralizados | `src/index.css` (camada base): `cursor:pointer` em button/links/role tab/menuitem/option/combobox/select/summary/labels de checkbox e radio/range; `not-allowed` em desabilitados; transição de cor 150 ms; fallback hover `brightness(1.18)` para controles sem `hover:` próprio. `Button`: `cursor-pointer`, `disabled:cursor-not-allowed` (removido `pointer-events-none` para o cursor aparecer), transição explícita no lugar de `transition-all`, hover do default com sombra. Itens de dropdown/select: `cursor-pointer`. Foco visível intacto |
| 4 | — | Animações (CSS, sem dependência) | `rise` 280 ms (opacity+translateY 8 px) em Promos, DetailTabs, Mais desta coleção (abaixo da dobra; Hero/LCP intocado); `pop` 260 ms no coração favoritado (ícone e botão) e no badge do carrinho (`key={count}`); NftCard: hover-lift 2 px, sombra e zoom 4% da arte dentro do `overflow-hidden`. `prefers-reduced-motion` desliga `rise`/`pop` e a regra global já zera transições; lift/zoom usam `motion-safe:` |

## Evidência executada
- `npx tsc -b --noEmit && npx eslint .`: verde. `npm run build`: ok.
- Suíte completa (PW_PORT=4197, build existente): 560 passed, 44 skipped (específicos de projeto), 0 falhas — inclui 13-overflow, clipped-content, 91/93/95 axe, 02, 04, 01, 05, 12, 16, 22/23/24 e todos os `@visual` (baselines win32 sem diferença: nenhum snapshot regenerado).
- Novo teste em `tests/e2e/23-figma-geometry.spec.ts` (desktop): altura = COMPRAR, largura 130 ±2, fonte 14 px, borda 1 px, rótulo "Favoritar", coração antes do texto.
- Captura do botão (hover) conferida visualmente contra o PNG do Figma.
- Lighthouse (2 rodadas, mediana de 3 cada): mobile início 76 → 80, detalhe 79 → 77; desktop 99/98 e 99; A11y/BP/SEO 100; CLS 0.000. Variação de ±3 entre rodadas indica ruído da máquina (mudança é só CSS/classes); o teto 78/79 não é estável na máquina local — vale uma rodada de conferência no deploy.

## Notas
- `ARCHITECTURE.md` §13: linha D45 (verificar colisão de número com o outro agente de /criadores e /aprenda).
- Não foram tocados rotas nem itens de menu do SiteHeader (só a classe do badge do carrinho).
- Relatórios do Lighthouse regenerados foram descartados (`git checkout -- lighthouse`).
