/** Minimal logger: errors are always visible; warnings only in development. */
export const logger = {
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn(...args)
  },
}
