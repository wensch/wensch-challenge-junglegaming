# fidelidade-visual — s-integrada — 2026-11-04
Veredito: CHANGES_REQUESTED

Escopo: Início, Detalhe, Carrinho, Pagamento, Perfil, Carteiras, Login e Cadastro em 390/768/1440 (preview 4173, usuário alice com 2 itens no carrinho). Medido via getComputedStyle/boundingBox com `reports/s-integrada/fidelidade-img/measure.mjs`. Resultados brutos em `fidelidade-img/measure.json`; capturas full-page em `fidelidade-img/*.png`. Confirmação (`/orders/$id`) e CLS dos skeletons não foram medidos nesta rodada.

## Achados
| # | Severidade | Descrição | Evidência | Correção sugerida |
|---|---|---|---|---|
| 1 | alta | Rolagem horizontal em 768 px no Detalhe: scrollWidth 1091 > clientWidth 768. A linha de ações (`div.flex.w-full.md:w-auto`, 316 px) e a linha de avaliações/preço (`p.flex`, até x=901) passam do viewport | `measure.json` chave `detalhe@768` (sw 1091); script de overflow: filhos com right 901 e 1091 em `/nft/nft_001` | Permitir `flex-wrap` e `min-w-0` na coluna de detalhes entre `md` e `lg`. Conferir o grid de duas colunas em 768 |
| 2 | alta | Rolagem horizontal em 768 px no Perfil: scrollWidth 833 > 768. Um `button.rounded-control.px-1.text-body-sm` (67 px) termina em x=833 | `measure.json` chave `perfil@768`; overflow-scan de `/profile` | Quebrar a linha do menu "Meu perfil" (D12) ou aplicar `min-w-0`/`flex-wrap` no contêiner até `lg` |
| 3 | média | Imagem principal do Detalhe (1440): 404x404 em x=268; o Figma pede 444x444 em x=248 (-9%, fora de ±2%). Miniatura 96 vs 100 | `measure.json` `detalhe@1440` imgs[1]; `.spike/figma-meta.xml` nó 70342:2683 | Largura da coluna de imagens 573 px (miniaturas 100, gap 28, principal 444) |
| 4 | baixa | Alturas totais em 1440 divergem do frame (Início 3136 vs 3668 por causa de D14; Perfil 1733 vs 1080 por causa de D11 e do conteúdo real). Detalhe 2415 vs 2246 e Carrinho 1869 vs 1754 | `measure.json` campo `h` | Aceitável quando vem dos desvios D11/D14/D18/D20 |

## Conformes (medidos)
- Sem overflow horizontal em 390 e 1440 em nenhuma tela; em 768 apenas Detalhe e Perfil (achados 1 e 2).
- Fundo do body `rgb(20,13,10)` = #140D0A em todas as telas. Família Roboto Mono em body e títulos.
- Hero do Início: h1 43px/70px, peso 700, #F7F3EC, caixa 600x140 em x=160 (igual ao Figma). Título do Detalhe 28/37 com caixa x=725 (Figma 725). Títulos de seção 16/20 e 17/24 em bold conforme a escala. Cor de acento #E89B55 nos títulos de seção.
- Desvios D9 a D21: aceitáveis como declarados. Nenhum esconde defeito de layout.
