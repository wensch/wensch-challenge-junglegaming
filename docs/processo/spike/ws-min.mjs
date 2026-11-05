import { ws } from 'msw'
import { setupServer } from 'msw/node'
const chat = ws.link('wss://chat.example.com')
let hit = false
const server = setupServer(chat.addEventListener('connection', () => { hit = true }))
server.listen()
const before = globalThis.WebSocket.name
const w = new WebSocket('wss://chat.example.com')
w.onerror = (e) => console.log('error event')
w.onopen = () => console.log('open')
await new Promise((r) => setTimeout(r, 500))
console.log('ctor', before, '| hit', hit)
server.close()
