# verify — 2026-11-04T17:52:12.790Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 6.8s | `npx tsc -b --noEmit` |
| lint | PASS | 12.3s | `npx eslint .` |
| build | PASS | 4.2s | `npx vite build` |
| e2e | PASS | 244.1s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 89.7s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 69.0s | `npx playwright test --grep @a11y --pass-with-no-tests` |
