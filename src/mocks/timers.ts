/** Deferred side effects of scenarios; all cancelled on reset so they never leak into a fresh DB. */
const pending = new Set<ReturnType<typeof setTimeout>>()

export function later(fn: () => void, ms: number): void {
  const t = setTimeout(() => {
    pending.delete(t)
    fn()
  }, ms)
  pending.add(t)
}

export function clearLater(): void {
  for (const t of pending) clearTimeout(t)
  pending.clear()
}
