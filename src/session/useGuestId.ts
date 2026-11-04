/** Reactive visitor id (null until `ensureGuestId()` creates it). */
import { useSyncExternalStore } from 'react'
import { peekGuestId, subscribeGuestId } from './store'

export function useGuestId(): string | null {
  return useSyncExternalStore(subscribeGuestId, peekGuestId, () => null)
}
