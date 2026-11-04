# verify — 2026-11-04T17:53:28.318Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.7s | `npx tsc -b --noEmit` |
| lint | PASS | 115.3s | `npx eslint .` |
| build | PASS | 23.3s | `npx vite build` |
| e2e | PASS | 274.1s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 22.8s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 37.2s | `npx playwright test --grep @a11y --pass-with-no-tests` |
