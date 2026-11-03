# verify — 2026-11-03T23:55:37.448Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.8s | `npx tsc -b --noEmit` |
| lint | PASS | 8.7s | `npx eslint .` |
| build | PASS | 5.7s | `npx vite build` |
| e2e | PASS | 102.9s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 10.6s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 20.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
