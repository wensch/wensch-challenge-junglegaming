# fidelidade-visual — fundacao — 2026-11-03 (volta 1)
Veredito: CHANGES_REQUESTED

Build avaliado: main 6a48902 em http://localhost:4173 (sem build/preview/verify). Larguras 390, 768, 1440 (+ varredura 768-1440 para o header). Roteiro: `reports/fundacao/img/capture.mjs` e `overlap.mjs` (Playwright, executar com `node`). Prints em `reports/fundacao/img/` (`inicio-{390,768,1440}.png`, `404-*`, `embreve-*`, `menu-390.png`, `ref-header-1440.png` vs `ours-header-1440.png`, `ref-footer-1440.png` vs `ours-footer-1440.png`, `ref-tabbar-mobile.png` vs `mobile-viewport-390.png`).
Limite: os frames de referencia so mostram Inicio; 404, "Em construcao", Sheet e footer mobile nao tem frame (avaliados por coerencia de tokens).

## Medicoes que passaram
- Overflow horizontal: scrollWidth == clientWidth (390/390, 768/768, 1440/1440) em `/`, 404 e `/em-breve`.
- Fonte Roboto Mono carregada (`document.fonts.check` true; woff2 proprio). Corpo rgb(245,241,235) sobre rgb(20,13,10): bate com foreground/ink (dE 0).
- Header 1440: linha 1200x45 em x=120,y=24; logo 14/22 bold ls 1.4px (=0.1em); links 16px, ativo rgb(232,155,85)=#E89B55 bold; botao Entrar 100x35, raio 4px, bg rgb(210,138,76)=#D28A4C (dE 0). Confere com ref (Entrar em x=1220, 100x35; busca/carrinho no mesmo passo de 60px).
- Tab bar mobile: 390x95 fixa, botao central 65px com anel 6px na cor da pagina; Sheet abre com titulo, links e Entrar legiveis (menu-390.png).
- Footer 1440: tokens (circulos #D28A4C, faixa #38220F, titulos 17/18px bold, corpo 14/22) coincidem com ref.

## Achados
| # | Severidade | Descricao | Evidencia | Correcao sugerida |
|---|---|---|---|---|
| 1 | alta | Header em 768-~850 px: o link "Aprenda" colide com o icone de busca (a nav e `absolute left-1/2` e nao reserva espaco). Em 768, Aprenda termina em x=559 e a busca comeca em 524 (sobreposicao 35 px); em 820, 585 vs 576. A partir de 900 nao colide. O D6 (gap 24 px) nao resolve a faixa. | `node reports/fundacao/img/overlap.mjs` (768 e 820 `overlap true`); `inicio-768.png` | Em < `xl` tirar o posicionamento absoluto: nav `flex-1 justify-center` (ou `ml-8`) entre logo e acoes; ou mostrar a tab bar ate 1023 px; reduzir o gap a 16 px em md. Rever D6 como "nao aceito" ate corrigir. |
| 2 | media | Footer desktop 720 px de altura contra 610 px no Figma (instancia Footer 1200x610): bloco de destaques +36 px (padding inferior 33 vs 18, coluna D com nota extra), bloco de links +36 px (titulo a 52 px do topo vs 40; base 59 vs 45). | `ours-footer-1440.png` x `ref-footer-1440.png`; footer h=720 via getBoundingClientRect | Reduzir padding-bottom dos destaques para ~18, titulos de links a ~40 px do topo da secao, padding-bottom ~45. A nota D4 (aceita) justifica so ~+22 px na coluna D. |
| 3 | media | Colunas do footer 1440 fora de +-2 px: faixa da marca (textos em x=439/726/1013 vs ref 455/757/1060), links (x=444/736/1028 vs 455/757/1060 no ref; passo 292 vs 303), divisores dos destaques (427/685/943 vs 417/682/948). Ate 47 px de diferenca. | mesmos prints; coordenadas em `capture.mjs`/getBoundingClientRect | Usar grid de 4 colunas iguais com gap de 32 e padding de 32 px (passo 303 no bloco inferior); ajustar colunas dos destaques para 266 px. |
| 4 | media | Nav do header 1440 deslocada +24 px: Inicio em x=521 vs 496 no ref (nav centralizada em 720; no Figma o grupo ocupa 496-896, centro 696). Alturas/gap (40 px) corretos. | `ours-header-1440.png` x `ref-header-1440.png` | Alinhar a nav a x=376 da coluna (left 376 px) em vez de centralizar. |
| 5 | media | Skip link inalcancavel no primeiro Tab: apos o load o foco esta no `<h1>` (gestao de foco do router), entao o primeiro Tab vai para "Voltar para o inicio" e pula o skip link (so Shift+Tab o alcanca). O link em si existe, aparece com foco e leva a `#conteudo`. | `node /tmp/fv/skip.mjs`: apos load activeElement H1; Tab 0 -> "Voltar para o inicio"; ver `ov.mjs` ("before tab focus H1") | Focar o `<body>`/sentinela antes do skip link na carga inicial, ou nao mover foco ao h1 na primeira renderizacao (so em navegacoes seguintes). |
| 6 | baixa | h1 placeholder: 43px com line-height 55.9px; o token Display define 70px e o Figma 43/70. Tela e provisoria. | getComputedStyle(h1).lineHeight | Quando a tela real chegar usar `text-display` com lh 70 ou documentar. |
| 7 | baixa | Mobile: fundo do botao central usa gradiente e sombra, e o recorte curvo e anel (D2); glifo menu (D1). Visualmente proximo do ref (`mobile-viewport-390.png` x `ref-tabbar-mobile.png`); raio do topo da barra menor que o do Figma. | prints | Aceitavel; opcional aumentar raio superior para ~40px. |
| 8 | baixa | Footer mobile e 404/Em construcao sem frame; coerentes com tokens. Footer em 768 usa 4 colunas de links com titulos quebrando em 2 linhas ("Central de ajuda", "Redes sociais") e faixa da marca apertada ("Feito para colecionadores" em 4 linhas). | `inicio-768.png` | Em md usar 2 colunas de links ou reduzir gap/padding. |

## Julgamento dos desvios (ARCHITECTURE §13)
- D1 menu no botao central: aceito (Sheet funcional, acessivel).
- D2 anel em vez de recorte curvo: aceito.
- D3 footer mobile derivado: aceito (sem frame).
- D4 newsletter desabilitada + aviso: aceito (integridade), mas contribui para a altura do footer (achado 2).
- D5 icones de marca desenhados a mao: aceito (visual proximo do ref).
- D6 gutter/gap reduzido entre 768 e 1199: NAO aceito como esta; insuficiente (achado 1).

## Resumo
Alta: 1 (colisao busca x nav em 768-~850 px). Nenhuma critica. Reverificar achados 1, 4, 2/3 e 5 na proxima volta.
