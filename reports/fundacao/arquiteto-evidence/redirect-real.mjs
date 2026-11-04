// Same vectors as seguranca-evidence/redirect-test.mjs, but against the REAL schemas of
// src/api/contracts (loaded through Vite's SSR loader), instead of a literal copy.
// Usage (repo root): node reports/fundacao/arquiteto-evidence/redirect-real.mjs
import { createServer } from 'vite'

const root = process.cwd()
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { safeRedirectSchema, transactionSchema, avatarUrlSchema } = await server.ssrLoadModule('/src/api/contracts/index.ts')
  const BS = String.fromCharCode(92)
  const cands = [
    '/ok', '//evil.com', '/' + BS + 'evil.com', 'javascript:alert(1)', 'https://evil.com', '/%2F%2Fevil.com', '/%5Cevil.com',
    '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '%2F%2Fevil.com', BS + '/evil.com', '/ /evil.com', '/.//evil.com', '/..//evil.com',
    '/javascript:alert(1)', '/\t' + BS + 'evil.com',
  ]
  let bypass = 0
  for (const c of cands) {
    const r = safeRedirectSchema.safeParse(c)
    const resolved = r.success ? new URL(r.data, 'https://app.example').href : '-'
    const cross = r.success && !resolved.startsWith('https://app.example/')
    if (cross) bypass++
    console.log(JSON.stringify(c).padEnd(26), `accepted=${r.success}`, r.success ? `-> ${resolved}` : '', cross ? '<<< BYPASS' : '')
  }
  const tx = (u) => transactionSchema.safeParse({ hash: '0x' + 'a'.repeat(64), explorerUrl: u, confirmedAt: new Date().toISOString() }).success
  for (const u of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://etherscan.io/tx/0x1', 'vbscript:x']) console.log('explorerUrl', JSON.stringify(u), tx(u))
  for (const u of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,iVBORw0KGgo=', '/avatars/a.webp', 'https://cdn.example.com/a.webp'])
    console.log('avatarUrl', JSON.stringify(u), avatarUrlSchema.safeParse(u).success)
  console.log('BYPASSES', bypass)
  process.exitCode = bypass === 0 ? 0 : 1
} finally {
  await server.close()
}
