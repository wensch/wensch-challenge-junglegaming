import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/api/contracts'
import { isActive } from './scenario-state'
import { findSession } from './sessions'

type Conn = {
  io: ReturnType<typeof toSocketIo>
  close: () => void
  /** Raw `auth.token` from the CONNECT frame (null for anonymous sockets). */
  token: string | null
  /** Resolved owner of the token (null = anonymous / invalid / expired at connect time). */
  userId: string | null
  /** Resolves once the CONNECT frame was read and the token resolved. */
  ready: Promise<void>
}

const connections = new Set<Conn>()

function parseAuthToken(frame: string): string | null {
  try {
    const auth = JSON.parse(frame.slice(2)) as { token?: string | null }
    return typeof auth.token === 'string' ? auth.token : null
  } catch {
    return null
  }
}
// MSW strips the `/socket.io/` path prefix from the client URL before matching,
// so the link must target the bare origin (a pattern containing /socket.io/ never matches).
const realtime = ws.link(import.meta.env.VITE_SOCKET_URL)

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    // network.offline: the socket is refused until the scenario is left.
    if (isActive('network.offline')) {
      connection.client.close()
      return
    }
    const io = toSocketIo(connection)
    let resolveReady: () => void = () => undefined
    const conn: Conn = {
      io,
      token: null,
      userId: null,
      close: () => connection.client.close(),
      ready: new Promise<void>((r) => {
        resolveReady = r
      }),
    }
    connections.add(conn)

    // The binding fakes the handshake but sends no heartbeat; without pings the
    // real socket.io-client closes after pingInterval + pingTimeout.
    const heartbeat = setInterval(() => connection.client.send('2'), 20_000)

    // The binding ignores CONNECT payloads; read socket.io `auth` from the raw frame.
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('40{')) {
        const token = parseAuthToken(event.data)
        conn.token = token
        void findSession(token)
          .then((r) => {
            conn.userId = r.status === 'ok' ? r.user.id : null
          })
          .catch(() => undefined)
          .finally(resolveReady)
      }
    })
    // A client that never sends auth still becomes ready (anonymous).
    setTimeout(resolveReady, 50)

    io.client.on('ping.app', () => io.client.emit('pong.app', { at: Date.now() }))

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn)
    })
  }),
]

type Target = { userId?: string | undefined; token?: string | undefined }

function deliver(event: string, payload: unknown, target: Target) {
  for (const c of connections) {
    void c.ready.then(() => {
      if (target.userId !== undefined && c.userId !== target.userId) return
      if (target.token !== undefined && c.token !== target.token) return
      c.io.client.emit(event, payload)
    })
  }
}

/** Server-side emit of a contract event. Private events (with `userId`) reach only the owner's sockets. */
export function broadcast(event: RealtimeEvent): void {
  deliver(event.type, event, { userId: event.userId })
}

/** Raw emit (tests/spike): arbitrary payload, optionally scoped to a user id or a raw token. */
export function emitRaw(event: string, payload: unknown, target: Target = {}): void {
  deliver(event, payload, target)
}

export function dropConnections(): void {
  for (const c of [...connections]) c.close()
}
