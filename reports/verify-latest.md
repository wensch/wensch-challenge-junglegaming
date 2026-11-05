# verify — 2026-11-05T09:58:42.976Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 5.9s | `npx tsc -b --noEmit` |
| lint | PASS | 11.3s | `npx eslint .` |
| build | PASS | 2.9s | `npx vite build` |
| e2e | PASS | 363.2s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 22.7s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 38.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
