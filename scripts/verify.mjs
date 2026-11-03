// Single quality gate: typecheck -> lint -> build -> Playwright functional (desktop+mobile) -> visual -> axe.
// Stops at the first failure and writes reports/verify-latest.md.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const steps = [
  ['typecheck', 'npx tsc -b --noEmit'],
  ['lint', 'npx eslint .'],
  ['build', 'npx vite build'],
  ['e2e', 'npx playwright test --grep-invert "@visual|@a11y"'],
  ['visual', 'npx playwright test --grep @visual --pass-with-no-tests'],
  ['a11y', 'npx playwright test --grep @a11y --pass-with-no-tests'],
]
const results = []
let ok = true
for (const [name, cmd] of steps) {
  const t0 = Date.now()
  console.log(`\n▶ ${name}: ${cmd}`)
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true, env: { ...process.env, PW_SKIP_BUILD: name === 'build' ? '' : '1' } })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  results.push(`| ${name} | ${r.status === 0 ? 'PASS' : 'FAIL'} | ${secs}s | \`${cmd}\` |`)
  if (r.status !== 0) { ok = false; break }
}
mkdirSync('reports', { recursive: true })
writeFileSync('reports/verify-latest.md', `# verify — ${new Date().toISOString()}\n\nResult: **${ok ? 'GREEN' : 'RED'}**\n\n| step | status | time | command |\n|---|---|---|---|\n${results.join('\n')}\n`)
console.log(`\nverify: ${ok ? 'GREEN' : 'RED'} (reports/verify-latest.md)`)
process.exit(ok ? 0 : 1)
