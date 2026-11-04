# verify — 2026-11-04T22:47:06.679Z

Result: **GREEN**

| step | status | time | command |
|---|---|---|---|
| typecheck | PASS | 8.0s | `npx tsc -b --noEmit` |
| lint | PASS | 14.3s | `npx eslint .` |
| build | PASS | 4.1s | `npx vite build` |
| e2e | PASS | 470.4s | `npx playwright test --grep-invert "@visual|@a11y"` |
| visual | PASS | 27.8s | `npx playwright test --grep @visual --pass-with-no-tests` |
| a11y | PASS | 52.4s | `npx playwright test --grep @a11y --pass-with-no-tests` |
