# verify — 2026-11-04T01:33:31.602Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 7.9s | `npx tsc -b --noEmit` |
| lint | PASS | 14.1s | `npx eslint .` |
| build | PASS | 4.9s | `npx vite build` |
| e2e | PASS | 137.6s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 13.6s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 20.8s | `npx playwright test --grep @a11y --pass-with-no-tests` |
