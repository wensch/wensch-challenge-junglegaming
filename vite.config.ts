import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * `main.tsx` must start MSW before it imports the app (engine.io captures `WebSocket` at module
 * evaluation), so the app chunk (`bootstrap`) is only requested after the worker is up — a serial
 * network round trip on the critical path (as is the mocks chunk, imported from the entry). This plugin emits `<link rel="modulepreload">` for the
 * static graphs of `bootstrap`, the mocks (`browser`, plus the lazy `seed`) and the CSS in index.html: the browser downloads and compiles
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
        const rootRe = /\/src\/(bootstrap\.tsx|mocks\/browser\.ts|mocks\/seed\.ts)$/
        // Landing routes ('/' and '/nft/:id') are code-split by the router plugin; their component chunks are
        // otherwise only discovered after the app boots.
        const landingRe = /\/src\/routes\/(index|nft\.\$id)\.tsx\?tsr-split/
        const norm = (p: string) => p.replace(/\\/g, '/')
        const roots = Object.values(bundle).filter(
          (c) => c.type === 'chunk' && (rootRe.test(norm(c.facadeModuleId ?? '')) || c.moduleIds.some((m) => landingRe.test(norm(m)))),
        )
        if (!roots.length) return []
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
        for (const root of roots) visit(root.fileName)
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
  build: {
    rolldownOptions: {
      output: {
        // Fewer, larger chunks: the app boots from ~55 tiny scripts otherwise (one round trip each on a slow link).
        // socket.io-client / engine.io-client are deliberately NOT in `vendor` (nor any shared chunk the mocks import):
        // engine.io captures `WebSocket` at evaluation, which must happen only after the MSW worker is up (see main.tsx).
        advancedChunks: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|@tanstack|axios|zod|decimal\.js|radix-ui|@radix-ui|@floating-ui|aria-hidden|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|get-nonce|lucide-react|clsx|tailwind-merge|class-variance-authority|sonner|tiny-invariant|tiny-warning|cookie-es|seroval|seroval-plugins)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  preview: { headers: productionHeaders() },
})
