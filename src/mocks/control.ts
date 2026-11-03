/** `window.__mock`: the only way tests and the demo panel talk to the simulated server. */
import type { MockControl, ScenarioName } from '@/api/contracts'
import { patchNft } from './catalog'
import { clearPersisted, setDb } from './db'
import { resetLatencyState } from './latency'
import { clearOrderTimers, settleOrder } from './orders'
import { dropConnections, emitRaw } from './realtime'
import { getScenarios, onScenarioChange, setScenarios } from './scenario-state'
import { buildSeed } from './seed'
import { clearLater } from './timers'

declare global {
  interface Window {
    /** Spike-era overload `emit(event, payload, rawToken)` is kept until 00-spike.spec.ts is replaced. */
    __mock?: MockControl & { emit(event: string, payload: unknown, rawToken: string): void }
  }
}

onScenarioChange((next) => {
  resetLatencyState()
  if (next.includes('network.offline')) dropConnections()
})

export const control: MockControl = {
  async reset(scenarios?: ScenarioName[]) {
    clearOrderTimers()
    clearLater()
    clearPersisted()
    setDb(await buildSeed())
    setScenarios(scenarios ?? ['default'])
  },
  setScenarios: (names) => setScenarios(names),
  getScenarios,
  emit(event, payload, opts) {
    emitRaw(event, payload, { userId: opts?.userId })
  },
  updateNft(nftId, patch) {
    patchNft(nftId, patch)
  },
  drop: dropConnections,
  settleOrder(orderId, status) {
    settleOrder(orderId, status)
  },
}

export function installControl(): void {
  window.__mock = {
    ...control,
    // Spike-era signature: third argument is a raw token string.
    emit(event: string, payload: unknown, third?: string | { userId?: string }) {
      if (typeof third === 'string') emitRaw(event, payload, { token: third })
      else emitRaw(event, payload, { userId: third?.userId })
    },
  } as NonNullable<Window['__mock']>
}
