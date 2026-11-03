import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/api/contracts'
import { onDbSynced } from './db'
import { isActive } from './scenario-state'
import { findSession, onSessionsChanged } from './sessions'

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

/** True while the socket's token still maps to a live session (anonymous sockets are always "valid"). */
async function stillAuthorised(c: Conn): Promise<boolean> {
  if (c.userId === null || c.token === null) return true
  const r = await findSession(c.token)
  return r.status === 'ok' && r.user.id === c.userId
}

function dropConn(c: Conn): void {
  connections.delete(c)
  c.close()
}

/** Closes sockets whose session was revoked (logout, password change) or expired. */
async function sweepConnections(): Promise<void> {
  for (const c of [...connections]) {
    await c.ready
    if (!(await stillAuthorised(c))) dropConn(c)
  }
}

onSessionsChanged(() => void sweepConnections())
// Another tab changed the shared DB (it may have revoked a session).
onDbSynced(() => void sweepConnections())

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
    const heartbeat = setInterval(() => {
      connection.client.send('2')
      void sweepConnections()
    }, 20_000)

    // The binding ignores CONNECT payloads; read socket.io `auth` from the raw frame.
    // `40` (no payload) is an anonymous CONNECT; `40{...}` carries `auth`. Delivery waits for this frame.
    let connected = false
    connection.client.addEventListener('message', (event) => {
      if (connected || typeof event.data !== 'string' || !event.data.startsWith('40')) return
      connected = true
      const token = event.data.startsWith('40{') ? parseAuthToken(event.data) : null
      conn.token = token
      void findSession(token)
        .then((r) => {
          conn.userId = r.status === 'ok' ? r.user.id : null
        })
        .catch(() => undefined)
        .finally(resolveReady)
    })

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn)
    })
  }),
]

function deliver(event: string, payload: unknown, userId: string | undefined) {
  for (const c of connections) {
    void c.ready.then(async () => {
      if (userId !== undefined && c.userId !== userId) return
      if (!(await stillAuthorised(c))) {
        dropConn(c)
        return
      }
      c.io.client.emit(event, payload)
    })
  }
}

/** Server-side emit of a contract event. Private events (with `userId`) reach only the owner's sockets. */
export function broadcast(event: RealtimeEvent): void {
  deliver(event.type, event, event.userId)
}

/** Raw emit (tests): arbitrary payload, optionally scoped to a user id. */
export function emitRaw(event: string, payload: unknown, opts: { userId?: string | undefined } = {}): void {
  deliver(event, payload, opts.userId)
}

export function dropConnections(): void {
  for (const c of [...connections]) c.close()
}
