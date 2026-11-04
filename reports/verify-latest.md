# verify — 2026-11-04T00:29:43.687Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.1s | `npx tsc -b --noEmit` |
| lint | PASS | 13.6s | `npx eslint .` |
| build | PASS | 5.0s | `npx vite build` |
| e2e | PASS | 101.9s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 12.2s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 17.9s | `npx playwright test --grep @a11y --pass-with-no-tests` |
