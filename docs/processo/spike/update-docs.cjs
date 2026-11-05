// One-off doc update after Phase 0 spikes 2 and 3.
const fs = require('fs')
const must = (s, from, to, file) => {
  if (from instanceof RegExp ? !from.test(s) : !s.includes(from)) throw new Error(`pattern not found in ${file}: ${String(from).slice(0, 60)}`)
  return s.replace(from, to)
}

let s = fs.readFileSync('STATUS.md', 'utf8')
s = must(s, /\*\*Fase atual:\*\*.*\n/, '**Fase atual:** Etapa D concluída — **aguardando "prossiga"** para iniciar a Fase 1.\n', 'STATUS')
s = must(s, '| D — Spikes | 1 OK · 2 BLOQUEADO · 3 PARCIAL | ver abaixo |', '| D — Spikes | 1 OK · 2 OK (3 frames pendentes) · 3 OK | ver abaixo |', 'STATUS')
s = must(s, /## Spike 2 — Figma: \*\*BLOQUEADO\*\*[\s\S]*?(?=## Spike 3)/, `## Spike 2 — Figma: **OK (com pendências)**
- O original exige edição → usada a cópia do usuário \`ua5xsyQarfBRq7v7ZxWXPr\`. 15 frames mapeados, tokens de cor e tipografia extraídos (docs/figma.md), metadados completos salvos (.spike/figma-meta.xml).
- 12 de 15 frames exportados em 1x para \`design/ref/\`. **Pendentes:** Desktop/Cadastro, Desktop/Carteiras, Mobile/Carrinho.
- **Risco novo:** o MCP do Figma no plano Starter atingiu o limite de chamadas; \`get_design_context\` por tela e export de assets em 2x podem ficar indisponíveis. Contingência: metadados XML (posições/tamanhos), PNGs 1x, recorte das 5 ilustrações do frame de Início, ou export manual pelo usuário.

`, 'STATUS')
s = must(s, /## Spike 3 — Deploy Vercel: \*\*PARCIAL\*\*[\s\S]*?(?=## Próximo passo)/, `## Spike 3 — Deploy Vercel: **OK**
- Repositório: https://github.com/wensch/wensch-challenge-junglegaming (público). Commits e deploy no nome do usuário, sem trailers de IA (a pedido).
- Projeto Vercel \`wensch-challenge-junglegaming\` (time "wensch's projects"). Produção: **https://wensch-challenge-junglegaming.vercel.app**
- Verificado: \`/\`, \`/some/deep/route\` e \`/nft/42\` → 200 (SPA fallback); \`mockServiceWorker.js\` com \`no-cache\` e \`Service-Worker-Allowed: /\`; headers de segurança presentes.
- \`BASE_URL=https://wensch-challenge-junglegaming.vercel.app npx playwright test 00-spike\` → **2 passed** (MSW + socket.io-client funcionando em produção).
- A CLI da Vercel não é usada (EPERM de symlink no Windows); deploy via conector/Git.

## Skills instaladas (projeto: \`.claude/skills/\`, \`skills-lock.json\`)
shadcn (shadcn-ui/ui), playwright-cli (microsoft), playwright-best-practices (currents-dev), accessibility (addyosmani/web-quality-skills). Cada SKILL.md foi lido antes e os 94 arquivos foram varridos por padrões perigosos: nada encontrado.

`, 'STATUS')
fs.writeFileSync('STATUS.md', s)

let p = fs.readFileSync('PLANO.md', 'utf8')
p = must(p, /\| Figma sem acesso via MCP.*\n/, '| Figma: limite de chamadas do MCP (plano Starter) | **Aberto** | metadados XML + PNGs 1x já salvos; recorte de assets; export manual pelo usuário |\n', 'PLANO')
p = must(p, /\| Deploy bloqueado.*\n/, '| Deploy | **Resolvido** | produção em wensch-challenge-junglegaming.vercel.app |\n', 'PLANO')
p = must(p, '## 8. Skills e plugins candidatos (nenhum instalado ainda)', '## 8. Skills e plugins (instalados após revisão: shadcn, playwright-cli, playwright-best-practices, accessibility)', 'PLANO')
fs.writeFileSync('PLANO.md', p)

let c = fs.readFileSync('CLAUDE.md', 'utf8')
c = must(c, '## Integridade (inegociável)', `## Git
- Commits e PRs **sem** trailers \`Co-Authored-By\` ou "Generated with": tudo no nome do usuário (pedido explícito).
- Remoto: https://github.com/wensch/wensch-challenge-junglegaming · Produção: https://wensch-challenge-junglegaming.vercel.app
- Smoke em produção: \`BASE_URL=<url> npx playwright test\`.
- Antes de commitar: \`npx tsc -b --noEmit && npx eslint .\` precisa passar.

## Integridade (inegociável)`, 'CLAUDE')
c = must(c, '- No Windows, Playwright usa', '- Figma: usar a cópia `ua5xsyQarfBRq7v7ZxWXPr`; o MCP tem limite de chamadas (plano Starter). Economize: prefira `.spike/figma-meta.xml` e `design/ref/`.\n- No Windows, Playwright usa', 'CLAUDE')
fs.writeFileSync('CLAUDE.md', c)
console.log('docs updated')
