import { ws } from 'msw'
import { setupServer } from 'msw/node'
const patterns = { glob: 'wss://realtime.nft-mock.local/socket.io/*', host: 'wss://realtime.nft-mock.local/*', regex: /\/socket\.io\//, exact: 'wss://realtime.nft-mock.local/socket.io/' }
for (const [name, p] of Object.entries(patterns)) {
  let hit = false
  const link = ws.link(p)
  const server = setupServer(link.addEventListener('connection', () => { hit = true }))
  server.listen({ onUnhandledRequest: 'bypass' })
  const w = new WebSocket('wss://realtime.nft-mock.local/socket.io/?EIO=4&transport=websocket')
  w.onerror = () => {}
  await new Promise((r) => setTimeout(r, 300))
  console.log(name.padEnd(6), hit ? 'MATCH' : 'no match')
  w.close(); server.close()
}
