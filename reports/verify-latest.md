# verify — 2026-11-04T21:11:41.220Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 9.2s | `npx tsc -b --noEmit` |
| lint | PASS | 16.7s | `npx eslint .` |
| build | PASS | 4.8s | `npx vite build` |
| e2e | PASS | 431.3s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 27.4s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 50.3s | `npx playwright test --grep @a11y --pass-with-no-tests` |
