# verify — 2026-11-05T00:53:48.338Z

Result: **RED**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 13.1s | `npx tsc -b --noEmit` |
| lint | PASS | 23.8s | `npx eslint .` |
| build | PASS | 3.7s | `npx vite build` |
| e2e | FAIL | 741.5s | `npx playwright test --grep-invert "@visual|@a11y"` |
