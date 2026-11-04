# verify — 2026-11-04T21:00:27.228Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 11.7s | `npx tsc -b --noEmit` |
| lint | PASS | 22.3s | `npx eslint .` |
| build | PASS | 7.0s | `npx vite build` |
| e2e | PASS | 696.2s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 42.3s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 89.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
