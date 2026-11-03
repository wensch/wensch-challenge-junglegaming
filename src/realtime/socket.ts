/**
 * Socket.IO lifecycle per session (ARCHITECTURE §3, §8).
 * - One connection at a time: `start()` closes the previous one first, so listeners of an old
 *   session can never receive events of a new one.
 * - `io(VITE_SOCKET_URL, { transports: ['websocket'], auth: { token } })`: the MSW binding has no
 *   long-polling, acks or binary; `token: null` = visitor (public events only).
 * - Every payload goes through the reconciler (validation, dedupe, version, isolation).
 * - A connect after the first one is a reconnection -> `reconciler.onReconnect()` (REST refetch).
 * - `stop()` (teardown on logout/expiry/user switch) removes listeners and disconnects.
 */
import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { EVENT_TYPES, type RealtimeEvent } from '@/api/contracts'
import { env } from '@/env'
import { createReconciler, type ReconcileOutcome, type Reconciler } from './reconcile'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface RealtimeState {
  status: RealtimeStatus
  /** User the socket was opened for (`null` = visitor). */
  userId: string | null
  connections: number
  lastEvent: { id: string | null; type: string | null; outcome: ReconcileOutcome } | null
  applied: number
}

export interface StartOptions {
  token: string | null
  userId: string | null
  queryClient: QueryClient
}

type EventListener = (event: RealtimeEvent) => void
type Factory = (url: string, token: string | null) => Socket

const defaultFactory: Factory = (url, token) =>
  io(url, { transports: ['websocket'], auth: { token }, reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5_000 })

const INITIAL: RealtimeState = { status: 'idle', userId: null, connections: 0, lastEvent: null, applied: 0 }

export function createRealtimeManager(url: string, factory: Factory = defaultFactory) {
  let socket: Socket | null = null
  let reconciler: Reconciler | null = null
  let state: RealtimeState = INITIAL
  const stateListeners = new Set<() => void>()
  const eventListeners = new Set<EventListener>()

  function setState(patch: Partial<RealtimeState>) {
    state = { ...state, ...patch }
    for (const l of stateListeners) l()
  }

  function stop() {
    if (socket) {
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
    }
    socket = null
    reconciler = null
    setState(INITIAL)
  }

  function start({ token, userId, queryClient }: StartOptions) {
    stop()
    const rec = createReconciler({ queryClient, getUserId: () => userId, log: (m, d) => console.warn(m, d) })
    const s = factory(url, token)
    socket = s
    reconciler = rec
    setState({ status: 'connecting', userId })

    s.on('connect', () => {
      const connections = state.connections + 1
      setState({ status: 'connected', connections })
      if (connections > 1) rec.onReconnect()
    })
    s.on('disconnect', (reason) => {
      // `io client disconnect` = we closed it; anything else will be retried by the Manager.
      setState({ status: reason === 'io client disconnect' ? 'disconnected' : 'reconnecting' })
    })
    s.on('connect_error', () => setState({ status: 'reconnecting' }))

    for (const type of EVENT_TYPES) {
      s.on(type, (payload: unknown) => {
        if (socket !== s) return // late frame of a closed session
        const { outcome, event } = rec.handle(payload)
        setState({
          lastEvent: { id: event?.id ?? null, type: event?.type ?? null, outcome },
          applied: state.applied + (outcome === 'applied' ? 1 : 0),
        })
        if (outcome === 'applied' && event) for (const l of eventListeners) l(event)
      })
    }
  }

  return {
    start,
    stop,
    getState: () => state,
    subscribe(listener: () => void) {
      stateListeners.add(listener)
      return () => void stateListeners.delete(listener)
    },
    /** Applied (validated, deduped, newer) events only — e.g. for aria-live announcements. */
    onEvent(listener: EventListener) {
      eventListeners.add(listener)
      return () => void eventListeners.delete(listener)
    },
    /** Lets REST responses feed the version map (e.g. after GET /orders/:id). */
    noteVersion(key: string, version: number) {
      reconciler?.noteVersion(key, version)
    },
  }
}

export type RealtimeManager = ReturnType<typeof createRealtimeManager>

/** App-wide instance (one socket per session). */
export const realtime = createRealtimeManager(env.socketUrl)
