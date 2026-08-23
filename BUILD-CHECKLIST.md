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

- [x] Lobby: franchise picker (name + color), difficulty, Start
- [x] Auction floor: player card (name/role/tags/base/stars), set banner
- [x] 4 franchise panels: budget bar, squad count, needs, RTM cards — always visible
- [x] BID (shows next increment) + PASS buttons; disabled states honor soft-lock
- [x] Bid history ticker
- [x] Timer ring, resets on bid; distinct final-3s "going once/twice" state
- [x] RTM modal flow
- [x] `motion`: bid pulse, paddle-flash on panels, hammer drop on SOLD
- [x] Squad view tab: roster by role, spend, needs left
- [x] Results: squads side by side, scores, winner, share-text copy button
- [x] Responsive to 380px width
- [x] **GATE 🧑:** full auction start→results on desktop AND phone browser

## Phase 4 — Juice + ship

- [x] Auctioneer: Web Speech API end-to-end (pre-recorded phrases deferred to v1, D-011)
- [x] Sounds: WebAudio-synthesized bid blip, final-seconds clock, gavel — behind a toggle (D-011)
- [x] Balance pass 1: difficulty spread 594/620/648L avg (easy/normal/hard), wallets loosen on hard
- [x] Balance pass 2: avg 620L, p90 1700L, max ~₹40 Cr, purses ~97% spent — auction-like
- [x] Balance pass 3: 2 RTM cards kept; former players 4/team → ~1+ RTM moment per game
- [x] Share-result text polish
- [x] Production deploy verified at auctionroom-bue.pages.dev
- [ ] **GATE 🧑:** a friend plays from the public URL with zero instructions

## Phase 5 (v1) — 3D auction hall

- [x] Add `three` + `@react-three/fiber` as a lazy-loaded chunk (drei not needed)
- [x] Hall scene: lit stage, podium, 8 franchise tables, instanced crowd (180 figures)
- [x] Auctioneer built from primitives (D-013): idle sway, gavel raised on bid, slam on SOLD
- [x] State bridge: per-frame store reads drive animation + camera; engine never imports three
- [x] Camera pushes in as the clock closes and on SOLD; paddles raise for the leading team
- [x] Auctioneer animation synced to engine phase (and therefore the voice lines)
- [x] DOM UI overlays the canvas — bid buttons/panels/timer unchanged from v0
- [x] Capped DPR (1–1.75), no shadows; 🏟 toggle switches back to the 2D renderer
- [x] Bundle check: main 130 KB gzip unchanged, hall a separate 235 KB lazy chunk
- [ ] **GATE 🧑:** full 3D auction on desktop AND phone; 2D fallback still works

## v1 extras (beyond the original Phase 5 scope)

- [x] 8 franchises, ₹120 Cr purses, 12-player squads, overseas cap 4 (D-012)
- [x] Bid ladder extended: +100 above ₹10 Cr, +200 above ₹20 Cr
- [x] 7 bot personalities — Gambler, Professor, Showman, Vulture added
- [x] Desperation override so thin roles get fought over (D-014)
- [x] Crowd bed: looped brown-noise murmur that swells on big bids
- [x] Interaction SFX: paddle thwack on your bid, whoosh on pass, RTM sting,
      set-change motif, winner fanfare
- [x] Auctioneer calls big money live ("nine crore!") over the crowd
- [x] Broadcast-overlay layout: edge-hugging UI, hall visible in the centre (D-016)
- [x] Hall polish: standing auctioneer, spotlight cone, framed screen, stage lip
- [x] Audio rebuilt on a convolution-reverb bus; struck-tone cues (D-015)
- [x] Live jumbotron on the board behind the host (D-017)
- [x] 16 seated bidders — two per bench in team colours, lean in when leading
- [x] Host speaks more: marquee callouts, set intros, colour commentary
- [x] Eight franchise voices calling their own bids (D-018)
- [x] Outbid feedback: sour cue, rail shake, toast (D-022)
- [x] Board tags cleared of the auctioneer; readable gavel + strike block
- [x] Bench front fill light + team underglow; crowd vertex colours + rim light
- [x] Floor carpet and tightened bench arc; rail widened
- [x] Lobby and results render inside the hall, idle-mounted after first paint
- [x] Fix hardcoded "of 4" / "12/15" caps left over from the 4-team era
- [x] Pre-auction shortlist with ceilings, target strip, over-plan warning (D-024)
- [x] Retentions: 2 per franchise from outside the pool, purse ladder, lobby preview (D-025)
- [x] Post-auction round-robin tournament decides the title (D-026)
- [ ] **GATE 🧑:** play a full 8-team auction in the 3D hall with sound on

## Phase 6 (v2) — Multiplayer

- [x] Engine shared as-is between browser and worker (purity rule paid off)
- [x] Cloudflare Durable Object per room; same reducer is the authority
- [x] Create/join by 6-char room code (`getByName` routing)
- [x] Per-connection franchise assignment; bots fill every empty seat
- [x] DO alarms drive TICK, bot actions, interstitials and RTM timeouts
- [x] Reconnect: room code + token in sessionStorage reclaims your seat
- [x] Deployed to auctionroom-rooms.jayanthapalla.workers.dev
- [x] Room lobby: share code/link, live seat list, host-only start
- [x] **GATE 🧑:** two humans on different networks complete an auction
