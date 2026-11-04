import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * `main.tsx` must start MSW before it imports the app (engine.io captures `WebSocket` at module
 * evaluation), so the app chunk (`bootstrap`) is only requested after the worker is up — a serial
 * network round trip on the critical path. This plugin emits `<link rel="modulepreload">` for the
 * whole static graph of `bootstrap` (and its CSS) in index.html: the browser downloads and compiles
 * it in parallel with the mocks, but does NOT evaluate it, so the WebSocket rule still holds.
 */
function preloadBootstrapGraph(): Plugin {
  return {
    name: 'kurio:preload-bootstrap-graph',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return []
        const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/bootstrap.tsx'))
        if (!entry || entry.type !== 'chunk') return []
        const files = new Set<string>()
        const css = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          const chunk = bundle[fileName]
          if (!chunk || chunk.type !== 'chunk') return
          files.add(fileName)
          for (const f of chunk.viteMetadata?.importedCss ?? []) css.add(f)
          for (const dep of chunk.imports) visit(dep)
        }
        visit(entry.fileName)
        const base = ctx.server?.config.base ?? '/'
        // Skip what Vite already links for the entry chunk.
        const fresh = (f: string) => !html.includes(`${base}${f}`)
        return [
          ...[...files].filter(fresh).map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `${base}${f}` }, injectTo: 'head' as const })),
          ...[...css].filter(fresh).map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: `${base}${f}` }, injectTo: 'head' as const })),
        ]
      },
    },
  }
}

/**
 * `vite preview` serves the same security headers as production (vercel.json), so the E2E suite runs
 * under the real CSP / Permissions-Policy and catches anything that would break MSW, the service
 * worker or the socket in production.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }
  const global = config.headers?.find((h) => h.source === '/(.*)')
  return Object.fromEntries((global?.headers ?? []).map((h) => [h.key, h.value]))
}

export default defineConfig({
  // The router plugin must run before the React plugin (it rewrites route files for code splitting).
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
    preloadBootstrapGraph(),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  preview: { headers: productionHeaders() },
})
