# qa-features — fundacao (volta 2) — 2026-11-03
Veredito: APPROVED

Alvo: `main` @ 2ad75fc, preview em http://localhost:4173 (sem build/verify). Playwright com `BASE_URL`.

## Suíte completa (4 projetos), 228 testes, 214 passed, 14 skipped, 0 failed
Execução 1 (antes do spec novo, 198 testes): desktop 56 passed/3 skipped; mobile 48/11; desktop-harness 40/0; mobile-harness 40/0. Execução final com `tests/e2e/qa-volta2.spec.ts` (+30): 214 passed. Skips são por viewport (`test.skip(isMobile)` ou desktop-only), conforme desenho.

## Reteste de BUGS.md
QA-001 a QA-006 todos FECHADOS com evidência (ver `BUGS.md`): redirect com controles, `/.//evil.com`, `/..//evil.com`, `/%2e//evil.com` descartados; primeiro Tab no skip link; 409 CONFLICT_VERSION em profile e wallets; `endpoints.ts` v1.2.0 declara NOT_FOUND/VALIDATION/CONFLICT_VERSION e o runtime coincide; `/em-breve` foca o h1 na navegação client-side.

## Flake `latency.variable`
`--repeat-each=10` (20 execuções, 6 workers): 20/20; stress 16 workers x15: 30/30. Não reproduzido; margem do teste frágil (150 ms sobre tempo medido). BUG-QA-007 (baixa).

## Exploratório
- Sessão entre abas (logout e troca de usuário): `20-session-tabs.spec.ts` verde, desktop e mobile (cache `['u',...]` vazio, sem token/e-mail, socket guest, guard redireciona).
- Cancelamento/refresh: logout com GETs privados lentos em voo (`latency.slow`) + reload: sem dados da Alice, `kurio.session` nulo, socket guest.
- CSP: 12 rotas (inclui 404) como visitante e logado, nenhuma `securitypolicyviolation`, nenhum erro de console/pageerror.
- Header 768/800/820/850/900/1024/1100/1199/1200/1280/1440 sem sobreposição nem scroll horizontal (`92-header-tablet.spec.ts`).
- Lazy: Sheet e AccountDropdown abrem com foco dentro e Esc devolve o foco ao gatilho. Achado menor: BUG-QA-008.
- Contrato x mock: `httpsUrlSchema`/`avatarUrlSchema` rejeitam http:, SVG, javascript:, data:text/html, `//host`, blob:; seeds (NFTs, usuários, perfil, pedidos, carteiras) sem `http:` nem SVG; 3 URLs explorer/avatar no seed, todas https; upload PNG devolve `data:image/png`, SVG/GIF/HTML rejeitados com 422.

## Achados
| # | Severidade (crítica/alta/média/baixa) | Descrição | Evidência (comando/print/trace) | Correção sugerida |
|---|---|---|---|---|
| 1 | baixa | BUG-QA-007: `latency.variable` com margem de 150 ms frágil sob carga; não reproduzido | `--repeat-each=10` 20/20, stress 30/30 | Comparar atraso nominal ou tolerância proporcional |
| 2 | baixa | BUG-QA-008: chunk AccountDropdown baixado no mobile onde não é exibido | `qa-volta2.spec.ts` (lazy), log de requests | Montar o dropdown só a partir de md (opcional) |

Nenhum achado alto ou crítico. Specs novas: `tests/e2e/qa-volta2.spec.ts`.
