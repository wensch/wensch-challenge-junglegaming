import type { EndpointName } from '@/api/contracts'
import { isActive } from './scenario-state'
import { createRng, hashString, SEED } from './rng'

export const DEFAULT_LATENCY_MS = 150
export const SLOW_LATENCY_MS = 2500

let requestIndex = 0
let listBurstStartedAt = 0
let listBurstCount = 0

export function resetLatencyState(): void {
  requestIndex = 0
  listBurstStartedAt = 0
  listBurstCount = 0
}

/**
 * Latency of the next request in ms, or 'infinite' (network.timeout: never answers).
 * Deterministic: variable latency derives from the fixed seed and the request index.
 */
export function nextLatency(endpoint: EndpointName): number | 'infinite' {
  const index = requestIndex++
  if (isActive('network.timeout')) return 'infinite'

  if (endpoint === 'listNfts' && isActive('catalog.out-of-order')) {
    // First request of a burst is slow; the following ones (same burst) are fast -> stale responses arrive last.
    const now = Date.now()
    if (now - listBurstStartedAt > 2500 || listBurstCount === 0) {
      listBurstStartedAt = now
      listBurstCount = 0
    }
    listBurstCount++
    return listBurstCount === 1 ? 2000 : 100
  }

  const candidates: number[] = [DEFAULT_LATENCY_MS]
  if (isActive('latency.slow')) candidates.push(SLOW_LATENCY_MS)
  if (isActive('latency.variable')) candidates.push(100 + Math.floor(createRng(hashString(`latency:${index}`) ^ SEED).next() * 1700))
  // Variable replaces the default when active; slow always wins when both are set.
  if (isActive('latency.variable') && !isActive('latency.slow')) return candidates[candidates.length - 1]!
  return Math.max(...candidates)
}
