# verify — 2026-11-04T00:35:57.138Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 9.7s | `npx tsc -b --noEmit` |
| lint | PASS | 16.6s | `npx eslint .` |
| build | PASS | 5.9s | `npx vite build` |
| e2e | PASS | 131.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 15.5s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 21.2s | `npx playwright test --grep @a11y --pass-with-no-tests` |
