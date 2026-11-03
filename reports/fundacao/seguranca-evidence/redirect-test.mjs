// Evidencia do relatorio de seguranca (fundacao). Rodar: node reports/fundacao/seguranca-evidence/redirect-test.mjs
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { z } = require('zod')
const BS = String.fromCharCode(92)
const u = z.url()
for (const v of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://etherscan.io/tx/0x1', 'vbscript:x'])
  console.log('z.url', JSON.stringify(v), u.safeParse(v).success)
// copia literal de src/api/contracts/common.ts safeRedirectSchema
const safe = z.string().max(512).refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/' + BS))
const cands = [
  '/ok', '//evil.com', '/' + BS + 'evil.com', 'javascript:alert(1)', 'https://evil.com', '/%2F%2Fevil.com', '/%5Cevil.com',
  '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '%2F%2Fevil.com', BS + '/evil.com', '/ /evil.com', '/.//evil.com', '/..//evil.com',
  '/javascript:alert(1)', '/\t' + BS + 'evil.com',
]
for (const c of cands) {
  const ok = safe.safeParse(c).success
  let resolved = ''
  try { resolved = new URL(c, 'https://app.example').href } catch { resolved = 'ERR' }
  const xo = resolved.startsWith('https://app.example/') ? 'same-origin' : 'CROSS-ORIGIN'
  console.log(JSON.stringify(c).padEnd(28), 'accepted=' + ok, '->', resolved, xo, ok && xo === 'CROSS-ORIGIN' ? '<<< BYPASS' : '')
}
