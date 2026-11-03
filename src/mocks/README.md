# src/mocks — simulated backend (MSW)

The only place with fictitious data. Nothing outside `src/mocks` imports from here except `src/main.tsx`,
which loads this layer through a dynamic `import()` (own chunk) when `VITE_ENABLE_MOCKS=true`
(on in dev, preview and the demo build). Tests talk to it only through `window.__mock`.

## Fictitious credentials (never real)

| User | E-mail | Password | Notes |
|---|---|---|---|
| Alice (`usr_001`) | `alice@example.test` | `Senha@123` | 2 wallets (`wal_001` primary, `wal_002` secondary), 3 favorites, 2 confirmed orders |
| Bob (`usr_002`) | `bob@example.test` | `Senha@456` | 1 wallet (`wal_003`), 1 order (`ord_0003`) — used to test FORBIDDEN / event isolation |

Coupons: `WELCOME10` (10 %, valid), `LANCAMENTO` (0.05 ETH, valid), `BLACK2024` (expired), anything else is invalid.
Network fees: ethereum `0.0021`, polygon `0.0003`, solana `0.00005` ETH.

## Data & persistence

- Seed: fixed PRNG seed (`rng.ts`) and fixed base date => identical on every run. 60 NFTs (`nft_001..nft_060`), 9 categories, editions 1/1, 1/10, 1/50 and open, 7 sold out, some on sale.
- Images: `public/nft/*.png` (copied from `design/assets`), no external URLs.
- DB lives in memory and is saved to `localStorage["mock:db:v1"]` after every mutation (bump `DB_VERSION` in `db.ts` to invalidate). Scenarios: `mock:scenarios` (+ `mock:scenarios:fired`).
- Passwords: `SHA-256(salt ":" password)` via WebCrypto, per-user salt. Tokens are opaque (`tok_` + 24 random bytes), only their SHA-256 is stored; lifetime 8 h; expiry is simulated by scenarios.
- Ids come from persisted counters (`ord_0004`, `evt_000012`, ...).

## Selecting scenarios

`?scenario=a,b` (persisted) · `localStorage["mock:scenarios"]` · `window.__mock.setScenarios([...])`.
`window.__mock.reset()` restores the seed and `default`. The catalog is `SCENARIOS` in `src/api/contracts/scenarios.ts`.

`window.__mock` = `MockControl`: `reset`, `setScenarios`, `getScenarios`, `emit(event, payload, { userId? })`, `updateNft`, `drop`, `settleOrder`.

## Layout

| File | Role |
|---|---|
| `browser.ts` | `startMocks()`: scenarios -> DB -> worker -> `window.__mock` |
| `http.ts` | `route(endpointName, handler)`: scenarios, auth, contract validation of input and output, `errorBody()` |
| `handlers/*` | one handler per entry of the `endpoints` table (31) + `/api/*` 404 fallback |
| `catalog.ts` `cart.ts` `quote.ts` `orders.ts` | domain logic; `mutateNft`/`mutateOrder` are the only mutation paths and always emit `nft.updated`/`order.updated` |
| `realtime.ts` | `ws.link(VITE_SOCKET_URL)` (bare origin), heartbeat `'2'` every 20 s, token read from raw `40{...}` frame, owner-scoped delivery |
| `latency.ts` `scenario-state.ts` `timers.ts` | latency (fixed / seeded variable / out-of-order), active scenarios + one-shot flags, cancellable timers |
| `control.ts` | `window.__mock` |

## Behaviour notes

- Orders: `Idempotency-Key` (UUID) required. Same key + same body => same order (200); other body => 409 `IDEMPOTENCY_CONFLICT`. Stock is reserved on creation (and released if declined); the order starts `pending` and settles after 1500 ms (`payment.*`). Pending orders resume after a reload.
- Availability problems (`CONFLICT_AVAILABILITY`) are checked before quote staleness (`QUOTE_STALE`).
- `session.expired` expires every session issued before the scenario was activated; a new login works.
- `*.once`-style scenarios (`http.500.once`, `session.expire-on-checkout`, `order.timeout-after-create`, `checkout.*`) fire once and are re-armed by calling `setScenarios` again.
- `checkout.price-changed` / `checkout.sold-out` change the catalog 400 ms AFTER the first `POST /quotes` answered, emitting `nft.updated`.
