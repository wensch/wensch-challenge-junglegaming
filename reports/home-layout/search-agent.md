# search-agent — home-layout — 2026-11-05
Veredito: APPROVED (ver saída de `npm run verify` no resumo da entrega)

## O que mudou
- `HeaderSearch.tsx`: o painel flutuante virou `useHeaderSearch` + `HeaderSearchTrigger` (lupa) + `HeaderSearchBar` (barra no fluxo, largura do container, linha própria abaixo do cabeçalho; empurra o conteúdo). Placeholder "Buscar por nome, coleção ou criador", botão "Buscar", botão "Fechar busca". Enter submete, Esc/fechar devolvem o foco à lupa; `#busca` ainda abre. Busca na URL (`q`, `page: 1`) inalterada. Sem animação.
- `SearchForm.tsx`: prop `trailing`. `SiteHeader.tsx`: renderiza a barra dentro de `<header>`, depois da linha do cabeçalho.
- Mobile (< md): não há header; continua a barra inline "Explorar coleções" (inalterada).
- D41 em ARCHITECTURE.md §13 (D16 atualizado).

## Achados
| # | Severidade | Descrição | Evidência | Correção |
|---|---|---|---|---|
| 1 | baixa | A 768 px (< lg) existem duas caixas "Buscar NFTs" (barra do cabeçalho + barra inline da home); preexistente | spec 97 escopa pelo form | Opcional: esconder a inline em md |

## Testes
- Novo `tests/e2e/97-header-search.spec.ts`: bounding boxes (barra abaixo da linha do cabeçalho, termina antes do Hero, Hero empurrado), placeholder sem corte, largura do container, sem scroll horizontal, axe, foco/Esc/Fechar, Enter. 768 e 1440. Baselines win32 `header-search-768/1440.png` (inspecionadas).
- `92-header-tablet.spec.ts`: seletor do grupo de ações ajustado (a lupa agora é filha direta).
