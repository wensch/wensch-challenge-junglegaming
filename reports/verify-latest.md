# verify — 2026-11-04T17:18:34.795Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 14.0s | `npx tsc -b --noEmit` |
| lint | PASS | 17.6s | `npx eslint .` |
| build | PASS | 4.2s | `npx vite build` |
| e2e | PASS | 190.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 22.5s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 41.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
