# verify — 2026-11-04T20:15:16.893Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.9s | `npx tsc -b --noEmit` |
| lint | PASS | 15.2s | `npx eslint .` |
| build | PASS | 4.1s | `npx vite build` |
| e2e | PASS | 409.0s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 27.6s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 49.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
