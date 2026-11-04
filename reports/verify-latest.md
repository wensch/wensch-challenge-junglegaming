# verify — 2026-11-04T19:55:31.736Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 9.8s | `npx tsc -b --noEmit` |
| lint | PASS | 16.2s | `npx eslint .` |
| build | PASS | 3.8s | `npx vite build` |
| e2e | PASS | 501.8s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 47.9s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 115.6s | `npx playwright test --grep @a11y --pass-with-no-tests` |
