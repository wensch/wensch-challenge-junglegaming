# verify — 2026-11-04T19:56:33.585Z

Result: **RED**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 25.8s | `npx tsc -b --noEmit` |
| lint | PASS | 62.6s | `npx eslint .` |
| build | PASS | 32.0s | `npx vite build` |
| e2e | FAIL | 568.7s | `npx playwright test --grep-invert "@visual|@a11y"` |
