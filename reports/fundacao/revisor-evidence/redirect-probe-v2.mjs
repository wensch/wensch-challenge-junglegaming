// Revisor (fundacao, volta 2): sonda independente de safeRedirectSchema / httpsUrlSchema / avatarUrlSchema
// carregando os schemas REAIS pelo SSR loader do Vite (sem build).
// Uso (raiz do repo): node reports/fundacao/revisor-evidence/redirect-probe-v2.mjs
import { createServer } from 'vite'
const root = process.cwd()
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { safeRedirectSchema, httpsUrlSchema, avatarUrlSchema } = await server.ssrLoadModule('/src/api/contracts/index.ts')
  const BS = String.fromCharCode(92)
  const v = ['/\t/evil.com', '/\n/evil.com', '/..//evil.com', '/a/../..//evil.com', '/%2F/evil.com', '/%5Cevil.com', '/checkout?x=1#y', '/', `/${BS}evil.com`, `/${BS}${BS}evil.com`, '//evil', 'https://evil']
  for (const x of v) { const r = safeRedirectSchema.safeParse(x); console.log(JSON.stringify(x), r.success ? 'OK->' + JSON.stringify(r.data) : 'REJ') }
  for (const x of ['javascript:alert(1)', 'http://etherscan.io/tx', 'https://etherscan.io/tx/0x', 'https://localhost/x']) console.log('https', JSON.stringify(x), httpsUrlSchema.safeParse(x).success)
  for (const x of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,iVBO', '/avatars/a.webp', 'https://cdn.example/a.png']) console.log('avatar', JSON.stringify(x), avatarUrlSchema.safeParse(x).success)
} finally { await server.close() }
