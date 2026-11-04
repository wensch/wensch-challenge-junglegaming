# verify — 2026-11-04T01:10:02.150Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 5.9s | `npx tsc -b --noEmit` |
| lint | PASS | 12.9s | `npx eslint .` |
| build | PASS | 4.9s | `npx vite build` |
| e2e | PASS | 117.5s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 13.7s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 19.4s | `npx playwright test --grep @a11y --pass-with-no-tests` |
