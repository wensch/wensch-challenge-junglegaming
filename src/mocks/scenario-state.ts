/**
 * Active scenarios (composable). Persisted in localStorage `mock:scenarios`, selectable by `?scenario=a,b`
 * on load, or `window.__mock.setScenarios`. One-shot scenarios (`*.once`, timeout-after-create, ...) track a
 * `fired` set so they disarm after their first effect; re-selecting scenarios re-arms them.
 */
import { isScenarioName, type ScenarioName } from '@/api/contracts'

export const SCENARIOS_KEY = 'mock:scenarios'
const FIRED_KEY = 'mock:scenarios:fired'
const EXPIRED_AT_KEY = 'mock:scenarios:session-expired-at'

let active: ScenarioName[] = ['default']
let fired = new Set<string>()
let sessionExpiredAt = 0
const listeners = new Set<(next: ScenarioName[], prev: ScenarioName[]) => void>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function parseScenarioList(input: string | readonly string[]): ScenarioName[] {
  const raw = typeof input === 'string' ? input.split(',') : input
  const names = [...new Set(raw.map((s) => s.trim()).filter(isScenarioName))]
  return names.length ? names : ['default']
}

export function initScenarios(search: string = window.location.search): void {
  const fromUrl = new URLSearchParams(search).get('scenario')
  if (fromUrl !== null) {
    setScenarios(parseScenarioList(fromUrl))
    return
  }
  active = parseScenarioList(read<string[]>(SCENARIOS_KEY, ['default']))
  fired = new Set(read<string[]>(FIRED_KEY, []))
  sessionExpiredAt = read<number>(EXPIRED_AT_KEY, 0)
}

export function onScenarioChange(fn: (next: ScenarioName[], prev: ScenarioName[]) => void): void {
  listeners.add(fn)
}

export function setScenarios(names: readonly string[]): void {
  const prev = active
  const next = parseScenarioList(names)
  active = next
  fired = new Set()
  if (next.includes('session.expired') && !prev.includes('session.expired')) sessionExpiredAt = Date.now()
  write(SCENARIOS_KEY, next)
  write(FIRED_KEY, [])
  write(EXPIRED_AT_KEY, sessionExpiredAt)
  for (const l of listeners) l(next, prev)
}

export function getScenarios(): ScenarioName[] {
  return [...active]
}

export const isActive = (name: ScenarioName): boolean => active.includes(name)

/** True exactly once while the scenario is active (then it is disarmed until scenarios are set again). */
export function fireOnce(name: ScenarioName): boolean {
  if (!active.includes(name) || fired.has(name)) return false
  fired.add(name)
  write(FIRED_KEY, [...fired])
  return true
}

/** Sessions issued at or before this instant are expired while `session.expired` is active. */
export function expiredBefore(): number | null {
  return active.includes('session.expired') ? sessionExpiredAt : null
}
