import './index.css'

// MSW must patch globalThis.WebSocket BEFORE socket.io-client (engine.io-client)
// is evaluated, because engine.io captures the WebSocket constructor at module
// load. Hence the app is imported dynamically only after the worker starts.
async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

await enableMocks()
const { bootstrap } = await import('./bootstrap')
bootstrap(document.getElementById('root')!)
