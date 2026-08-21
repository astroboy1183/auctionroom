# Build Checklist

End-to-end task list. Tick items as they land; do not start a phase until the
previous gate passed. Gates marked 🧑 need the human to verify.

## Phase 0 — Skeleton + data + pipeline

- [x] `git init`, first commit, `gh repo create auctionroom` and push
- [x] Scaffold Vite + React 19 + TS (`npm create vite@latest`)
- [x] Tailwind v4 via `@tailwindcss/vite` plugin (CSS-first config, no tailwind.config.js)
- [x] Install: zustand, motion, react-router; dev: vitest
- [x] `npm run build` script runs `vitest run` before `vite build`
- [x] `src/engine/types.ts` — Player, Franchise, AuctionState, events, BotPersonality
- [x] `src/data/players.json` — 100 players: ~26 BAT / ~38 BOWL / ~21 AR / ~15 WK,
      ~38 overseas, base 30L–200L, ratings 60–100, tags, `setId` per CLAUDE.md §7
- [x] Data sanity test: distribution counts, unique ids, every setId maps to a set
- [x] Zustand store holding AuctionState
- [x] Page listing all 100 players from JSON
- [x] Cloudflare Pages: project created + deployed via `wrangler pages deploy` (D-010)
- [x] **GATE 🧑:** dev server serves all 100 players; auctionroom-bue.pages.dev serves the same bundle (verified 2026-08-21)

## Phase 1 — Engine (pure TS, no UI polish)

- [x] `rng.ts` — mulberry32 seeded PRNG (engine never calls Math.random)
- [x] `sets.ts` — 12 fixed sets, seeded within-set shuffle, set transitions
- [x] `bids.ts` — increment ladder (<100→+10, 100–500→+25, >500→+50), bid validation
- [x] `rules.ts` — squad caps (15 / 6 overseas), role minimums, reserve/soft-lock math
- [x] `auction.ts` — `applyEvent` reducer: START/BID/PASS/TICK/RESOLVE/NEXT_PLAYER
- [x] 10s timer via TICK events; reset on bid; expiry → RTM check → SOLD/UNSOLD
- [x] No-bid lots resolve in 4 ticks (pacing with a 100-player pool)
- [x] End condition: all squads full OR pool exhausted (~40 unsold is normal)
- [x] `rtm.ts` — RTM offer → one raise → match/decline; respects soft-lock
- [x] Accelerated round after Set 12 (6s timer, mandatory-unfilled roles only)
- [x] `scoring.ts` — Σ ratings + balance bonuses, missing-role penalty
- [x] Tests: increment ladder edges (99→100, 500→550)
- [x] Tests: soft-lock — bid rejected when budget-bid < reserve
- [x] Tests: squad validation incl. overseas cap
- [x] Tests: RTM paths (no card, declined, matched, raise-then-match)
- [x] Tests: full auction with 4 random bidders completes, all states legal
- [x] `/debug` route: auto-run a full random auction, dump log
- [x] **GATE 🧑:** `npm test` green; debug page completes a full auction

## Phase 2 — Bots

- [x] `valueEstimate(player, franchise)` — rating, role scarcity in remaining pool,
      unfilled needs, budget pressure
- [x] Personality modifiers: aggression, obsessions (+20% role / +15% tag), discipline
- [x] Hesitation gate (patience-driven, seeded)
- [x] Reaction delays: jittered by patience (~1s Shark … ~7s Accountant), seeded
- [x] Bot RTM decisions
- [x] The Shark / The Accountant / The Scout (random obsession per game, seeded)
- [x] Difficulty = aggression multiplier from lobby
- [x] Test: The Accountant never exceeds its value estimate
- [x] Test: no bot ever soft-locks
- [x] Test: 1000 seeded auctions → all squads valid, no errors
- [x] **GATE 🧑:** bots-only auction in debug page "feels like an auction"

## Phase 3 — Real UI

- [ ] Lobby: franchise picker (name + color), difficulty, Start
- [ ] Auction floor: player card (name/role/tags/base/stars), set banner
- [ ] 4 franchise panels: budget bar, squad count, needs, RTM cards — always visible
- [ ] BID (shows next increment) + PASS buttons; disabled states honor soft-lock
- [ ] Bid history ticker
- [ ] Timer ring, resets on bid; distinct final-3s "going once/twice" state
- [ ] RTM modal flow
- [ ] `motion`: bid pulse, paddle-flash on panels, hammer drop on SOLD
- [ ] Squad view tab: roster by role, spend, needs left
- [ ] Results: squads side by side, scores, winner, share-text copy button
- [ ] Responsive to 380px width
- [ ] **GATE 🧑:** full auction start→results on desktop AND phone browser

## Phase 4 — Juice + ship

- [ ] Auctioneer: pre-recorded stock phrases + Web Speech API for names/numbers
- [ ] Sounds via Howler: bid tick, hammer, crowd murmur — all behind a toggle
- [ ] Balance pass 1: bot difficulty across 3 lobby settings
- [ ] Balance pass 2: price inflation vs ₹90 Cr purse (pool base total is ~⅓ of purses)
- [ ] Balance pass 3: RTM card count (start 2, adjust by feel)
- [ ] Share-result text polish
- [ ] Production deploy verified at auctionroom.pages.dev
- [ ] **GATE 🧑:** a friend plays from the public URL with zero instructions

## Phase 5 (v1) — 3D auction hall

- [ ] Add `three` + `@react-three/fiber` + `@react-three/drei` as a lazy-loaded chunk
- [ ] Hall scene: stage, podium, 4 franchise tables, lighting, crowd backdrop
- [ ] Low-poly auctioneer model (GLB, Draco): idle / calling / going-once lean / hammer slam
- [ ] State bridge: animation + camera driven by engine phase (no engine imports of three)
- [ ] Player reveal on podium at NEXT_PLAYER; camera move on set transitions and SOLD
- [ ] Auctioneer animation synced to Phase 4 voice lines
- [ ] DOM UI overlays the canvas — bid buttons/panels/timer unchanged from v0
- [ ] Quality toggle (pixel ratio, shadows off) + renderer switch back to 2D mode
- [ ] Perf pass: 60fps desktop, playable on a mid-range phone; bundle check
- [ ] **GATE 🧑:** full 3D auction on desktop AND phone; 2D fallback still works

## Phase 6 (v2) — Multiplayer

- [ ] Extract `src/engine/` to a shared package consumed by app + worker
- [ ] Durable Object per room; same reducer is the authority
- [ ] Create/join by 6-char room code
- [ ] Per-connection franchise assignment; bots fill empty seats
- [ ] DO alarms drive TICK
- [ ] Reconnect: room code + token in sessionStorage
- [ ] Deploy worker to same Cloudflare account (same origin, no CORS)
- [ ] **GATE 🧑:** two humans on different networks complete an auction
