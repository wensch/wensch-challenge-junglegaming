# verify — 2026-11-05T11:37:54.566Z

Result: **RED**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.8s | `npx tsc -b --noEmit` |
| lint | PASS | 13.3s | `npx eslint .` |
| build | PASS | 3.4s | `npx vite build` |
| e2e | FAIL | 623.6s | `npx playwright test --grep-invert "@visual|@a11y"` |
