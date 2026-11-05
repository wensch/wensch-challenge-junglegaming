# BRIEFING — Desafio Frontend "Marketplace de NFTs"

> Documento de partida para o Claude Code. Salve na raiz do projeto como `BRIEFING.md` e inicie com:
> **"Leia o BRIEFING.md por inteiro e execute as instruções da seção 12, na ordem."**

---

## 1. Contexto

Estou em um processo seletivo para Frontend Developer. A etapa atual é um teste técnico online com prazo curto (2 dias a partir do envio do e-mail). O escopo é grande de propósito e eu vou desenvolvê-lo com apoio de IA, usando uma **equipe de subagentes** com validação contínua e automatizada, para entregar com qualidade muito alta.

- Enunciado oficial: https://github.com/junglegaming/frontend-challenge (README)
- Layout: https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1
- Entrega: link do repositório + URL pública do deploy (Vercel recomendada; Netlify e Cloudflare Pages também aceitas).

**Regras de integridade (inegociáveis):**
- Não consulte, copie ou se inspire em soluções de outros candidatos (o repositório do desafio tem forks e PRs públicos). Ignore-os.
- Use apenas credenciais e dados fictícios. Nunca coloque segredos reais no repositório.
- O README final deve declarar com transparência que a solução foi desenvolvida com apoio de IA.
- A entrega precisa ser compreensível para mim: decisões documentadas em `ARCHITECTURE.md`, para que eu consiga defendê-las em uma conversa técnica.

## 2. O que o desafio exige (resumo fiel; a fonte de verdade é o README oficial)

Primeira ação: baixe o README oficial e salve em `docs/challenge.md`. O resumo abaixo orienta, mas **o texto oficial prevalece** em qualquer divergência.

### 2.1 Stack obrigatória (todas devem participar efetivamente)
React, TypeScript, TanStack Router, TanStack Query, Axios (todas as chamadas REST passam por ele), Socket.IO (cliente), Tailwind CSS, shadcn/ui, MSW (mocking na camada de rede), Playwright (E2E + regressão visual), Lighthouse. Build tool, organização e bibliotecas complementares são livres.

### 2.2 Telas (desktop e mobile)
Início (destaques, catálogo, busca, filtros, ordenação, paginação) · Detalhes do NFT (galeria, informações, edição, quantidade, favoritos, compra) · Carrinho (quantidades, remoção, cupom, resumo) · Pagamento (dados, carteira e rede, revisão, envio) · Confirmação de pedido · Login · Cadastro · Perfil (dados, avatar, senha) · Carteiras (principal e secundária). Perfil, carteiras e confirmação também devem funcionar em mobile mesmo sem frame específico. Estados não desenhados seguem o padrão visual existente. Páginas editoriais, suporte, atividade, ofertas e downloads ficam fora do escopo; ações fora do escopo não podem aparentar sucesso.

### 2.3 Comportamentos-chave
- **URL como estado:** busca, filtros, ordenação e paginação vivem na URL e sobrevivem a refresh e histórico; mudar filtro reinicia a paginação; filtros combináveis; resultados vazios, falhas e respostas fora de ordem tratados.
- **Detalhe:** acesso direto, NFT inexistente, edição indisponível, limite de quantidade; favoritos persistem para o usuário autenticado.
- **Carrinho:** respeita disponibilidade por NFT/edição; persiste após refresh; itens do visitante preservados ao autenticar; cupom aplicado/removido com tratamento de inválido/expirado; subtotal, desconto, taxa de rede e total coerentes com a API; reflete mudanças de preço/disponibilidade recebidas em tempo real.
- **Valores em ETH:** strings decimais com precisão (nunca `number`/float); quantidades inteiras; a cotação da API é a referência para finalizar.
- **Pagamento/pedido:** validar campos; revisão antes de enviar; carteiras cadastradas com seleção de rede e simulação de conexão, recusa e desconexão; **revalidar preço, disponibilidade, cupom e taxas antes de confirmar** (mudança exige nova confirmação); impedir pedido duplicado (clique repetido, reenvio após timeout); estados pendente/confirmado/recusado com recuperação após refresh ou reconexão; confirmação só para pedido efetivamente confirmado; preservar itens em falha; após confirmar, remover do carrinho só os itens/quantidades comprados; recibo é snapshot imutável.
- **Conta/sessão:** cadastro, login, logout, sessão recuperável após refresh; tratar expiração durante navegação e checkout preservando contexto; logout/troca de usuário limpam cache privado e subscriptions; validação de formulários incluindo erros da API; senha nunca em claro.
- **Integração/estado:** contratos tipados ponta a ponta; estados de loading/vazio/erro/sucesso/refetch em segundo plano; invalidação coerente; cancelamento/descarte de respostas obsoletas; isolamento de dados por usuário e por parâmetros; recuperação de falhas sem duplicar operações; rotas inexistentes tratadas; **pelo menos uma atualização otimista com rollback**; política de cache, retries e sincronização documentada.
- **Contratos REST mínimos:** sessão/conta, NFTs (listagem + detalhe), favoritos, carrinho, cotação (cupom, disponibilidade, descontos, taxas, total), pedidos (criação **idempotente** com chave de idempotência; mesma chave retorna o mesmo pedido; mesma chave com conteúdo diferente gera conflito), perfil, carteiras. Erros representados: validação, sessão inválida, sem permissão, inexistente, conflito de disponibilidade, falha transitória.
- **MSW:** mocks só na camada de rede (nenhum dado fictício em componentes, hooks ou cliente Axios); estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos; persistência local permitida; reset restaura cenário conhecido; ativável por configuração e disponível no build de demonstração; cenários configuráveis e reproduzíveis (lentidão, latência variável, timeouts, queda de conexão, HTTP 4xx/5xx). Fixtures variadas, ao menos 2 usuários, e cenários determinísticos para: sucesso e vazio; latência variável e respostas fora de ordem; falha de conexão e 4xx/5xx; sessão expirada e não autorizado; conflito de cadastro/validação; cupom inválido/expirado; preço alterado ou edição esgotada durante a compra; timeout após criação do pedido com recuperação por idempotência; pagamento confirmado e recusado.
- **Tempo real (Socket.IO):** eventos mínimos `nft.updated` (preço e disponibilidade em catálogo, detalhe e carrinho) e `order.updated` (estado do pedido, confirmação ou recusa). Eventos com identidade estável, recurso afetado e versão; tolerar duplicatas e eventos antigos sem regredir estado nem reaplicar efeitos; reconciliar com REST após reconexão; eventos de sessão anterior não atualizam dados de outro usuário; liberar listeners/subscriptions no fim do ciclo de vida. **Os cenários devem exercitar `socket.io-client` de verdade**, via MSW com integração compatível (ex.: `@mswjs/socket.io-binding`); chamar setters/callbacks/cache direto **não vale**. Documentar transporte e limitações. Cenário obrigatório: NFT no carrinho muda de preço/disponibilidade → UI informa e atualiza resumo → checkout impede confirmar cotação desatualizada. Também: queda de conexão com pedido pendente → após reconectar/recarregar recupera o estado sem nova compra; confirmado/recusado são terminais.
- **UI/a11y:** fidelidade ao Figma (tipografia, cores, espaçamento, hierarquia, imagens, proporções); desktop, tablet e mobile (testar 390, 768 e 1440 px); **skeletons com shimmer** em catálogo, detalhe e resumo do carrinho, sem layout shift e respeitando `prefers-reduced-motion`; navegação por teclado e foco visível; foco controlado em diálogos/drawers; semântica, labels e erros associados; alt text; contraste e estados não dependentes só de cor; feedback acessível de mutations e mudanças em tempo real; sem overflow horizontal indevido e sem perda de conteúdo com zoom. Documentar substituições de asset e ajustes de acessibilidade.
- **Playwright:** E2E executável com os mocks cobrindo: (01) busca, filtros combinados, ordenação, paginação e histórico; (02) acesso direto ao detalhe e recurso inexistente; (03) cadastro, login, expiração, logout e troca de usuário; (04) favoritos com falha e recuperação; (05) carrinho, quantidades, remoção, cupom e persistência após refresh/login; (06) compra completa até o recibo; (07) falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido; (08) perfil, avatar, senha e carteiras com erros de validação; (09) mudança de preço/disponibilidade via Socket.IO durante o checkout; (10) eventos duplicados/antigos, desconexão e retomada de pedido pendente; (11) teclado, foco de diálogos e validação de formulários; (12) skeletons em carregamento lento, feedback de falha e retry. Chromium, viewports desktop e mobile. Regressão visual de início, detalhe, carrinho e pagamento com baselines versionadas e dados estáveis. Cada teste parte de estado isolado; controlar relógio, latência e disparo de eventos. Relatório HTML e traces de falhas. Testes de tempo real passam pelo cliente Socket.IO; os de REST pelos handlers MSW.
- **Lighthouse:** início e detalhe do NFT, perfis mobile e desktop, build otimizado, cenário padrão dos mocks. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Três medições por página/perfil, reportar a mediana; registrar LCP, CLS e TBT; justificar resultados abaixo da meta; sem simplificações que existam só para melhorar a nota; versionar configuração, relatórios HTML/JSON, versões das ferramentas e ambiente.
- **Entrega:** código, lockfile, assets, mocks, fixtures, testes e configs de auditoria; **deploy obrigatório** igual ao código entregue, com mocks e tempo real funcionando, e acesso direto/refresh de rotas funcionando (fallback de SPA); `README.md` com setup, variáveis de ambiente, credenciais fictícias, seleção e reset de cenários, comandos e como reproduzir falhas; `ARCHITECTURE.md` com contratos REST e eventos, política de sessão, estado do carrinho, estratégia de cache, reconciliação REST/Socket.IO, limitações, decisões de UX e desvios do Figma; comandos para dev com mocks, build, preview, typecheck, lint, Playwright e Lighthouse; execução a partir de checkout limpo, sem serviços privados.

### 2.4 Critérios de avaliação (100 pts)
Fidelidade visual e responsividade 20 · Fluxos e experiência 20 · Integração e estado 15 · Tempo real 10 · Mocking 10 · Testes 10 · Acessibilidade 5 · Performance 5 · Arquitetura e documentação 5.

### 2.5 Eliminatórios (nunca podem ocorrer)
1. Não usar de fato a stack obrigatória.
2. Fluxos principais apenas visuais.
3. Compra confirmada sem resposta da simulação.
4. Exposição de dados entre usuários.
5. Eventos simulados diretamente na UI (sem passar por `socket.io-client`).
6. Ausência de testes E2E executáveis.

## 3. A equipe (subagentes)

Defina cada um em `.claude/agents/<nome>.md` (frontmatter com `name`, `description`, `tools`; escolha o modelo mais capaz para arquiteto e revisor, e um mais leve para tarefas mecânicas). Agentes de revisão/auditoria usam ferramentas restritas: leem código, executam comandos de verificação e **escrevem apenas em `reports/`**.

| Agente | Missão | Entrega / gate |
|---|---|---|
| **orquestrador** (sessão principal) | Despacha trabalho, integra, mantém `STATUS.md`, decide escalonamentos. Não implementa feature. | `STATUS.md` sempre atualizado |
| **arquiteto-contratos** | Tipos, contratos REST, eventos Socket.IO, cenários do MSW, `ARCHITECTURE.md`. | Contratos congelados antes das telas |
| **implementador-catalogo** | Início, catálogo, detalhe, favoritos. | Slice passa no `verify` |
| **implementador-checkout** | Carrinho, cupom, pagamento, pedidos, confirmação. | Slice passa no `verify` |
| **implementador-conta** | Login, cadastro, sessão, perfil, avatar, senha, carteiras. | Slice passa no `verify` |
| **plataforma-mocks** | MSW, fixtures, persistência/reset, Socket.IO via MSW, falhas e latência configuráveis. | Todos os cenários determinísticos |
| **fidelidade-visual** | Compara Figma × tela renderizada em 390/768/1440; confere tokens (cores, tipografia, espaçamento). | Relatório de diffs com tolerância numérica |
| **qa-features** | Escreve e roda os 12 grupos de E2E, testa de forma exploratória, registra `BUGS.md`. | Specs verdes em desktop e mobile |
| **auditor-requisitos** | Matriz de rastreabilidade: cada requisito do README → evidência (teste, arquivo, print). Foco nos eliminatórios. | `docs/requirements-matrix.md` sem lacunas |
| **seguranca** | Isolamento de cache e eventos entre usuários, logout, senha (hash, nunca em claro), XSS, `npm audit`, headers, rotas protegidas. | Zero achados altos/críticos |
| **revisor-frontend-senior** | Tipagem estrita, query keys, cancelamento, race conditions, idempotência, cleanup de listeners, bundle, legibilidade. | `APPROVED` ou lista de mudanças |
| **a11y-performance** | axe, teclado, foco, Lighthouse (3 medições, mediana), LCP/CLS/TBT. | Metas atingidas ou justificadas |
| **release** | CI/scripts, deploy, README, checkout limpo, checklist final. | Build público == repositório |

Opcional: uma rodada final de revisão independente com outro modelo (ex.: Codex) para segunda opinião.

**Formato obrigatório dos relatórios** (`reports/<slice>/<agente>.md`): veredito (`APPROVED` | `CHANGES_REQUESTED` | `BLOCKED`), achados com severidade (crítica/alta/média/baixa), evidência reproduzível (comando, print, trace) e correção sugerida.

## 4. Gate único de qualidade

Crie `npm run verify`, que executa em sequência: typecheck → lint → build → Playwright (Chromium, desktop + mobile) → regressão visual → axe. **Nenhuma slice é integrada com `verify` vermelho.**

Definition of Done de uma slice:
- `verify` verde;
- relatório de fidelidade dentro da tolerância;
- zero achado de segurança alto/crítico;
- zero violação axe crítica/séria;
- revisor sênior `APPROVED`;
- requisitos da slice marcados com evidência na matriz.

## 5. Esteira (fases)

**Fase 0 — Spikes de risco (primeiras ~3h).** Provar, antes de qualquer tela:
1. MSW + `socket.io-client` funcionando no navegador **e** no Playwright (a parte mais arriscada do desafio);
2. Acesso ao Figma (conector MCP ou frames exportados em PNG para `design/ref/`) e extração de tokens;
3. Deploy "hello world" na Vercel com service worker do MSW ativo e fallback de rotas SPA (acesso direto e refresh).

**Fase 1 — Fundação.** Setup do projeto, tokens do Figma no Tailwind/shadcn, contratos e tipos, base do MSW (handlers, fixtures, persistência, reset), cliente Axios, QueryClient com política de cache documentada, roteamento com rotas protegidas, `verify`, CI.

**Fase 2 — Slices verticais em paralelo** (cada implementador em um git worktree próprio, merges pequenos e frequentes). Ciclo por slice: implementar → (fidelidade ‖ QA ‖ segurança) → revisor sênior → corrigir. **Máximo de 3 voltas**; se travar, registre em `ESCALATIONS.md` e siga com as outras slices sem bloquear.

**Fase 3 — Integração e resiliência.** Tempo real ponta a ponta, idempotência e timeout, sessão expirada em checkout, preço alterado durante compra, reconexão com pedido pendente, isolamento entre usuários.

**Fase 4 — Auditorias.** Lighthouse (3 medições, mediana), a11y completa, baselines de regressão visual, revisão final cruzada, fechamento da matriz de requisitos.

**Fase 5 — Release.** Deploy, `README.md`, `ARCHITECTURE.md`, teste de checkout limpo, checklist final.

## 6. Regras de autonomia

- O ciclo implementar → validar → corrigir roda sem eu intervir.
- Se uma slice travar após 3 voltas, escale para `ESCALATIONS.md` e continue o resto.
- Reporte somente via `STATUS.md` e `reports/`; eu leio quando quiser.
- Nunca declare "concluído" sem evidência executada (saída de comando, relatório, trace).
- Decisões relevantes e desvios do Figma vão para `ARCHITECTURE.md` na hora em que acontecem.
- Permissões restritas ao diretório do projeto; sem comandos destrutivos fora dele.

## 7. Cronograma-alvo (48h, com folga)

| Horas | Fase |
|---|---|
| 0–3 | Fase 0 (spikes) + setup |
| 3–20 | Fases 1–2 (fundação + slices em paralelo) |
| 20–32 | Fase 3 (integração, tempo real, E2E completos) |
| 32–40 | Fase 4 (auditorias e correções) |
| 40–46 | Fase 5 (deploy, docs, checkout limpo) |
| 46–48 | Buffer |

Se o prazo apertar, **priorize nesta ordem:** os 6 eliminatórios → compra completa com tempo real e idempotência → testes E2E → fidelidade visual → acessibilidade/performance → polimento. Registre em `ARCHITECTURE.md` o que ficou de fora e por quê.

## 8. Skills, plugins e conectores

- **Figma (MCP):** `claude mcp add --transport http figma https://mcp.figma.com/mcp --scope project`, depois autenticar via `/mcp`. Sem ele, use frames exportados em `design/ref/`.
- **Playwright MCP (opcional):** pode ajudar o QA a inspecionar a UI; escopo de projeto.
- **Skills:** pesquise com `npx skills find` (buscas sugeridas: `react best practices`, `web design guidelines`, `playwright`, `tanstack query`, `accessibility`, `security review`). Antes de instalar qualquer skill, leia o conteúdo e avalie a reputação da fonte; instale só as que forem claramente úteis e liste-as no plano com justificativa.
- **Plugins do catálogo que podem ser úteis (se existirem no seu ambiente):** `code-review` (revisão com múltiplos agentes) e um pacote de skills para engenheiros React.
- **Hooks:** configure ao menos um hook que rode typecheck/lint após edições e um que bloqueie comandos destrutivos.

## 9. Pontos técnicos que exigem atenção especial

- **Dinheiro:** ETH como string decimal; use biblioteca de decimais precisos para soma, desconto, taxa e total; testes de precisão.
- **Idempotência:** chave gerada no cliente por tentativa de compra; mocks retornam o mesmo pedido para a mesma chave e `409` para chave igual com corpo diferente.
- **Eventos:** `id`, `resource`, `version`; aplicar só se `version` > atual; deduplicar por `id`; reconciliar via REST ao reconectar; filtrar por sessão/usuário; cleanup no unmount e no logout.
- **Cache por usuário:** query keys incluem identidade/parâmetros; logout limpa cache privado e desmonta subscriptions.
- **Respostas fora de ordem:** use `AbortSignal` do TanStack Query e chaves por parâmetro; teste com latência variável.
- **Atualização otimista:** favoritos (com rollback em falha) é o candidato natural.
- **Fidelidade vs. regressão visual:** baselines do Playwright comparam a tela com ela mesma; a fidelidade ao Figma é uma verificação separada, com os frames de referência.
- **Lighthouse honesto:** sem remover imagens, fontes ou funcionalidades só para pontuar; justificar o que ficar abaixo.

## 10. Estrutura de arquivos sugerida (ajuste conforme a pesquisa)

```
.claude/agents/*.md        # subagentes
.claude/commands/run-pipeline.md
CLAUDE.md                  # regras do orquestrador + Definition of Done
BRIEFING.md                # este documento
PLANO.md                   # plano detalhado gerado na etapa 12
STATUS.md  ESCALATIONS.md  BUGS.md
docs/challenge.md  docs/figma.md  docs/requirements-matrix.md
design/ref/                # frames do Figma (se exportados)
reports/<slice>/<agente>.md
src/  mocks/  tests/e2e/  lighthouse/
ARCHITECTURE.md  README.md
```

## 11. O que NÃO fazer

- Não simular eventos chamando setters, callbacks ou o cache diretamente.
- Não colocar dados fictícios em componentes, hooks ou no cliente Axios.
- Não usar `number` para ETH.
- Não marcar requisito como atendido sem teste ou evidência.
- Não deixar o deploy para o final.
- Não consultar soluções de terceiros.

## 12. Instruções de execução (faça nesta ordem)

**Etapa A — Pesquisa (antes de escrever código).**
1. Baixe o README oficial para `docs/challenge.md` e leia o layout no Figma (ou os frames em `design/ref/`).
2. Consulte a documentação atual (versões estáveis) de: TanStack Router (search params tipados, rotas protegidas), TanStack Query (cancelamento, otimismo, persistência), MSW (browser e Node, `@mswjs/socket.io-binding`, limitações), Socket.IO client, Playwright (regressão visual, traces), shadcn/ui + Tailwind (versão atual), Lighthouse CI/CLI, e deploy de SPA com service worker na Vercel.
3. Consulte a documentação atual do Claude Code sobre subagentes, comandos customizados, hooks, permissões, worktrees e MCP, para que os arquivos que você gerar usem a sintaxe correta da versão instalada.
4. Pesquise skills e plugins úteis conforme a seção 8 e liste as candidatas com justificativa (não instale sem listar).

**Etapa B — Plano.** Gere `PLANO.md` com: decisões de stack e versões, estrutura de pastas, quebra detalhada das slices (tarefas, dependências, critérios de aceite por requisito), definição final dos agentes, detalhes do `verify`, riscos e plano de contingência, e cronograma. Gere também a primeira versão de `docs/requirements-matrix.md` (todos os requisitos do README, sem evidência ainda).

**Etapa C — Andaime.** Crie os arquivos de agentes, `CLAUDE.md`, `.claude/commands/run-pipeline.md`, o script `verify` e a configuração de hooks/permissões. Inicialize o git.

**Etapa D — Fase 0.** Execute os três spikes da seção 5 e registre os resultados em `STATUS.md`.

**Ponto de parada único:** ao terminar a Etapa D, apresente um resumo curto (plano, riscos encontrados nos spikes, skills sugeridas) e **aguarde meu "prossiga"**. Depois disso, execute as Fases 1 a 5 de forma autônoma, conforme as seções 5 e 6.
