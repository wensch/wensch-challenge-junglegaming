# verify — 2026-11-03T20:46:29.576Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 6.1s | `npx tsc -b --noEmit` |
| lint | PASS | 6.0s | `npx eslint .` |
| build | PASS | 3.7s | `npx vite build` |
| e2e | PASS | 44.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 6.9s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 13.4s | `npx playwright test --grep @a11y --pass-with-no-tests` |
