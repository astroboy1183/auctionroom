# Decisions

Choices not covered by the original `CLAUDE.md`, per its §13 instruction.
Newest first. Each entry: what, why, and what it rules out.

---

## D-009 — 100-player pool for 60 squad slots
**User decision, 2026-08-21.** Pool grows from 60 to ~100. The original 60 was
exactly 4 × 15 squad slots — zero surplus, so every unsold player mathematically
shorted a squad and passing was always painful. Real auctions are the opposite:
large surplus, most players unsold, and passing ("someone cheaper is coming")
is the core skill. 100 players restores that dynamic at ~15–20 min of play.
**Consequences:** 12 sets instead of 10 (WK II, Spinners II added; Uncapped
set enlarged); auction ends when all squads are full or pool is exhausted;
no-bid lots resolve in 4 ticks to protect pacing; ~38 overseas for 24 sellable
overseas slots — overseas surplus going unsold is realistic.
**Rules out:** the full ~400-player realistic list (1.5–2h sessions) — rejected
for game length, not authenticity.

## D-008 — v0 ships 2D; v1 is the 3D upgrade; multiplayer moves to v2
**User decision, 2026-08-21.** Version roadmap re-cut: v0 = complete 2D solo
game (unchanged scope), v1 = 3D auction hall presentation, v2 = multiplayer
(everything previously labelled v1).
**Why this order:** 2D proves the game is fun before any asset work; 3D makes
it spectacular before friends are invited into it. The two upgrades are
independent — 3D touches only presentation, multiplayer touches only the engine
host — so re-sequencing costs nothing architecturally.
**v1 shape:** react-three-fiber scene (stage, podium, franchise tables, low-poly
auctioneer character with idle/calling/going-once/hammer-slam states synced to
the voice) rendered *behind* the DOM UI. Buttons, panels and timer stay DOM —
3D is a stage, not a UI framework. Quality toggle; the finished 2D renderer is
kept as a fallback mode, which it can be for free since it ships first.
**Rules out:** rebuilding game UI as 3D meshes, and heavyweight realistic
character art — low-poly stylized only, GLB + Draco, lazy-loaded chunk.

## D-007 — Auctioneer voice via Web Speech API, hybrid with pre-recorded VO
**Phase 4.** Browser `SpeechSynthesis` costs nothing and needs no backend, but
voice quality varies by OS and the `en-IN` voice isn't guaranteed. So: pre-record
the ~40 stock phrases ("going once", "sold to", "no bids") as audio assets, and
use TTS only for player names and numbers.
**Rules out:** a paid TTS API in v0 — that would need a backend and break the
static-site goal. Revisit for v1, where a server already exists.

## D-006 — Accelerated round for unsold players
**Phase 1.** Real auctions give unsold players a second pass. Without it, a
franchise that misses on keepers early can be mathematically unable to field a
legal squad. Runs after Set 10, 6-second timer, only players whose role is still
mandatory-unfilled somewhere.
**More tense/fun because:** it's a last-chance scramble with thin purses.

## D-005 — Right to Match, 2 cards per franchise
**Phase 1.** The single most dramatic mechanic in the real auction, and it's
pure engine work — no infrastructure cost. Flow: former franchise offered the
match → original winner may raise once → former franchise matches or declines.
**Open question:** 2 cards is a guess. Balance-pass it in Phase 4.

## D-004 — Auction sets instead of a flat role-interleaved shuffle
**Phase 1.** The original spec said "shuffled, role-interleaved order." Real
auctions run in ordered sets, and sets are strategically richer: knowing a
second batch of batters is still coming creates the spend-now-or-wait tension
the spec names as its vibe target. Ten fixed sets, seeded shuffle within each.
**Rules out:** the flat shuffle. `Player` gains a `setId`.

## D-003 — Bots get jittered, personality-driven reaction delays
**Phase 2.** If bots decide instantly the 10-second timer is decorative and the
auction feels like arithmetic. Delay is derived from `patience` and drawn from
the seeded RNG, never `Math.random`.

## D-002 — Engine is a pure seeded reducer that does not own time
**Phase 1.** Three linked constraints, written up as invariants in `CLAUDE.md`
§4: `applyEvent(state, event) → state`; no `setInterval` in `engine/`, the clock
advances only on `TICK`; no `Math.random()`, a mulberry32 seed instead.
**Why:** the spec already demands the engine run unchanged on the v1 server. A
reducer is the only shape that satisfies that *and* makes 1000-auction test
sweeps fast and reproducible. A failing sim is debuggable by seed.
**Rules out:** a stateful engine class, and any React-driven timing inside the
engine.

## D-001 — Deploy to Cloudflare Pages, not jayanthappalla.com
**Phase 0.** The original spec's Phase 4 named "a custom path on
jayanthappalla.com." The user explicitly overrode this — the game should not
live on their personal site.
**Also rules out** GitHub Pages under `astroboy1183`: that account's user site
carries the custom domain, so every Pages project repo inherits
`jayanthappalla.com/<repo>` and can't opt out.
**Why Cloudflare specifically:** same platform as Durable Objects, so v1
multiplayer becomes one deploy on one origin instead of a separate backend host
plus CORS. Free tier covers all of this.
