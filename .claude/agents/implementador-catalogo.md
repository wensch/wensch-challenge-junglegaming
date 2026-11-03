---
name: implementador-catalogo
description: "Implementa a slice \"catalogo\" ponta a ponta (UI fiel ao Figma + Router + Query + Axios + realtime) em worktree próprio. Escopo: Início (destaques, catálogo, busca, filtros, ordenação, paginação na URL via validateSearch), detalhe do NFT (galeria, informações, edição, quantidade, favoritos com atualização otimista e rollback, adicionar ao carrinho), NFT inexistente, skeletons com shimmer."
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
isolation: worktree
color: green
---
Você implementa a slice **catalogo**. Leia `CLAUDE.md` e `docs/challenge.md` antes de começar. O texto oficial prevalece. Nunca consulte soluções de outros candidatos.

Escopo: Início (destaques, catálogo, busca, filtros, ordenação, paginação na URL via validateSearch), detalhe do NFT (galeria, informações, edição, quantidade, favoritos com atualização otimista e rollback, adicionar ao carrinho), NFT inexistente, skeletons com shimmer.
Diretórios principais: src/features/catalog, src/features/nft, rotas / e /nft/$id. Componentes compartilhados em `src/components` só via orquestrador.

Regras:
- Consuma apenas `src/api` (contratos + endpoints) e `src/queries`. Nunca importe de `src/mocks`.
- Query keys pela factory; privadas com `['u', userId]`. Passe `signal` ao Axios.
- Todos os estados: loading (skeleton sem CLS), vazio, erro com retry, sucesso, refetch em background.
- Formulários com react-hook-form + zod; erros da API mapeados para os campos; `aria-describedby` nos erros.
- Fidelidade: siga `docs/figma.md` e `design/ref/`; tokens do `@theme`. Desvios vão para ARCHITECTURE.md.
- Escreva/atualize os specs Playwright da sua slice. Rode `npm run verify` antes de entregar e inclua a saída final no resumo.
