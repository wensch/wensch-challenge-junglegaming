# Matriz de requisitos

Fonte: [challenge.md](challenge.md) (seção entre parênteses). Status: `—` pendente · `parcial` · `OK` (só com evidência executada).
Evidência = spec Playwright, arquivo, relatório ou print. Mantida pelo agente **auditor-requisitos**.

## Eliminatórios (§11)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| ELIM-1 | Uso efetivo de toda a stack obrigatória (§2) | — | |
| ELIM-2 | Fluxos principais funcionais (não apenas visuais) | — | |
| ELIM-3 | Compra confirmada apenas com resposta da simulação | — | |
| ELIM-4 | Sem exposição de dados entre usuários | — | |
| ELIM-5 | Eventos passam por `socket.io-client` (nunca direto na UI) | parcial | spike: tests/e2e/00-spike.spec.ts |
| ELIM-6 | Testes E2E executáveis | parcial | spike: tests/e2e/00-spike.spec.ts |

## Stack (§2)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| STK-1 | React + TypeScript | — | |
| STK-2 | TanStack Router em rotas, search params e proteção de fluxos privados (§4) | — | |
| STK-3 | TanStack Query em consultas, mutations e sincronização de cache (§4) | — | |
| STK-4 | Todas as chamadas REST via Axios (§4) | — | |
| STK-5 | Socket.IO em tempo real | parcial | spike |
| STK-6 | Tailwind CSS + shadcn/ui adaptado à identidade (§8) | — | |
| STK-7 | MSW para REST e eventos | parcial | spike |
| STK-8 | Playwright E2E + regressão visual | — | |
| STK-9 | Lighthouse | — | |

## Telas (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| TEL-1 | Início: destaques, catálogo, busca, filtros, ordenação, navegação ao NFT | — | |
| TEL-2 | Detalhe: galeria, informações, edição, quantidade, favoritos, compra | — | |
| TEL-3 | Carrinho: quantidades, remoção, cupom, resumo de valores | — | |
| TEL-4 | Pagamento: dados do colecionador, carteira e rede, revisão, envio | — | |
| TEL-5 | Confirmação: resultado, id da transação, itens, taxas, total | — | |
| TEL-6 | Login: autenticação, validação, retorno ao fluxo anterior | — | |
| TEL-7 | Cadastro: criação, validação, tratamento de conflito | — | |
| TEL-8 | Perfil: dados, avatar, alteração de senha | — | |
| TEL-9 | Carteiras: principal e secundária, cadastro e edição | — | |
| TEL-10 | Frames desktop e mobile; perfil/carteiras/confirmação funcionais em mobile | — | |
| TEL-11 | Fora de escopo (editorial, suporte, atividade, ofertas, downloads) não aparenta sucesso; links externos coerentes | — | |
| TEL-12 | Estados não desenhados seguem o padrão visual | — | |

## Catálogo e detalhe (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAT-1 | Busca, filtros, ordenação e paginação na URL; sobrevivem a refresh e histórico | — | |
| CAT-2 | Filtros combináveis; mudança de filtro reinicia paginação | — | |
| CAT-3 | Consultas refletem parâmetros enviados à API | — | |
| CAT-4 | Resultado vazio, falha e respostas fora de ordem tratados | — | |
| DET-1 | Acesso direto ao detalhe | — | |
| DET-2 | NFT inexistente | — | |
| DET-3 | Edição indisponível | — | |
| DET-4 | Limite de quantidade | — | |
| FAV-1 | Favoritos persistem para o usuário autenticado | — | |

## Carrinho (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CAR-1 | Adicionar, alterar e remover respeitando disponibilidade por NFT/edição | — | |
| CAR-2 | Persistência após refresh | — | |
| CAR-3 | Itens do visitante preservados ao autenticar | — | |
| CAR-4 | Aplicar/remover cupom; inválido e expirado tratados | — | |
| CAR-5 | Subtotal, desconto, taxa de rede e total coerentes com a API | — | |
| CAR-6 | Reflete preço/disponibilidade recebidos com carrinho aberto | — | |
| MON-1 | ETH como string decimal com precisão em cálculo e apresentação; quantidades inteiras | — | |
| MON-2 | Cotação da API é a referência para finalizar | — | |

## Pagamento e confirmação (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| PAG-1 | Validação dos campos do layout e revisão antes do envio | — | |
| PAG-2 | Carteiras cadastradas, seleção de rede, simulação de conexão/recusa/desconexão | — | |
| PAG-3 | Revalidar preço, disponibilidade, cupom e taxas antes de confirmar; mudança exige nova confirmação | — | |
| PAG-4 | Sem pedido duplicado em clique repetido ou reenvio após timeout | — | |
| PAG-5 | Estados pendente/confirmado/recusado com recuperação após refresh ou reconexão | — | |
| PAG-6 | Confirmação exibida só para pedido confirmado na simulação | — | |
| PAG-7 | Itens preservados em falha; após confirmação remove só itens/quantidades comprados | — | |
| PAG-8 | Recibo reproduz snapshot; mudanças no catálogo não alteram; referências/links simulados | — | |

## Conta e sessão (§3)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| CON-1 | Cadastro, login, logout e sessão integrados à API simulada | — | |
| CON-2 | Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação | — | |
| CON-3 | Sessão recuperável após refresh | — | |
| CON-4 | Expiração durante navegação e checkout, preservando contexto para retomada | — | |
| CON-5 | Logout/troca de usuário limpa cache privado e subscriptions | — | |
| CON-6 | Validação de cadastro, perfil, senha e carteiras, incluindo erros da API | — | |
| CON-7 | Alterações confirmadas permanecem após refresh | — | |
| CON-8 | Credenciais fictícias; senhas nunca em claro | — | |

## Integração e estado (§4)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| INT-1 | Contratos tipados transporte → estado → interface | — | |
| INT-2 | Estados loading, vazio, erro, sucesso, atualização em segundo plano | — | |
| INT-3 | Invalidação coerente após mutations e eventos | — | |
| INT-4 | Cancelamento/descarte de respostas obsoletas | — | |
| INT-5 | Isolamento por usuário e por parâmetros | — | |
| INT-6 | Recuperação de falhas sem duplicar operações | — | |
| INT-7 | Rotas inexistentes e acesso direto a qualquer tela | — | |
| INT-8 | Atualização otimista com rollback (≥1) | — | |
| INT-9 | Política de cache, retries e sincronização documentada | — | |

## Contratos REST (§5)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| API-1 | Sessão/conta: cadastro, login, sessão, logout, expiração | — | |
| API-2 | NFTs: listagem com busca/filtros/ordenação/paginação; detalhe | — | |
| API-3 | Favoritos: consulta, inclusão, remoção | — | |
| API-4 | Carrinho: consulta, inclusão, alteração, remoção | — | |
| API-5 | Cotação: cupom, disponibilidade, descontos, taxas, total | — | |
| API-6 | Pedidos: criação idempotente; consulta de estado e recibo | — | |
| API-7 | Perfil: consulta, dados/avatar, senha | — | |
| API-8 | Carteiras: consulta, cadastro, atualização | — | |
| API-9 | Erros: validação, sessão inválida, sem permissão, inexistente, conflito de disponibilidade, falha transitória | — | |
| API-10 | Idempotency key: mesma tentativa → mesmo pedido; mesma chave com conteúdo diferente → conflito | — | |
| API-11 | Contratos documentados | — | |

## Mocking (§6)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| MSW-1 | Mocks na camada de rede, reusados em dev, demo e testes | parcial | spike |
| MSW-2 | Nenhuma resposta fictícia em componentes, hooks ou Axios | — | |
| MSW-3 | Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras, pedidos | — | |
| MSW-4 | Persistência local + reset para cenário conhecido | — | |
| MSW-5 | Lentidão, latência variável, timeouts, sem conexão, HTTP de erro — configuráveis e reproduzíveis | — | |
| MSW-6 | Fixtures variadas para filtros/paginação; ≥2 usuários | — | |
| MSW-7 | Cenário: sucesso e vazio | — | |
| MSW-8 | Cenário: latência variável e fora de ordem | — | |
| MSW-9 | Cenário: falha de conexão e 4xx/5xx | — | |
| MSW-10 | Cenário: sessão expirada e não autorizado | — | |
| MSW-11 | Cenário: conflito de cadastro / validação | — | |
| MSW-12 | Cenário: cupom inválido / expirado | — | |
| MSW-13 | Cenário: preço alterado / edição esgotada durante compra | — | |
| MSW-14 | Cenário: timeout após criação do pedido com recuperação idempotente | — | |
| MSW-15 | Cenário: pagamento confirmado e recusado | — | |
| MSW-16 | Eventos via MSW com binding Socket.IO; transporte e limitações documentados | parcial | spike |
| MSW-17 | Ativado por configuração e disponível no build de demonstração | parcial | spike (VITE_ENABLE_MOCKS) |
| MSW-18 | Mudanças nos dados refletem em REST e eventos correspondentes | — | |

## Tempo real (§7)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| RT-1 | `nft.updated` atualiza preço/disponibilidade em catálogo, detalhe e carrinho | — | |
| RT-2 | `order.updated` atualiza pedido e apresenta confirmação/recusa | — | |
| RT-3 | Eventos com id estável, recurso afetado e versão | — | |
| RT-4 | Tolerar duplicatas e eventos antigos sem regredir nem reaplicar efeitos | — | |
| RT-5 | Reconciliação com REST após reconexão | — | |
| RT-6 | Eventos de sessão anterior não afetam outro usuário | parcial | spike (filtro por token) |
| RT-7 | Listeners/subscriptions liberados no fim do ciclo de vida | — | |
| RT-8 | Cenário: NFT no carrinho muda → UI informa e atualiza resumo → checkout bloqueia cotação desatualizada | — | |
| RT-9 | Queda de conexão com pedido pendente → recupera sem nova compra; confirmado/recusado terminais | — | |

## Interface e acessibilidade (§8)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| UI-1 | Fidelidade: tipografia, cores, espaçamentos, hierarquia, imagens, proporções | — | |
| UI-2 | Desktop/tablet/mobile; avaliado em 390, 768, 1440 | — | |
| UI-3 | Skeletons com shimmer (catálogo, detalhe, resumo do carrinho), sem CLS, respeitando reduced motion | — | |
| A11Y-1 | Navegação por teclado e foco visível | — | |
| A11Y-2 | Controle de foco em diálogos e drawers | — | |
| A11Y-3 | Semântica, labels e erros associados | — | |
| A11Y-4 | Alternativas textuais | — | |
| A11Y-5 | Contraste e estados não dependentes só de cor | — | |
| A11Y-6 | Feedback acessível de mutations e tempo real | — | |
| A11Y-7 | Sem overflow horizontal e sem perda com zoom | — | |
| UI-4 | Assets do arquivo usados; substituições e ajustes de a11y documentados | — | |

## Testes (§9)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| E2E-01 | Busca, filtros combinados, ordenação, paginação, histórico | — | |
| E2E-02 | Acesso direto ao detalhe e inexistente | — | |
| E2E-03 | Cadastro, login, expiração, logout, troca de usuário | — | |
| E2E-04 | Favoritos com falha e recuperação | — | |
| E2E-05 | Carrinho, quantidades, remoção, cupom, persistência refresh/login | — | |
| E2E-06 | Compra completa até recibo | — | |
| E2E-07 | Falha de pagamento, clique repetido, timeout com mesmo pedido | — | |
| E2E-08 | Perfil, avatar, senha, carteiras com erros | — | |
| E2E-09 | Preço/disponibilidade via Socket.IO no checkout | — | |
| E2E-10 | Duplicados/antigos, desconexão, pedido pendente | — | |
| E2E-11 | Teclado, foco de diálogos, validação | — | |
| E2E-12 | Skeletons em lentidão, falha e retry | — | |
| E2E-13 | Chromium desktop + mobile | parcial | playwright.config.ts |
| E2E-14 | Regressão visual: início, detalhe, carrinho, pagamento; baselines versionadas | — | |
| E2E-15 | Estado isolado; controle de relógio, latência e eventos | parcial | spike (page.clock) |
| E2E-16 | Relatório HTML e traces de falha | parcial | playwright.config.ts |

## Performance (§10)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| LH-1 | Início e detalhe, mobile e desktop, build otimizado, cenário padrão | — | |
| LH-2 | Perf ≥90, A11y ≥95, BP ≥95, SEO ≥90 (ou justificado) | — | |
| LH-3 | 3 medições, mediana; LCP, CLS, TBT | — | |
| LH-4 | Config, relatórios HTML/JSON, versões, ambiente versionados | — | |
| LH-5 | Sem simplificações exclusivas para a nota | — | |

## Entrega (§12)

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| DEL-1 | Código, lockfile, assets, mocks, fixtures, testes, configs de auditoria | — | |
| DEL-2 | Deploy público == código; mocks e tempo real funcionando | — | |
| DEL-3 | Acesso direto e refresh no ambiente publicado | parcial | spike local (vite preview) |
| DEL-4 | README: setup, env, credenciais, cenários/reset, comandos, reprodução de falhas | — | |
| DEL-5 | ARCHITECTURE: contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios Figma | — | |
| DEL-6 | Comandos: dev c/ mocks, build, preview, typecheck, lint, Playwright, Lighthouse | parcial | package.json |
| DEL-7 | Executa de checkout limpo sem serviços privados | — | |
| DEL-8 | README declara uso de IA | — | |
