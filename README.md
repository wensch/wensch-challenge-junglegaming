# KURIO — Marketplace de NFTs

Solução do desafio frontend "Marketplace de NFTs" ([enunciado](docs/challenge.md)): descoberta (catálogo, busca, filtros, detalhe), compra (carrinho, cotação, pagamento, recibo) e conta do colecionador (cadastro, login, perfil, carteiras, favoritos), em desktop e mobile. Não há backend: toda a API REST e o tempo real são simulados com MSW dentro do navegador.

- Produção: https://wensch-challenge-junglegaming.vercel.app
- Repositório: https://github.com/wensch/wensch-challenge-junglegaming

## Stack e papel de cada peça

| Tecnologia | Papel neste projeto |
| --- | --- |
| React 19 + TypeScript | Interface e tipagem de ponta a ponta; contratos zod geram os tipos usados por transporte, estado e UI |
| TanStack Router | Rotas (file-based), `validateSearch` dos filtros do catálogo na URL, guarda das rotas privadas (`_authed`) |
| TanStack Query | Consultas, mutations, cache por usuário (`['u', userId, ...]`), atualização otimista com rollback, retries |
| Axios | Único cliente HTTP (`src/api/client.ts`): headers, idempotência, normalização de erros em `ApiError`, cancelamento |
| Socket.IO client | Eventos `nft.updated` e `order.updated`; reconciliação com o REST após reconexão |
| Tailwind CSS 4 | Estilos e tokens do Figma em `@theme` (`src/index.css`) |
| shadcn/ui (Radix) | Componentes base em `src/components/ui`, adaptados à identidade visual |
| MSW 2 + `@mswjs/socket.io-binding` | Servidor simulado na camada de rede (REST e WebSocket), cenários e estado persistente |
| Playwright | Testes E2E (desktop e mobile), regressão visual e axe |
| Lighthouse | Auditoria de início e detalhe, mobile e desktop (`lighthouse/`) |

Também: react-hook-form + zod (formulários), decimal.js (ETH sempre como string decimal, ver `src/lib/money.ts`), sonner (avisos).

## Pré-requisitos e instalação

- Node.js >= 22.12 (`engines` em `package.json`) e npm.
- Chromium do Playwright, só para rodar os testes.

```bash
npm ci
npx playwright install chromium        # no Linux: npx playwright install --with-deps chromium
npm run dev                            # http://localhost:5173, com mocks
```

## Variáveis de ambiente

Veja [.env.example](.env.example). Todos os valores são fictícios e não há segredos. `.env.development` e `.env.production` já trazem os mesmos valores, então não é preciso criar `.env` para rodar.

| Variável | Valor padrão | Função |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST e Socket.IO). Ligada também no build de demonstração, porque não existe backend real |
| `VITE_API_URL` | `/api` | Base do REST; relativa, o service worker do MSW responde na mesma origem |
| `VITE_SOCKET_URL` | `wss://realtime.nft-mock.local` | Origem do Socket.IO simulado (sem `/socket.io/`, ver abaixo). Não é um servidor real |

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Vite em desenvolvimento, com mocks |
| `npm run build` | `tsc -b` e build de produção em `dist/` (com mocks) |
| `npm run preview` | Serve `dist/` em `http://localhost:4173` com os mesmos headers/CSP da Vercel |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint (inclui a regra que proíbe importar `src/mocks` fora dos mocks) |
| `npm run test:e2e` | Playwright completo (sobe `build` + `preview` sozinho) |
| `npm run test:visual` | Só testes `@visual` (regressão visual) |
| `npm run test:a11y` | Só testes `@a11y` (axe) |
| `npm run verify` | Portão único: typecheck, lint, build, E2E (desktop e mobile), visual e axe; grava `reports/verify-latest.md` |
| `npm run lighthouse` | Auditoria Lighthouse (`lighthouse/run.mjs`), veja [lighthouse/](lighthouse/) |

Smoke contra uma URL publicada (sem servidor local): `BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test`.

## Credenciais fictícias

Dados e credenciais existem somente em `src/mocks/` e são inventados.

| Usuário | E-mail | Senha | Observações |
| --- | --- | --- | --- |
| Alice (`usr_001`) | `alice@example.test` | `Senha@123` | 2 carteiras (principal e secundária), 3 favoritos, 2 pedidos confirmados |
| Bob (`usr_002`) | `bob@example.test` | `Senha@456` | 1 carteira, 1 pedido; serve para testar acesso a recurso alheio e isolamento de eventos |

Cupons: `WELCOME10` (10 %, válido), `LANCAMENTO` (0,05 ETH, válido), `BLACK2024` (expirado); qualquer outro código é inválido. Taxas de rede: Ethereum `0.0021`, Polygon `0.0003`, Solana `0.00005` ETH. Também é possível criar uma conta nova em `/register`.

## Cenários do mock: seleção e reset

Os cenários são determinísticos e combináveis. O catálogo tipado está em [`src/api/contracts/scenarios.ts`](src/api/contracts/scenarios.ts); detalhes da camada em [`src/mocks/README.md`](src/mocks/README.md).

- **Pela URL**: `/?scenario=latency.slow,payment.declined` (vale na carga e fica persistido em `localStorage["mock:scenarios"]`).
- **No console do navegador**: `window.__mock.setScenarios(['coupon.expired'])`; `window.__mock.getScenarios()` lista os ativos.
- **Reset**: `await window.__mock.reset()` restaura o seed completo (catálogo, usuários, carrinhos, pedidos) e o cenário `default`. `reset(['payment.declined'])` já seleciona um cenário. Para limpar tudo, apague também o armazenamento do site.
- Cenários `*.once` (`http.500.once`, `session.expire-on-checkout`, `order.timeout-after-create`, `checkout.*`) disparam uma vez; chame `setScenarios` de novo para rearmá-los.
- `window.__mock` também expõe `emit`, `updateNft`, `drop` e `settleOrder`, usados pelos testes para disparar eventos no servidor simulado (o frame sempre atravessa o `socket.io-client`).

## Como reproduzir cada falha

Faça login com Alice (ou Bob), adicione um NFT ao carrinho e siga o fluxo indicado. O que acontece em cada cenário (§6 do enunciado):

| Situação do §6 | Cenário | Como reproduzir e o que acontece |
| --- | --- | --- |
| Sucesso | `default` | Fluxo completo, latência fixa de 150 ms |
| Resultado vazio | `catalog.empty` | Abra `/`: estado vazio com ação de limpar filtros |
| Lentidão | `latency.slow` | Todas as respostas levam 2,5 s: skeletons com shimmer no catálogo, detalhe e carrinho, sem deslocamento de layout |
| Latência variável | `latency.variable` | Atraso de 100 a 1800 ms por requisição (determinístico) |
| Respostas fora de ordem | `catalog.out-of-order` | No catálogo, mude filtros em sequência: a 1ª resposta chega depois, mas só o resultado da URL atual aparece |
| Sem conexão | `network.offline` | Requisições falham como erro de rede, o socket cai; mensagem de erro com "Tentar novamente". Volte a `default` e tente de novo |
| Timeout | `network.timeout` | Requisições não respondem; o Axios aborta em 10 s e oferece nova tentativa |
| HTTP 5xx | `http.500.once` / `http.503` | A próxima requisição dá 500 e o retry recupera / catálogo e detalhe em 503 até sair do cenário |
| Favorito falha (rollback) | `favorites.fail` | Favoritar um NFT: o coração muda e volta, com aviso `aria-live` |
| Sessão expirada | `session.expired` | Qualquer chamada privada dá 401; vai ao login com `reason=expired` e retorno à rota original |
| Sessão expira no checkout | `session.expire-on-checkout` | Ao enviar o pedido a sessão expira (nenhum pedido criado); após novo login o checkout é retomado com os dados preservados |
| Acesso não autorizado | `auth.forbidden` | Abrir `/orders/ord_0003` como Alice (pedido do Bob): acesso negado, sem dados do outro usuário |
| Conflito de cadastro | `register.email-taken` | `/register` com qualquer e-mail: 409 no campo e-mail (sem o cenário, `alice@example.test` já conflita) |
| Validação do servidor | `forms.server-validation` | Salvar perfil, senha ou carteira: mensagens da API nos campos, dados digitados preservados |
| Cupom inválido / expirado | `coupon.invalid` / `coupon.expired` | No carrinho, aplique um cupom: mensagem específica e resumo inalterado (use `BLACK2024` para o expirado sem cenário) |
| Preço alterado na compra | `checkout.price-changed` | Abra o pagamento: o preço sobe após a 1ª cotação, `nft.updated` chega, o resumo muda e a revisão exige nova confirmação (`QUOTE_STALE`) |
| Edição esgotada na compra | `checkout.sold-out` | Idem: a edição esgota, o envio responde `CONFLICT_AVAILABILITY`, itens preservados |
| Timeout após criar o pedido | `order.timeout-after-create` | Confirmar compra: o pedido é criado mas a resposta não chega; o reenvio com a mesma `Idempotency-Key` recupera o mesmo pedido, sem duplicar |
| Pagamento confirmado / recusado | `payment.confirmed` (padrão) / `payment.declined` | O pedido nasce pendente e vira confirmado (recibo) ou recusado (motivo, carrinho intacto) após 1,5 s por `order.updated` |
| Pedido pendente com queda de conexão | `payment.hold` | O pedido fica pendente. No console: `window.__mock.drop()` derruba o socket, recarregue a página e depois `window.__mock.settleOrder('<id>', 'confirmed')`; o estado é recuperado sem nova compra |
| Carteira recusa conexão | `wallet.reject` | Conectar carteira no pagamento: recusa; envio bloqueado |

Atualização em tempo real manual (cenário do §7): com um item no carrinho aberto, rode no console `window.__mock.updateNft('nft_001', { price: '9.5' })` (use um id presente no carrinho): o resumo e o aviso `aria-live` atualizam e o checkout recusa a cotação antiga.

## Tempo real simulado

O servidor Socket.IO é simulado pelo MSW (`ws.link` + `@mswjs/socket.io-binding` 0.2.0, com `msw` fixado em 2.15.0) no contexto da página, e o cliente é o `socket.io-client` real conectado com `transports: ['websocket']`. Mudanças no estado do mock (`mutateNft`, `mutateOrder`) emitem o evento correspondente, então REST e eventos nunca divergem. Limitações do ambiente (detalhes em [ARCHITECTURE §11](ARCHITECTURE.md#11-transporte-de-tempo-real-e-limitações-spike-1)):

- Só namespace padrão, eventos de texto, sem acks e sem binário; por isso não há fallback de long-polling.
- O binding não envia ping; o mock envia o heartbeat a cada 20 s, senão o cliente cai em cerca de 30 s.
- O binding ignora o payload do CONNECT; o mock lê o `auth.token` do frame bruto para entregar `order.updated` só ao dono.
- "Offline" do socket é simulado pelo mock (fecha e recusa conexões), não por queda real de rede.
- O service worker do MSW exige HTTPS ou localhost; na primeira visita ele é registrado e a página pode recarregar uma vez.

## Testes

```bash
npm run test:e2e        # tudo (desktop e mobile, Chromium)
npx playwright test tests/e2e/06-compra.spec.ts   # um arquivo
npx playwright show-report                        # relatório HTML
```

- Os testes ficam em `tests/e2e`, partem de estado isolado (storage por teste, `window.__mock.reset`) e disparam eventos só por `window.__mock`. Projetos: `desktop` (1440x900), `mobile` (390x844) e `*-harness` (só a suíte da camada de mocks).
- O relatório HTML fica em `playwright-report/` (por etapa do `verify`, em `playwright-report/<etapa>`). Traces e capturas de falhas ficam em `test-results/` (`trace: 'retain-on-failure'`); abra com `npx playwright show-trace <arquivo>.zip`. No CI, ambos são publicados como artefatos (`playwright-report` e `test-results`).
- O resultado do último `verify` fica em [reports/verify-latest.md](reports/verify-latest.md).
- **Regressão visual**: testes `@visual` (início, detalhe, carrinho, pagamento, conta). Baselines por plataforma em `tests/__screenshots__/win32` e `tests/__screenshots__/linux`. No CI o Playwright usa `updateSnapshots: 'none'`: baseline ausente ou diferente reprova. As baselines Linux são geradas pelo workflow manual `visual-baselines` (`workflow_dispatch`, [.github/workflows/visual-baselines.yml](.github/workflows/visual-baselines.yml)), baixadas como artefato `visual-baselines-linux`, revisadas e commitadas. Para atualizar localmente: `npx playwright test --grep @visual --update-snapshots=all`.
- **CI** ([.github/workflows/verify.yml](.github/workflows/verify.yml)): `npm ci`, `npx playwright install --with-deps chromium`, `npm run verify`.

## Estrutura

```
src/
  api/contracts/   contratos zod (REST, erros, eventos, cenários) compartilhados por app e mocks
  api/             cliente Axios e endpoints tipados
  routes/          rotas TanStack Router (file-based)
  features/        telas e fluxos (catálogo, conta, checkout)
  queries/         query keys, queryOptions e mutations (TanStack Query)
  realtime/        socket.io-client, validação e reconciliação com o cache
  session/         sessão, rascunhos por usuário, teardown
  components/      layout e shadcn/ui
  lib/             utilitários (money.ts com decimal.js)
  mocks/           ÚNICO lugar com dados fictícios: MSW, banco em memória, cenários, window.__mock
tests/e2e/         Playwright (E2E, visual, axe)
lighthouse/        configuração e relatórios da auditoria
design/            referências do Figma (ref/ PNGs, assets/ artes, figma-meta.xml com posições e tamanhos)
public/            fontes, imagens de NFT, mockServiceWorker.js
```

### Artefatos do processo de desenvolvimento

O projeto foi conduzido com um fluxo de agentes de IA (veja [Uso de IA](#uso-de-ia)), e os registros desse fluxo ficam versionados, fora do caminho do código do produto:

| Onde | O que é |
|---|---|
| `docs/processo/` | `BRIEFING.md` (escopo e regras de condução), `PLANO.md` (decisões de stack, slices e riscos), `STATUS.md` (estado e evidências por etapa), `ESCALATIONS.md` (bloqueios; vazio) e `spike/` (experimentos descartáveis da fase 0) |
| `reports/` | Relatórios de cada revisão (fidelidade visual, QA, segurança, revisor sênior, auditoria de requisitos) e a análise final em `reports/analise-final/` |
| `BUGS.md` | Defeitos encontrados pelos testes e sua resolução |
| `CLAUDE.md`, `.claude/` | Regras do orquestrador, definições dos agentes e skills usadas (necessários para reproduzir o fluxo; o produto não depende deles) |
| `docs/requirements-matrix.md` | Cada requisito do enunciado ligado à evidência executada |

Nada disso entra no build: o Vite só empacota `src/` e `public/`, e o bundle de produção não contém referência a esses arquivos.

Documentos: [ARCHITECTURE.md](ARCHITECTURE.md) (contratos, sessão, carrinho, cache, reconciliação, UX e desvios do Figma) · [docs/requirements-matrix.md](docs/requirements-matrix.md) (requisito a requisito, com evidência) · [lighthouse/](lighthouse/) (auditoria) · [BUGS.md](BUGS.md) (achados de QA) · [src/mocks/README.md](src/mocks/README.md) · [docs/figma.md](docs/figma.md).

## Resultados do Lighthouse

Medianas de 3 execuções por página e perfil, build de produção com os mocks ativos (`npm run lighthouse`; relatórios HTML/JSON, ambiente e diagnóstico em [lighthouse/](lighthouse/)):

| Página | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 78 | 100 | 100 | 100 | 5,0 s | 0 | 204 ms |
| Detalhe | mobile | 79 | 100 | 100 | 100 | 4,9 s | 0 | 201 ms |
| Início | desktop | 98 | 100 | 100 | 100 | 1,1 s | 0 | 0 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 1,0 s | 0 | 0 ms |


A Performance mobile ficou em 78 e 79 (era 68 e 68; meta 90, ainda não atingida). Otimizações desta rodada: imagens WebP com `srcset` (hero 240/480/900 px em vez de 1350 px), `vendor` agrupado (menos requisições) e cache imutável de `/nft` e `/fonts`. O LCP observado é de ~0,8 s; a nota usa o LCP simulado (1,6 Mbps, CPU 4× mais lenta), dominado pelos bytes e pela execução do MSW (176 KB gz) e do app. Detalhes e o que ainda falta em [lighthouse/README.md](lighthouse/README.md#resultado-final-e-justificativa-lh-2).
## Limitações conhecidas e desvios do Figma

- Backend, pagamento e carteiras são simulados; senhas do mock usam SHA-256 com salt (um backend real usaria um KDF lento) e o token de sessão fica em `localStorage` (real: cookie `HttpOnly`). Ver ARCHITECTURE §4.
- Avatares `https:` são aceitos pelo contrato, mas a CSP só renderiza `data:` e mesma origem (ARCHITECTURE §4, R7).
- Não há frames de tablet, rodapé mobile, perfil/carteiras mobile nem busca desktop no Figma; o layout nesses casos é derivado. Páginas editoriais, suporte, atividade, ofertas e downloads levam a `/em-breve` e não simulam sucesso.
- A página `/favorites` (Lista de interesse) existe e funciona: lista os favoritos do usuário autenticado, remove com atualização otimista e rollback em falha, atualiza preço e disponibilidade em tempo real e mostra estados de carregamento, vazio e erro (D40). Não há quadro dela no Figma.
- Login e cadastro são rotas (o Figma mostra modais); a confirmação do pedido também é rota. O ícone "thank you" não foi exportado e foi redesenhado em SVG.
- Tabela completa dos desvios (D1 a D22, D30 a D32 e D40 a D44) em [ARCHITECTURE §13](ARCHITECTURE.md#13-desvios-do-figma).
- Imagens de NFT, Hero e ícones vêm do arquivo Figma do desafio (cópia de trabalho); são usadas apenas como dados fictícios de demonstração. A arte do Hero em 3x foi exportada do mesmo Figma e servida em WebP. Fonte Roboto Mono sob licença OFL.
- A página 1 do catálogo reproduz o Figma (ordem, nomes, preços); as contagens da barra lateral vêm dos dados reais (36 itens, 4 páginas) e por isso diferem dos números desenhados no Figma (ARCHITECTURE §13, D43).
- Parcial na matriz: medição da Confirmação e do checkout em 768 px (tablet fica como está); Performance mobile do Lighthouse justificada (ver Resultados do Lighthouse).
- Pendências e partes ainda não comprovadas por evidência: veja a coluna de status em [docs/requirements-matrix.md](docs/requirements-matrix.md).

## Uso de IA

Este projeto foi desenvolvido com assistência de IA. O Claude Code (Anthropic) atuou como orquestrador de subagentes especializados: contratos e arquitetura, camada de mocks, implementadores por fatia (catálogo, conta, checkout), QA, segurança, fidelidade visual, revisão sênior e auditoria de requisitos. Os agentes escreveram a maior parte do código, dos testes e da documentação; as decisões de escopo e de arquitetura, a revisão do resultado e a propriedade do repositório são do autor, e cada commit está em seu nome. O que foi validado por execução: `npm run verify` (typecheck, lint, build, E2E em desktop e mobile, regressão visual e axe, com o resultado em [reports/verify-latest.md](reports/verify-latest.md)), o CI no GitHub Actions e os relatórios dos agentes em `reports/`. O que não é prova de correção: um relatório de agente sozinho; por isso itens parciais ou pendentes continuam listados na matriz de requisitos. Os dados e as credenciais do projeto são todos fictícios.
