/**
 * Binds the socket lifecycle to the session: (re)opens the socket whenever the token changes and
 * closes it on unmount. Renders a hidden, non-interactive probe with the connection state so E2E
 * tests can assert on the real socket.io-client pipeline without touching the query cache.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/queries/session'
import { realtime } from './socket'

export function useRealtimeState() {
  return useSyncExternalStore(realtime.subscribe, realtime.getState, realtime.getState)
}

export function RealtimeBridge() {
  const queryClient = useQueryClient()
  const session = useSession()
  const ready = !session.isPending
  const token = session.data?.token ?? null
  const userId = session.data?.user.id ?? null

  useEffect(() => {
    if (!ready) return
    realtime.start({ token, userId, queryClient })
    return () => realtime.stop()
  }, [ready, token, userId, queryClient])

  const state = useRealtimeState()
  return (
    <div
      hidden
      data-testid="realtime-probe"
      data-status={state.status}
      data-user={state.userId ?? 'guest'}
      data-connections={state.connections}
      data-applied={state.applied}
      data-last-event={state.lastEvent?.id ?? ''}
      data-last-outcome={state.lastEvent?.outcome ?? ''}
    />
  )
}
