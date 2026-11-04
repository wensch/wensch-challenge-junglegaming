# seguranca — s-integrada (S2 conta + S3 checkout, main 421d481) — 2026-11-04
Veredito: APPROVED

Escopo: `git diff 3557ac2..421d481 -- src` e specs novos. Rodei contra o preview que já estava no ar (http://localhost:4173), sem build.

## Evidência executada
```
BASE_URL=http://localhost:4173 npx playwright test -c reports/s-integrada/seguranca-evidence/playwright.security.config.ts
  ok [desktop] S2+S3: troca de usuario pela UI nao deixa dados de alice (cache, DOM, storage, socket); idempotencia; senha
  ok [desktop] troca de senha revoga as outras sessoes; avatar recusa SVG e > 2 MB
  ok [mobile]  (os mesmos 2)
  4 passed (41.6s)
npm audit --omit=dev            -> found 0 vulnerabilities
grep de segredos no diff        -> só credenciais fictícias de teste (USERS.alice/bob, 'errada123', 'NovaSenha@1'); nenhum .env/.pem/.key
grep dangerouslySetInnerHTML|innerHTML|console.log em src (fora de src/mocks) -> 0
curl -sI http://localhost:4173/ -> CSP de vercel.json servida (img-src 'self' data: blob:; script-src 'self'; frame-ancestors 'none')
```
Spec: `reports/s-integrada/seguranca-evidence/s2s3.sec.spec.ts`. Ela verifica o seguinte:
1. **Compra real de alice pela UI.** A observação do colecionador leva o payload XSS `<img onerror>` e `<script>`, e `window.__xss` continua `undefined`. O recibo só aparece depois do `confirmed`.
2. **Idempotência.** Repeti o POST capturado com o mesmo `Idempotency-Key` e o mesmo corpo, e veio 200 com o mesmo `ord_*`. Com a mesma chave e um corpo diferente, veio 409 `IDEMPOTENCY_CONFLICT`. A chave não aparece em nenhuma URL.
3. **Rascunho com PII.** O rascunho `kurio.u.<alice>.checkout` (com `RASCUNHO_ALICE_2`) é gravado. Perfil e carteiras de alice entram no cache.
4. **Logout pela UI** (no desktop pelo dropdown, no mobile pelo sheet):
   - `realtime-probe` volta a `data-user=guest`, ou seja, o socket fica sem usuário;
   - não sobra nenhuma query `['u',…]`;
   - não sobra nenhuma chave `kurio.u.*` em `sessionStorage`;
   - `kurio.session` some.
5. **Login de bob pela UI.** Em `/checkout`, `/profile`, `/wallets` e `/cart`, nem o DOM (incluindo os `value` dos inputs) nem o cache nem o `sessionStorage` contêm a nota, o rascunho, o e-mail, o endereço, a carteira, o pedido ou o id de alice.
6. **Recursos de alice acessados por bob.** `/orders/<pedido de alice>` mostra "Pedido indisponível", sem recibo e sem dados. Com o token de bob, `GET /orders/<id>`, `PATCH /wallets/<carteira de alice>`, `POST …/connect` e o replay do POST de alice com a chave dela respondem 403/404/422, sem dados de alice no corpo.
7. **`order.updated` de alice difundido a todos.** O cache de bob não recebe nada (nem `declined` nem dados de alice).
8. **Senhas.** As de alice e bob não aparecem em `localStorage`/`sessionStorage` (incluindo o DB do mock, que guarda `passwordHash`), em nenhuma URL requisitada nem no console. Os tokens também não aparecem em URLs.
9. **Troca de senha.** Responde 204 sem corpo com a senha, a outra sessão do mesmo usuário passa a receber 401 e a sessão atual continua 200.
10. **Avatar.** `image/svg+xml`, `text/html` e PNG acima de 2 MB são recusados com 422. Um PNG válido vira `data:image/png;base64,…`.

Também conferi no código:
- `teardownSession` segue a ordem socket → cancel → remove `['u']` → token → rascunhos (`src/queries/session.ts:96-123`).
- `establishSession` chama `clearUserDrafts(newId)` quando um usuário diferente entra.
- Os rascunhos e as tentativas são validados por zod na leitura (`draft.ts`, `attempt.ts`).
- `explorerUrl` passa por `httpsUrlSchema` (só https e domínio) e o link usa `rel="noopener noreferrer"`.
- O `href` de compartilhamento usa `encodeURIComponent`.
- `/login` e `/register` usam `authSearchSchema` (`safeRedirectSchema`). `FavoriteButton` e `bootstrap` passam pelo mesmo `validateSearch`.
- `avatarUrlSchema` recusa SVG e qualquer `data:` que não seja png/jpeg/webp.

## Achados
| # | Severidade (crítica/alta/média/baixa) | Descrição | Evidência (comando/print/trace) | Correção sugerida |
|---|---|---|---|---|
| 1 | baixa | O teste "pedido de outro usuário" de `06-compra` usa `ord_9999`, um id que não existe. Ele cobre só o 404 e não cobre o pedido real de outro usuário (403). | `tests/e2e/06-compra.spec.ts:113-119`. O caso real está coberto pela minha spec (passo 6). | Criar o pedido como alice, entrar como bob e abrir o id real (ver `s2s3.sec.spec.ts`, passo 6). |
| 2 | baixa | `getOrder` diferencia 404 (não existe) de 403 (existe, mas é de outro usuário). Como os ids são sequenciais (`ord_0004`), dá para enumerar pedidos existentes. A UI mostra a mesma tela nos dois casos. | `src/mocks/handlers/orders.ts:91-92` | No mock, responder 404 também para pedido alheio, ou documentar a decisão em `ARCHITECTURE.md`. |
| 3 | baixa | `avatarUrlSchema` aceita `https:`, mas a CSP tem `img-src 'self' data: blob:`. Um avatar https seria bloqueado, o que é seguro mas incoerente com o contrato. | `src/api/contracts/common.ts:112-119` e `vercel.json:27` | Restringir o schema a `data:` e caminho same-origin, ou documentar que avatar externo não é suportado. |
| 4 | baixa | O upload de avatar confia no `File.type` declarado, sem conferir os magic bytes. Não dá para explorar, porque o resultado é servido como `data:image/png\|jpeg\|webp` e renderizado em `<img>`. | `src/mocks/handlers/profile.ts:58` | Opcional: validar a assinatura (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF…WEBP`). |
| 5 | baixa | Isto é informativo e foi uma decisão de projeto. Quando a sessão expira, o rascunho com PII (nome, e-mail, observação) fica em `sessionStorage` da aba até um novo login, e é descartado se quem entrar for outro usuário. O escopo é só a aba. | `src/queries/session.ts:115-118` e `:189` | Manter. Se quiser, aplicar um TTL ao rascunho mantido após a expiração. |

Nenhum achado crítico, alto ou médio.
