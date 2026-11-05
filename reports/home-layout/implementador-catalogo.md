# implementador-catalogo — home-layout — 2026-11-05
Veredito: APPROVED (com desvios registrados em ARCHITECTURE.md D41)
## Achados
| # | Severidade (crítica/alta/média/baixa) | Descrição | Evidência (comando/print/trace) | Correção sugerida |
|---|---|---|---|---|
| 1 | baixa | Card 8 sem texto no Figma: "Amber Echo #233" 0.79 ETH inventado; cards 5 e 9 reutilizam artwork-04/09 (artwork-07/11 ausentes em design/assets) | figma-meta.xml, ARCHITECTURE D41 | Exportar os assets |
| 2 | baixa | Contagens da barra lateral são reais (4 por coleção; redes 19/10/7), não 33/12/65...; faixa de preço é o intervalo real | tests/__screenshots__/win32/desktop/90-visual-catalog.spec.ts/inicio.png | Aceito (D41) |
| 3 | baixa | Destaque (Spotlight) mostra Neon Vessel; o Figma mostra a gorila de chapéu | inicio.png | Fora do escopo do pedido |
| 4 | info | Seed com 36 NFTs (4 páginas); nft_001 usa hero-emerald-ape.webp 1350x1350 e é trending (slide 1 do Hero); esgotados movidos para nft_010/014/023/032; coleções alternam entre as 2 primeiras da categoria (todas com irmãs em "Mais desta coleção"); esqueleto mobile das abas de 631 para 540 px | e2e: 113 + 20 specs passando; 26 visuais regenerados | — |
