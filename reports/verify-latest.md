# verify — 2026-11-04T21:00:43.656Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 12.7s | `npx tsc -b --noEmit` |
| lint | PASS | 49.9s | `npx eslint .` |
| build | PASS | 20.2s | `npx vite build` |
| e2e | PASS | 662.1s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 40.5s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 70.8s | `npx playwright test --grep @a11y --pass-with-no-tests` |
