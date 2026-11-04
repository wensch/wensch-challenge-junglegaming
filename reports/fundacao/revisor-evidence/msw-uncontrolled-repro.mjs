// Evidencia do revisor (fundacao, volta 3): navegacao de documento enquanto o MSW do documento
// anterior ainda esta iniciando deixa o documento seguinte SEM controller do service worker; o app
// sobe mesmo assim e o GET /api/session vai direto para a rede (404 no preview, index.html na Vercel).
// Rodar (preview ativo em :4173):
//   node reports/fundacao/revisor-evidence/msw-uncontrolled-repro.mjs 8 4          # sem espera
//   WAIT=1 node reports/fundacao/revisor-evidence/msw-uncontrolled-repro.mjs 8 2   # espera window.__mock apos o reload
// Saida: `ctl` = por documento, "<rota>:<C|U no inicio><c|u no load>"; `bad` = respostas /api 404 ou fora do SW.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(fileURLToPath(new URL('../../../package.json', import.meta.url)))
const { chromium } = require('@playwright/test')
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const PAR = +process.argv[2] || 8
const ITER = +process.argv[3] || 3
const browser = await chromium.launch()

async function one(id) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const ev = []
  page.on('response', (r) => {
    if (r.url().includes('/api/')) ev.push(`${r.status()} ${new URL(r.url()).pathname} sw=${r.fromServiceWorker()}`)
  })
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__iso')) {
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('__iso', '1')
    }
    const mark = location.pathname.slice(0, 4) + ':' + (navigator.serviceWorker.controller ? 'C' : 'U')
    sessionStorage.setItem('__ctl', (sessionStorage.getItem('__ctl') ?? '') + mark)
    addEventListener('load', () => sessionStorage.setItem('__ctl', sessionStorage.getItem('__ctl') + (navigator.serviceWorker.controller ? 'c' : 'u') + ' '))
  })
  // Mesmo roteiro do teste de CSP: boot (goto, reset, reload), loginViaApi (fetch + reload) e gotos.
  await page.goto(BASE + '/')
  await page.waitForFunction(() => !!window.__mock)
  await page.evaluate(() => window.__mock.reset())
  await page.reload()
  await page.waitForFunction(() => !!window.__mock)
  await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alice@example.test', password: 'Senha@123' }) })
    const s = await r.json()
    localStorage.setItem('kurio.session', JSON.stringify({ token: s.token, expiresAt: s.expiresAt }))
  })
  await page.reload() // resolve no `load`, antes de o MSW deste documento terminar o start
  if (process.env.WAIT) await page.waitForFunction(() => !!window.__mock)
  for (const p of ['/', '/cart', '/login', '/profile']) {
    await page.goto(BASE + p)
    await page.waitForFunction(() => !!window.__mock)
  }
  await page.waitForTimeout(800)
  const ctl = await page.evaluate(() => sessionStorage.getItem('__ctl'))
  await ctx.close()
  return { id, ctl, bad: ev.filter((e) => /^(404|5)/.test(e) || e.includes('sw=false')) }
}

const results = []
for (let i = 0; i < ITER; i++) results.push(...(await Promise.all(Array.from({ length: PAR }, (_, k) => one(`${i}.${k}`)))))
const uncontrolled = (r) => /U/.test(r.ctl.split(' ').slice(3).join(' '))
for (const r of results) if (r.bad.length || uncontrolled(r)) console.log(JSON.stringify(r))
console.log('runs', results.length, 'uncontrolledAfterLoginReload', results.filter(uncontrolled).length, 'with404', results.filter((r) => r.bad.some((b) => b.startsWith('404'))).length)
await browser.close()
