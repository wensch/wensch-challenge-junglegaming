# verify — 2026-11-04T11:52:03.441Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 4.5s | `npx tsc -b --noEmit` |
| lint | PASS | 7.7s | `npx eslint .` |
| build | PASS | 2.8s | `npx vite build` |
| e2e | PASS | 84.9s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 7.8s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 10.3s | `npx playwright test --grep @a11y --pass-with-no-tests` |
