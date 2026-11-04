// Lighthouse: build de producao + vite preview, 3 execucoes por pagina/perfil, mediana.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from '@playwright/test'
import mobile from './config/mobile.mjs'
import desktop from './config/desktop.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.LH_PORT ?? 4191)
const RUNS = Number(process.env.LH_RUNS ?? 3)
const BASE = `http://localhost:${PORT}`
const isWin = process.platform === 'win32'
const pages = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/nft_002' },
]
const profiles = { mobile, desktop }
const date = new Date().toISOString().slice(0, 10)
const outDir = path.join(root, 'lighthouse', 'reports', date)

let server
function stop() {
  if (!server || server.killed === true && !server.pid) return
  const pid = server.pid
  try {
    if (isWin) spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' })
    else process.kill(-pid, 'SIGTERM')
  } catch {}
  server = undefined
}
process.on('exit', stop)
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { stop(); process.exit(130) })

const median = (a) => {
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`servidor nao respondeu em ${url}`)
}

async function main() {
  if (!process.env.LH_SKIP_BUILD) {
    const r = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true })
    if (r.status !== 0) throw new Error('build falhou')
  }
  server = spawn(`npx vite preview --port ${PORT} --strictPort`, {
    cwd: root, shell: true, stdio: 'ignore', detached: !isWin,
  })
  await waitFor(BASE)
  mkdirSync(outDir, { recursive: true })
  const chromePath = chromium.executablePath()
  const results = []
  for (const [profile, config] of Object.entries(profiles)) {
    for (const pg of pages) {
      const runs = []
      let discarded = 0
      for (let n = 1, attempt = 0; n <= RUNS; attempt++) {
        if (attempt >= RUNS + 6) throw new Error(`demasiadas falhas do Lighthouse em ${pg.path} (${profile})`)
        const chrome = await chromeLauncher.launch({
          chromePath,
          chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
        })
        try {
          const res = await lighthouse(BASE + pg.path, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, config)
          const l = res.lhr
          // Execucao com runtimeError (ex.: NO_NAVSTART, flake do trace do Chrome) nao tem metricas: descarta e repete.
          if (l.runtimeError) {
            discarded++
            console.warn(`  descartada (${l.runtimeError.code}) ${pg.path} ${profile}`)
            continue
          }
          const base = path.join(outDir, `${pg.name}-${profile}-${n}`)
          writeFileSync(`${base}.html`, res.report[0])
          writeFileSync(`${base}.json`, res.report[1])
          const a = l.audits
          runs.push({
            performance: Math.round(l.categories.performance.score * 100),
            accessibility: Math.round(l.categories.accessibility.score * 100),
            bestPractices: Math.round(l.categories['best-practices'].score * 100),
            seo: Math.round(l.categories.seo.score * 100),
            lcp: a['largest-contentful-paint'].numericValue,
            cls: a['cumulative-layout-shift'].numericValue,
            tbt: a['total-blocking-time'].numericValue,
            fcp: a['first-contentful-paint'].numericValue,
            si: a['speed-index'].numericValue,
          })
          n++
        } finally {
          await chrome.kill()
        }
      }
      const keys = Object.keys(runs[0])
      const med = Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))]))
      results.push({ page: pg.name, path: pg.path, profile, discarded, runs, median: med })
      console.log(`${pg.name}/${profile}: perf ${med.performance} a11y ${med.accessibility} bp ${med.bestPractices} seo ${med.seo}`)
    }
  }
  writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2))
  const f = (v, d = 0) => Number(v).toFixed(d)
  const rows = results.map((r) => {
    const m = r.median
    return `| ${r.page} (${r.path}) | ${r.profile} | ${m.performance} | ${m.accessibility} | ${m.bestPractices} | ${m.seo} | ${f(m.lcp)} | ${f(m.cls, 3)} | ${f(m.tbt)} | ${f(m.fcp)} | ${f(m.si)} |`
  })
  const md = [
    `# Lighthouse - medianas de ${RUNS} execucoes (${date})`,
    '',
    '| Pagina | Perfil | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms | FCP ms | SI ms |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows, '',
  ].join('\n')
  writeFileSync(path.join(outDir, 'summary.md'), md)
  const lhVersion = (await import('lighthouse/package.json', { with: { type: 'json' } })).default.version
  const cpu = os.cpus()
  writeFileSync(path.join(root, 'lighthouse', 'environment.md'), [
    '# Ambiente da medicao', '',
    `- Data: ${new Date().toISOString()}`,
    `- Node: ${process.version}`,
    `- Chromium (Playwright): ${(await chromium.launch().then(async (b) => { const v = b.version(); await b.close(); return v }))}`,
    `- Lighthouse: ${lhVersion}`,
    `- SO: ${os.type()} ${os.release()} (${os.arch()})`,
    `- CPU: ${cpu[0]?.model} x${cpu.length}`,
    `- RAM: ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB`,
    '- Comando: `npm run lighthouse` (build de producao + vite preview, cenario padrao dos mocks, 3 execucoes, mediana)',
    '- Execucoes com runtimeError (flake NO_NAVSTART) sao descartadas e repetidas; contagem em summary.json (`discarded`)',
    '- Throttling: padrao do Lighthouse (simulado)',
    `- Relatorios: lighthouse/reports/${date}/`, '',
  ].join('\n'))
  console.log('\n' + md)
}

main().then(() => { stop(); process.exit(0) }).catch((e) => { console.error(e); stop(); process.exit(1) })
