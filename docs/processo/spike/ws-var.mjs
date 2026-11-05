import { ws } from 'msw'
import { setupServer } from 'msw/node'
const cases = [
  ['wss://chat.example.com', 'wss://chat.example.com/'],
  ['wss://chat.example.com/socket.io/', 'wss://chat.example.com/socket.io/'],
  ['wss://chat.example.com/socket.io/', 'wss://chat.example.com/socket.io/?EIO=4&transport=websocket'],
  ['wss://chat.example.com/socket.io/*', 'wss://chat.example.com/socket.io/?EIO=4'],
  ['wss://realtime.nft-mock.local', 'wss://realtime.nft-mock.local/'],
  ['wss://realtime.nft-mock.local/socket.io/', 'wss://realtime.nft-mock.local/socket.io/'],
]
for (const [pattern, url] of cases) {
  let hit = false
  const server = setupServer(ws.link(pattern).addEventListener('connection', () => { hit = true }))
  server.listen({ onUnhandledRequest: 'bypass' })
  const w = new WebSocket(url); w.onerror = () => {}
  await new Promise((r) => setTimeout(r, 300))
  console.log(hit ? 'MATCH   ' : 'no      ', pattern, '<-', url)
  try { w.close() } catch {}
  server.close()
}
