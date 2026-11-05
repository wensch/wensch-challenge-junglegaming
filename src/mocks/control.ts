/** `window.__mock`: the only way tests and the demo panel talk to the simulated server. */
import type { MockControl, ScenarioName } from '@/api/contracts/scenarios'
import { patchNft } from './catalog'
import { clearPersisted, setDb } from './db'
import { resetLatencyState } from './latency'
import { clearOrderTimers, settleOrder } from './orders'
import { dropConnections, emitRaw } from './realtime'
import { getScenarios, onScenarioChange, setScenarios } from './scenario-state'
import { clearLater } from './timers'

declare global {
  interface Window {
    __mock?: MockControl
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
    setDb(await (await import('./seed')).buildSeed())
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
  window.__mock = control
}
