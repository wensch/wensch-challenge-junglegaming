# fidelidade-visual — fundacao — 2026-11-03 (volta 2)
Veredito: APPROVED

Build: main 2ad75fc em http://localhost:4173 (sem build/preview/verify). Larguras 390/768/1440 + varredura 768-1440 do header. Roteiros: `node reports/fundacao/img/overlap.mjs`, `BASE_URL=http://localhost:4173 node reports/fundacao/arquiteto-evidence/shell-measure.mjs`, `node reports/fundacao/img/v2-capture.mjs`, `node reports/fundacao/img/v2-border.mjs`. Prints: `reports/fundacao/img/v2-*` (inicio/404/embreve por largura, header-768/1440, header-sweep-{768,800,850,1000,1199,1300}, footer-768/1440, skip-*, mobile-viewport-390, menu-390).

## Achados
| # | Severidade | Descricao | Status / Evidencia | Correcao sugerida |
|---|---|---|---|---|
| 1 (v1) | alta | Colisao nav x busca 768-~850 px | CORRIGIDO. `overlap.mjs`: 768 Aprenda 470 / busca 540; 820 496/592; 900 536/672; 1024 626/780; 1199 713/955; 1440 894/1100; todos `overlap false`. `v2-header-sweep-768.png`, `-850.png` | - |
| 2 (v1) | media | Altura do footer 1440 | CORRIGIDO. Card 576 (Figma 574), destaques 252/250, faixa 88/88, links 236/236, copyright 36/36. O elemento `footer` mede 636 contra a instancia de 610: o excesso de ~24 px e espaco externo ao card (padding do footer), nao o card. `v2-footer-1440.png` x `ref-footer-1440.png` | Opcional: conferir se o padding externo de 24 px existe no Figma |
| 3 (v1) | media | Colunas do footer | CORRIGIDO. Divisores 417/683/949, faixa e links 152/455/758/1060 (identico ao Figma), linhas a 30 px. shell-measure | - |
| 4 (v1) | media | Nav 1440 deslocada | CORRIGIDO. "Inicio" em x=496 (ref 496), fonte 16/20, ativo rgb(232,155,85), gap 40. `v2-header-1440.png` | - |
| 5 (v1) | media | Skip link no primeiro Tab | CORRIGIDO. Foco inicial em BODY; primeiro Tab = "Pular para o conteudo" (x=12,y=12, outline solid) em 390/768/1440. `v2-skip-*.png` | - |
| 6 (v1) | baixa | h1 placeholder 43/55.9 vs token 70 | Aberto, tela provisoria | Resolver na tela real |
| 7 (v1) | baixa | Raio da tab bar | CORRIGIDO (D8, 40 px); `v2-mobile-viewport-390.png` x `ref-tabbar-mobile.png`, barra 390x95 fixa | - |
| 8 (v1) | baixa | Footer 768 apertado | CORRIGIDO. 2 colunas em faixa e links, sem quebra de titulos (`v2-footer-768.png`) | - |
| 9 (novo) | baixa | Ref do header tem badge "6" no carrinho (estado com itens); o build mostra o carrinho sem badge (carrinho vazio) | Comparacao `ref-header-1440.png` x `v2-header-sweep-1300.png`; borda inferior 1px rgb(63,35,25) em 1200 px presente | Nenhuma; a badge entra com a slice de carrinho |
| 10 (novo) | baixa | Entre 768 e 1199 a nav fica centralizada no espaco livre, nao na pagina (sem frame): em 768 Inicio em x=143 | `v2-header-sweep-768.png` | Aceitavel |

## Regressoes
- Overflow horizontal: scrollWidth == clientWidth em `/`, 404 e `/em-breve` nas 3 larguras (390/390, 768/768, 1440/1440).
- Header 1440: logo 14/22 em x=120, nav 16px em x=496, cores e botao Entrar sem regressao (dE 0 em relacao as medicoes da volta 1).
- Tab bar 390: fixa, 390x95, botao central com anel, Sheet abre (`v2-menu-390.png`).
- Nenhuma regressao visual detectada em 390/768/1440.

## Julgamento dos desvios
- D6 (revisto): aceito. Sem sobreposicao de 768 a 1440; 1440 segue o Figma.
- D7: aceito. Medidas dentro de +-2 px do Figma (card 576 vs 574; destaques 252 vs 250 = 2 px, no limite da tolerancia).
- D8: aceito.

## Resumo
Alta/critica: nenhuma. Todos os achados da volta 1 corrigidos, exceto o baixa #6 (tela provisoria).
