# verify — 2026-11-03T18:56:33.077Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 4.0s | `npx tsc -b --noEmit` |
| lint | PASS | 4.6s | `npx eslint .` |
| build | PASS | 2.4s | `npx vite build` |
| e2e | PASS | 8.5s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 4.1s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 4.0s | `npx playwright test --grep @a11y --pass-with-no-tests` |
