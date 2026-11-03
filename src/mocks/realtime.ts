import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'

type Conn = { io: ReturnType<typeof toSocketIo>; close: () => void; token: string | null }

const connections = new Set<Conn>()
// MSW strips the `/socket.io/` path prefix from the client URL before matching,
// so the link must target the bare origin (a pattern containing /socket.io/ never matches).
const realtime = ws.link(import.meta.env.VITE_SOCKET_URL)

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const conn: Conn = { io, token: null, close: () => connection.client.close() }
    connections.add(conn)

    // The binding fakes the handshake but sends no heartbeat; without pings the
    // real socket.io-client closes after pingInterval + pingTimeout.
    const heartbeat = setInterval(() => connection.client.send('2'), 20_000)

    // The binding ignores CONNECT payloads; read socket.io `auth` from the raw frame.
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('40{')) {
        const auth = JSON.parse(event.data.slice(2)) as { token?: string }
        conn.token = auth.token ?? null
      }
    })

    io.client.on('ping.app', () => io.client.emit('pong.app', { at: Date.now() }))

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn)
    })
  }),
]

/** Server-side emit from the mock layer; frames travel through socket.io-client. */
export function emitToClients(event: string, payload: unknown, token?: string) {
  for (const c of connections) if (!token || c.token === token) c.io.client.emit(event, payload)
}

export function dropConnections() {
  for (const c of connections) c.close()
}
