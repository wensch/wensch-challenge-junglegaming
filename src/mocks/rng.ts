/** Deterministic PRNG (mulberry32) and string hash (FNV-1a). Fixed seed => identical seed data on every run. */
export const SEED = 20260601

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Rng {
  /** float in [0,1) */
  next(): number
  /** int in [min,max] */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
  hex(length: number): string
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: <T,>(items: readonly T[]) => items[int(0, items.length - 1)] as T,
    chance: (p) => next() < p,
    hex: (length) => Array.from({ length }, () => int(0, 15).toString(16)).join(''),
  }
}
