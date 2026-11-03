# Figma — referência de design

- Original: https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge (sem acesso via MCP: exige edição)
- Cópia do candidato (usada): https://www.figma.com/design/ua5xsyQarfBRq7v7ZxWXPr/Frontend-Challenge--Copy- — página `0:1` "Marketplace de NFTs GreenMint"
- Marca exibida no layout: **KURIO**
- Metadados completos (posições/tamanhos de todos os nós): `.spike/figma-meta.xml`

## Frames → rotas

| Frame | Node | Tamanho | Rota | PNG (1x) |
|---|---|---|---|---|
| Desktop / Início | 2:2 | 1440×3668 | `/` | design/ref/desktop-inicio.png |
| Desktop / Detalhes do NFT | 10:244 | 1440×2246 | `/nft/$id` | design/ref/desktop-detalhe.png |
| Desktop / Carrinho de NFTs | 11:1278 | 1440×1754 | `/cart` | design/ref/desktop-carrinho.png |
| Desktop / Pagamento | 11:2862 | 1440×1657 | `/checkout` | design/ref/desktop-pagamento.png |
| Desktop / Confirmação de Pedido | 11:4385 | 1440×1657 | `/orders/$id` | design/ref/desktop-confirmacao.png |
| Desktop / Login | 9:115 | 1440×1981 | `/login` | design/ref/desktop-login.png |
| Desktop / Cadastro | 9:1022 | 1440×1981 | `/register` | **pendente** (limite do MCP) |
| Desktop / Perfil do Colecionador | 9:1238 | 1440×1080 | `/profile` | design/ref/desktop-perfil.png |
| Desktop / Carteiras | 9:1670 | 1440×1080 | `/wallets` | **pendente** (limite do MCP) |
| Mobile / Início | 14:5226 | 414×896 | `/` | design/ref/mobile-inicio.png |
| Mobile / Detalhes do NFT | 15:5536 | 414×896 | `/nft/$id` | design/ref/mobile-detalhe.png |
| Mobile / Carrinho de NFTs | 16:360 | 414×896 | `/cart` | **pendente** (limite do MCP) |
| Mobile / Pagamento | 16:748 | 414×896 | `/checkout` | design/ref/mobile-pagamento.png |
| Mobile / Login | 16:1022 | 414×896 | `/login` | design/ref/mobile-login.png |
| Mobile / Cadastro | 16:1228 | 414×896 | `/register` | design/ref/mobile-cadastro.png |

Sem frame: perfil, carteiras e confirmação em mobile (derivar do padrão visual).

## Tokens (variáveis do Figma, `get_variable_defs` em 2:2)

Cores:
| Token | Valor |
|---|---|
| color/ink (fundo da página) | #140D0A |
| color/surface-card | #241612 |
| color/surface-dark | #38220F |
| color/border | #3F2319 |
| color/border-soft | #55321F |
| color/primary | #D28A4C |
| color/secondary | #B39463 |
| color/text-accent | #E89B55 |
| color/text-primary | #F7F3EC |
| color/foreground | #F5F1EB |
| color/text-secondary | #CFB28C |
| color/background-elevated | #FBFBFB |

Tipografia: família única **Roboto Mono** (400/500/700). Escala usada:
Display 43/70 Bold · Heading 24 Bold · Body Large 18 (Bold lh16/24, Regular lh16) · 17 Bold · 16 (Bold lh auto/20, Medium, Regular lh auto/16) · Body 15 (Regular lh40/16, Bold lh40, Medium lh16) · Body 14 (Bold ls 10%, Medium lh16 ls10%/lh20, Regular lh16/22/24/30) · Caption 13 Regular lh22 · Caption 12 Bold lh14 · Tiny 10 Medium · Tiny 9 Bold.
(`letterSpacing: 10` no Figma = 10% → `0.1em`.)

## Assets
- O catálogo reutiliza 5 ilustrações (macacos: óculos/jaqueta verde, chapéu/moletom roxo, gorila/gola alta, fones laranja, + variações). Plano: exportar do Figma em 2x; se o limite do MCP impedir, recortar do PNG 1x do frame de Início (hero ~450px) e registrar a substituição em ARCHITECTURE.md.
- Ícones (busca, carrinho, redes sociais): lucide-react equivalente; documentar.

## Limitação de acesso
O MCP do Figma no plano Starter atingiu o limite de chamadas após ~17 chamadas (2026-11-03). Frames pendentes e assets em 2x precisam de: nova janela de limite, export manual pelo usuário (Export → PNG 2x para `design/ref/` e imagens para `public/nft/`), ou REST API do Figma com token pessoal do usuário.
