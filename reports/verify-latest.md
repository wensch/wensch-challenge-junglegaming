# verify — 2026-11-04T18:00:06.563Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.5s | `npx tsc -b --noEmit` |
| lint | PASS | 14.6s | `npx eslint .` |
| build | PASS | 4.2s | `npx vite build` |
| e2e | PASS | 246.5s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 22.6s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 36.7s | `npx playwright test --grep @a11y --pass-with-no-tests` |
