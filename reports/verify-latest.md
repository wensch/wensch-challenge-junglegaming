# verify — 2026-11-04T22:58:33.921Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 9.7s | `npx tsc -b --noEmit` |
| lint | PASS | 16.2s | `npx eslint .` |
| build | PASS | 4.4s | `npx vite build` |
| e2e | PASS | 497.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 28.7s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 54.8s | `npx playwright test --grep @a11y --pass-with-no-tests` |
