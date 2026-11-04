// Volta 2 (seguranca): vetores NOVOS contra os schemas REAIS (via Vite SSR loader).
// Uso (raiz do repo): node reports/fundacao/seguranca-evidence/redirect-v2.mjs
// Para cada valor aceito, verifica tambem o pior consumidor: decodeURIComponent da saida e
// resolucao contra a origem (simula location.assign / <a href> com valor decodificado).
import { createServer } from 'vite'

const root = process.cwd()
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { safeRedirectSchema, transactionSchema, avatarUrlSchema, authSearchSchema } = await server.ssrLoadModule('/src/api/contracts/index.ts')
  const BS = String.fromCharCode(92)
  const O = 'https://app.example'
  const cands = [
    '/\u0000/evil.com', '/\u000b/evil.com', '/\u007f/evil.com', '/ /evil.com', '/ /evil.com', '/　/evil.com',
    '/／/evil.com', '/＼evil.com', '/%09/evil.com', '/%0a/evil.com', '/.%2e//evil.com', '/%2e%2e//evil.com', '/a/..//evil.com',
    '/a/../..//evil.com', '/./', '/?//evil.com', '/#//evil.com', '/?x=' + BS, '/@evil.com', '/:@evil.com', '/%252F%252Fevil.com',
    '/' + 'a'.repeat(600), ' /ok', '/ok\u0000', 'HTTPS://evil.com', '/\ud800', '/%E2%80%AE/evil.com',
  ]
  let bypass = 0
  for (const c of cands) {
    const r = safeRedirectSchema.safeParse(c)
    let note = ''
    if (r.success) {
      const direct = new URL(r.data, O)
      let decodedOrigin = O
      try { decodedOrigin = new URL(decodeURIComponent(r.data), O).origin } catch { decodedOrigin = 'decode-error' }
      if (direct.origin !== O) { bypass++; note = '<<< BYPASS (direto)' }
      else if (decodedOrigin !== O && decodedOrigin !== 'decode-error') note = `(so se o consumidor decodificar: ${decodedOrigin})`
      note = `-> ${JSON.stringify(r.data)} ${note}`
    }
    console.log(JSON.stringify(c).slice(0, 40).padEnd(42), `accepted=${r.success}`, note)
  }
  if (authSearchSchema) {
    for (const s of [{ redirect: '//evil.com' }, { redirect: '/ok', reason: 'x' }, { redirect: ['/a', '/b'] }])
      console.log('authSearch', JSON.stringify(s), JSON.stringify(authSearchSchema.safeParse(s)))
  }
  const tx = (u) => transactionSchema.safeParse({ hash: '0x' + 'a'.repeat(64), explorerUrl: u, confirmedAt: new Date().toISOString() }).success
  for (const u of ['JAVASCRIPT:alert(1)', ' javascript:alert(1)', '\u0001javascript:alert(1)', 'java\tscript:alert(1)', 'http://etherscan.io/tx/1', 'https://127.0.0.1/x', 'https://etherscan.io/tx/0x1', 'https:evil.com', 'https:\\evil.com'])
    console.log('explorerUrl', JSON.stringify(u), tx(u))
  for (const u of ['//evil.com/a.png', '/\t/evil.com/a.png', 'data:image/png;base64,iVBO\n<script>', 'data:image/png,abc', 'DATA:image/png;base64,AAAA', 'blob:https://app.example/x', 'http://cdn.example.com/a.png', 'data:image/webp;base64,UklGR'])
    console.log('avatarUrl', JSON.stringify(u), avatarUrlSchema.safeParse(u).success)
  console.log('BYPASSES', bypass)
  process.exitCode = bypass === 0 ? 0 : 1
} finally {
  await server.close()
}
