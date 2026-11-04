# verify — 2026-11-04T19:42:51.231Z

Result: **RED**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.6s | `npx tsc -b --noEmit` |
| lint | PASS | 16.7s | `npx eslint .` |
| build | PASS | 4.6s | `npx vite build` |
| e2e | FAIL | 667.1s | `npx playwright test --grep-invert "@visual|@a11y"` |
