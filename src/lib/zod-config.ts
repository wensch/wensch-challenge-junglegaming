/**
 * Global zod configuration, imported first by main.tsx (before mocks and app).
 * `jitless`: zod 4 probes `new Function` to JIT-compile object parsers. The production CSP has no
 * 'unsafe-eval' (vercel.json), so the probe would only produce a CSP violation report; the
 * interpreter path is used directly instead.
 */
import { z } from 'zod'

z.config({ jitless: true })
