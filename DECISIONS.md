# Decisions

Choices not covered by the original `CLAUDE.md`, per its §13 instruction.
Newest first. Each entry: what, why, and what it rules out.

---

## D-018 — Franchise voices: the benches call their own bids
**v1, 2026-08-21.** Each of the 8 franchises gets a distinct speaking voice —
a different system voice where the OS provides several, plus a distinct
pitch/rate pairing as the fallback — so the room sounds like eight sets of
people rather than one narrator. Bots call short lines when they bid ("Two
crore!", "We're in.", "Still here."), shout "Got him!" on a win, and claim
"He's one of ours" when triggering RTM.
**Collision handling:** team lines never interrupt (they queue behind the
auctioneer) and are rate-limited to one per 1.5s, so they interject around the
host instead of burying him. The auctioneer himself got a lower pitch (0.92),
marquee-player callouts, and occasional colour commentary during long wars
(max one per 9s).

## D-017 — The jumbotron is a canvas texture, not 3D text
**v1, 2026-08-21.** The board behind the auctioneer now shows live auction
data — set name, player name, role, star rating, tags, standing bid and the
leading franchise in its own colour, plus dedicated SOLD and UNSOLD states.
It is drawn with the ordinary 2D canvas API into a `THREE.CanvasTexture`,
**not** drei's `<Text>`: that would require fetching a font file, which breaks
the no-external-assets rule (D-013). Canvas also gives full typographic
control and costs one texture upload per state change, not per frame.
**Layout constraint worth remembering:** the auctioneer stands in front of the
lower-centre of this board, so the money block is right-aligned in the right
column and the name sits in the upper band. Anything readable placed at
canvas x 470–770, y > 300 will be hidden behind his head.

## D-016 — Broadcast-overlay layout: the centre of the screen belongs to the hall
**v1 polish, 2026-08-21.** First 3D pass kept the v0 2D layout (big centred
player card, wide franchise panel column, centred bid button) and it buried the
hall — the auctioneer sat directly behind the BID button. Rebuilt as a real
broadcast overlay: a 152px franchise **rail** down the left (colour bar, short
name, purse, slots), the player as a **lower-third banner** bottom-left, a
compact **money HUD** bottom-right holding timer + standing bid + BID/PASS, and
a bid ticker top-right. Everything is translucent with backdrop-blur and hugs
an edge; nothing occupies the middle.
**Also:** camera reframed to centre the podium in the cleared space, auctioneer
scaled 1.35× with a lower body and a taller podium in front (he was visibly
floating), volumetric spotlight cone over the stage, framed backdrop screen and
a gold stage lip, crowd arc widened to 1.15π so it frames the shot.
**Mobile:** the rail collapses to a horizontal scrolling strip under the header
and the lower-third/HUD stack — verified at 380px with no horizontal scroll.

## D-015 — All audio runs through a synthesized hall reverb
**v1 polish, 2026-08-21.** The first sound pass was raw oscillator beeps
(triangle blip, square-wave paddle, brown-noise crowd) and sounded like a
1980s toy. Rebuilt around a shared bus: every cue feeds a dry path plus a
**ConvolverNode whose impulse response is generated at runtime** (2.6s decaying
noise with early reflections), through a compressor.
**Cues are now struck tones** — stacked sine partials with soft attacks and
exponential tails, layered with filtered noise transients — instead of single
oscillators: a warm wooden knock for rival bids that **pitches up as the money
climbs**, a fuller bell for your own paddle, a rim-click clock that tightens in
the last three seconds, a gavel built from a hard crack over a resonant block,
and chord cues (RTM sting, set motif, winner fanfare) that arpeggiate in.
The crowd bed is two detuned noise layers with slow amplitude undulation.
**Why generated IR:** keeps the no-assets rule (D-011) while giving everything
a sense of room, which is what made the old set sound cheap.

## D-014 — Desperation override in the bidding brain
**v1, 2026-08-21.** When a player fills a mandatory role hole and the remaining
pool can no longer cover that deficit, bots ignore their value ceiling and bid
anyway (patience drops to zero, bid probability 0.92). The soft-lock guard in
`canBid` still bounds the actual spend, so this can't bankrupt anyone.
**Why:** with 8 teams chasing the same thin WK/AR supply, disciplined bots
politely passed themselves into invalid squads — mandatory minimums met fell to
79/96. With the override it's 95/96, and late-auction scarcity now produces
genuine panic-buying, which is exactly what real auctions look like.

## D-013 — The 3D hall is built from primitives, not GLB assets
**v1, 2026-08-21.** The spec called for a low-poly auctioneer GLB with Draco
compression. Shipped instead: every object — auctioneer, podium, eight tables,
paddles, instanced crowd — is three.js primitive geometry composed in code.
**Why:** no asset pipeline, no binary files in git, nothing to fetch at runtime,
and the whole hall still lazy-loads as one 235 KB gzipped chunk that never
touches the network beyond the JS itself. The stylised look is consistent with
the 2D UI.
**Rules out:** realistic character animation (no rig, no skinned mesh). Facial
expression and lip-sync are off the table; the auctioneer emotes through arm
motion and body sway.

## D-012 — Eight franchises, ₹120 Cr purses, 12-player squads
**User decision, 2026-08-21.** The league doubled from 4 to 8 teams and purses
rose from ₹90 Cr to ₹120 Cr (the real 2025 figure).
**Forced consequence:** 8 × 15 = 120 squad slots against a 100-player pool is
impossible, so `SQUAD_MAX` drops 15 → 12 (8 × 12 = 96 slots, a 4-player
surplus) and `OVERSEAS_MAX` scales 6 → 4. Mandatory minimums stay at
3/3/1/1 — now 8 of 12 slots, which *raises* tension per pick.
**Also:** bid ladder gains upper rungs (+100 above ₹10 Cr, +200 above ₹20 Cr)
so big-money wars don't crawl; `ratingValue` base rescaled 30 → 50 and
per-slot budget pressure re-normalised for the larger purses; RTM former-player
lists trimmed 4 → 3 each so RTM stays special across 8 teams.
**Measured after:** avg price ₹10 Cr (was ₹6.2 Cr), p90 ₹24 Cr, top sale
₹54 Cr, ~7 unsold per auction, 95/96 squads legal, 1000/1000 sims valid.

## D-011 — All sound is synthesized: WebAudio SFX + pure-TTS auctioneer
**Phase 4, 2026-08-21.** The spec named Howler.js and pre-recorded auctioneer
phrases; v0 ships with neither. Bid blips, the final-seconds clock, and the
gavel are synthesized with the WebAudio API (~60 lines, zero assets, zero
network), and the auctioneer is Web Speech API end-to-end — player names,
prices, "going once", "sold!". Preferring an `en-IN` voice when the OS has one.
**Why:** no audio assets keeps the static build tiny and the pipeline simple;
browser TTS quality is good enough for v0 and the toggle mutes it entirely.
**Deferred to v1:** pre-recorded stock phrases (per D-007) once there's an
asset pipeline for the 3D hall anyway. Howler stays out unless real audio
files arrive.

## D-010 — Pages deploys via wrangler direct upload, not dashboard Git-connect
**Phase 0, 2026-08-21.** The machine already had a logged-in wrangler OAuth
session, so the project was created and deployed entirely from the CLI —
no dashboard step needed. Trade-off: no automatic push-to-deploy; instead
`npx wrangler pages deploy dist` runs at each phase gate, which also means
nothing ships mid-phase by accident. `auctionroom.pages.dev` was taken
(global namespace), so the site lives at **auctionroom-bue.pages.dev**.
GH Actions + wrangler-action can restore push-to-deploy later if wanted.

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
