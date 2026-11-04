# verify — 2026-11-04T19:05:24.714Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.7s | `npx tsc -b --noEmit` |
| lint | PASS | 15.3s | `npx eslint .` |
| build | PASS | 4.3s | `npx vite build` |
| e2e | PASS | 363.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 27.8s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 53.6s | `npx playwright test --grep @a11y --pass-with-no-tests` |
