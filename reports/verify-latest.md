# verify — 2026-11-04T17:11:47.433Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.6s | `npx tsc -b --noEmit` |
| lint | PASS | 13.4s | `npx eslint .` |
| build | PASS | 5.1s | `npx vite build` |
| e2e | PASS | 185.7s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 26.3s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 27.6s | `npx playwright test --grep @a11y --pass-with-no-tests` |
