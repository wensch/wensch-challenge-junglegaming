import { ws } from 'msw'
import { setupServer } from 'msw/node'
const [pattern, url] = process.argv.slice(2)
let hit = false
const p = pattern.startsWith('/') ? new RegExp(pattern.slice(1, -1)) : pattern
setupServer(ws.link(p).addEventListener('connection', () => { hit = true })).listen({ onUnhandledRequest: 'bypass' })
const w = new WebSocket(url); w.onerror = () => {}
await new Promise((r) => setTimeout(r, 300))
console.log(hit ? 'MATCH   ' : 'no      ', pattern, '<-', url); process.exit(0)
