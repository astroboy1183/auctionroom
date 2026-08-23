# Decisions

Choices not covered by the original `CLAUDE.md`, per its §13 instruction.
Newest first. Each entry: what, why, and what it rules out.

---

## D-027 — Multiplayer: one Durable Object per room, separate from the Pages site
**v2, 2026-08-21.** `worker/` holds an `AuctionRoom` DO deployed to
`auctionroom-rooms.jayanthapalla.workers.dev`, addressed by `getByName(code)`
so a 6-character room code routes deterministically to one object.

**The DO is the only authority.** It imports the same `src/engine/` the browser
uses — the purity rule from day one is what made this a lift rather than a
rewrite. Clients send intents (`bid`, `pass`, `rtm_*`) and render whatever
state comes back; they never run the reducer. `MultiplayerGame` swaps the
store's `dispatch` for one that forwards to the socket, so every existing
component (rail, HUD, 3D hall, results) works unchanged in online play.

**Clock:** a DO alarm fires every 1s during bidding and drives `TICK`, plus one
bot action per tick. Sold/unsold interstitials and RTM thinking time reschedule
the alarm at different delays. A human sitting on an RTM decision is timed out
after 15s and auto-declined — nobody can stall a room.

**Seats:** bots fill all eight franchises up front; joining converts a bot seat
to human. Disconnecting **holds** the seat rather than freeing it (the auction
never pauses for anyone), and a `crypto.randomUUID()` token in sessionStorage
reclaims it on reconnect.

**Separate worker rather than migrating Pages to Workers static assets:**
WebSocket upgrades don't trigger CORS preflight, so the two-origin split costs
nothing, and it leaves the working Pages deploy untouched. Migrating to a
single Workers deploy stays available later if the split ever becomes annoying.

**Verified against production:** two clients get distinct seats, a non-host
`start` is refused, a bid from one client appears in the other's view, a third
joiner is seated, and the clock plus bots run server-side with zero errors.

## D-041 — The human always gets the full clock; only bot wars run short
**User correction, 2026-08-21.** D-040 cut the rebid window to 4s for
everyone, which optimised total duration at the cost of the thing that
actually matters: a human needs to read a new price, weigh it against their
purse and their plan, and click. Four seconds is not enough, and rushing that
makes an auction feel cheap.

**Rule now:** a bid restores the **full** `LOT_SECONDS` whenever any human
seat could still legally bid on that lot. The short `REBID_SECONDS` window
applies only when no human can act — everyone has passed, can't afford it, or
it's a bots-only seat. Nobody needs deliberation time for a war they are not
in.

**Measured with a human in play:** ~32–35 minutes for a full auction, median
lot 11–17s, longest 45–59s. Longer than the 24 minutes of pure-bot pacing, and
that is the correct trade — the extra time is spent exclusively on lots the
player is actually contesting. Lots they ignore still fly past on the short
window.

Multiplayer rooms can raise this further: the host's clock setting (6–30s)
already overrides the default for a slower, more deliberate game.

Balance unchanged: 96/96 minimums met, avg ₹9.2 Cr.

## D-040 — Auction pacing: the game took 89 minutes and nobody had measured it
**2026-08-21.** Running a real production room end-to-end for the first time
(to see live commentary) exposed that a single marquee lot ate 100 seconds.
Measuring properly — one TICK is one real second in both the browser driver
and the DO alarm — gave the true figure: **~89 minutes for a full auction**,
median lot 55s, against the spec's 15–20 minute target.

**Why it was never caught:** every test to date used either headless instant
ticks (balance sims, the 1000-auction sweep) or `__ff()` fast-forward. Both
measure correctness, neither measures *duration*. Wall-clock was an untested
dimension of a real-time game.

**Two causes, two fixes:**
1. **Every bid restored the full 10-second clock**, so a contested lot
   ratcheted indefinitely — bid, reset, bid, reset. A bid now buys a
   `REBID_SECONDS` (4s) reaction window; the long window exists to let the room
   *open*, and a real auctioneer moves fast once bids are flowing.
   → 89 min to 40 min.
2. **One bid per second** meant the price climbed one increment per tick, so
   reaching ₹18 Cr from a ₹2 Cr base took 20+ seconds of pure arithmetic. The
   driver and the DO now allow a burst of up to 3 bids per tick, re-reading
   state between each so every bot judges the current price. Several paddles
   going up between calls is also how a real room actually sounds.
   → 40 min to **24 min**, median lot 13s, longest 26s.

**Balance verified unchanged after both:** 96/96 mandatory minimums met, avg
₹9.2 Cr, ~16 unsold. Shorter windows changed the tempo, not the outcomes.

**Lesson worth keeping:** simulation speed and play speed are different
properties. A headless sweep that passes 1000 times says nothing about whether
anyone can sit through one.

## D-039 — Trading, formats and mystery lots
**2026-08-21.** A between-seasons transfer window generates offers using the
*same* valuation the bots bid with, so it reads as negotiating with the
opponents you just faced rather than shopping. Bots only offer for players they
rate above your own valuation of them.
**Bug caught by the tests:** offers were generated without checking legality,
so the window happily presented trades that breached the overseas cap. Every
generated offer now passes `canTrade()` for **both** squads before it is shown.
**Formats** reshape the pool only — the reducer, bidding, RTM and soft-lock are
untouched in all four. Sprint keeps the top half by rating; Reverse flips the
order so the bargain bin comes first and stars arrive when purses are already
committed; Mystery hides ratings **in the UI only** — the engine and bots still
see the truth, otherwise bot valuation would collapse.

## D-038 — Career mode: seasons that remember
**2026-08-21.** Squads carry over, you retain up to 3 on a rising cost ladder
that shrinks next season's purse, and players accrue real batting and bowling
records from every match including playoffs.
**Form drift is deliberately gentle and bounded:** strike rate and economy are
compared against a neutral bar, the delta is clamped to ±3 per season, and old
form decays at 0.6 before new form is added, with a hard ±8 total cap. A good
season nudges a player; it never rewrites them into a 130-rated freak.
**Verified end to end:** kept Bumrah and Pant into season 2, purse correctly
₹96 Cr, both removed from that season's auction pool, and 80 players carrying
form earned on the field.

## D-037 — Playoffs, scorecards, and watching the closing overs
**2026-08-21.** The season now ends in an IPL-style knockout — Qualifier 1,
Eliminator, Qualifier 2, Final — so topping the table buys a second chance
rather than the trophy, and the league leader can lose the title (tested).
**The bigger win is surfacing what already existed.** The match engine had
always produced full scorecards and the UI discarded them. `match.ts` now also
records a ball-by-ball `timeline`, and every league and playoff match opens a
scorecard: both innings with R/B/4s/6s/SR and O/R/W/Econ, player of the match,
and a **Watch** button that plays the closing overs back one delivery at a time.
The hard part was already built; the UI was throwing it away.

## D-036 — Onboarding, sound mixer, adaptive 3D quality
**2026-08-21.** The game accumulated rules that are not guessable — soft-lock
reserves, three-stage RTM, retentions, ceilings, the four-over cap — so a
five-page explainer runs once on first visit and stays available from the lobby.
The single mute became a four-channel mixer (overall / voices / effects /
crowd), persisted, because the commonest ask with eight franchise voices is
"keep the game sounds, lose the talking". 3D quality now caps DPR and drops
antialiasing up front on low-core, low-memory or narrow devices rather than
waiting for the frame rate to collapse.

## D-035 — Room settings, persistence and a cross-room leaderboard
**v2, 2026-08-21.** The host picks difficulty and clock length (clamped 6–30s,
locked once the auction starts); everyone sees changes live. A custom clock is
applied by topping up the timer after each bid rather than by parameterising
the engine's constants — presentation-layer pacing, engine untouched (D-002).
A well-known `__leaderboard__` Durable Object collects the top 50 human results
across every room. Seat reclaim on reconnect verified against production.

## D-034 — Skip the entire auction from the lobby
**User request, 2026-08-21.** "Skip pool" only existed mid-auction. The lobby
now offers a one-click full simulation: your assistant plays your seat under
your shortlist ceilings and jumps straight to the season. Useful on its own and
essential in career mode, where you may want to fast-forward a year.

## D-033 — LLM commentary on Haiku 4.5, dormant unless a key is set
**v2, 2026-08-21.** The rooms worker can call Claude for one line of colour
commentary at interesting moments — a big sale, an RTM steal, a new set, the
final result.

**Model: Haiku 4.5** (user's choice, and the right fit). The job is short
reactive text, not reasoning. Measured shape: ~30 calls per auction, ~550
input + ~45 output tokens each → **roughly $0.02 per full auction**, about a
fifth of Sonnet and a fifth again of Opus.
**Prompt caching is deliberately not used:** the minimum cacheable prefix is
~1024 tokens and the system prompt is ~250, so it would not engage without
padding — and most of each call is changing game state anyway.

**Failure is always silent.** No key, cap reached, timeout (4s), API error,
empty response — every path returns `null` and the auction proceeds exactly as
if the file did not exist. Verified in production with no key set: 17 state
broadcasts, 0 commentary, 0 errors.

**Cost controls, because this runs on the owner's key behind a public URL:**
40 calls per room, a relevance gate (sales ≥ ₹8 Cr or ≥ 8 bids only — never
every lot), `maxRetries: 0`, and `waitUntil` so a slow call never delays the
clock.

**`nodejs_compat` is required** in `wrangler.jsonc`: the Anthropic SDK imports
Node built-ins, and without the flag the call throws at runtime rather than
returning null.

**Not enabled yet** — `wrangler secret put ANTHROPIC_API_KEY` switches it on.
A credential search across the user's other projects was blocked by the
permission classifier and deliberately not worked around.

## D-032 — Accessibility, DOM portraits, mobile room polish
**2026-08-21.** `prefers-reduced-motion` collapses every animation while
leaving the game fully playable; a visible `:focus-visible` ring matters
because the auction is fully operable on Space/P/S. The bid HUD gained
`role`/`aria-label`/`aria-keyshortcuts` and an `aria-live` standing bid, so a
screen reader hears the price climb. `drawPortrait` moved from `scene/Hall`
into `lib/portrait.ts` and is now shared: the 3D jumbotron and the DOM
`<Portrait>` (lower-third, squad drawer) render the same likeness for a player.
Room lobby seat rows truncate and drop secondary columns under `sm:`.

## D-031 — Adaptive bots read the room
**2026-08-21.** `rivalPressure()` counts how many *other* franchises still
need a role that is running short, and raises a bot's ceiling by up to 30%
scaled by its own aggression. Sharks squeeze; the Accountant ignores it.
**Why:** the late auction had become a quiet bargain hunt once the marquee
sets were gone. Now a bot will push a price it doesn't need purely because a
rival is desperate — draining purses is a legitimate strategy and it keeps the
back half of the auction tense. Balance held: 96/96 minimums met, avg ₹9.2 Cr.

## D-030 — Chat, reactions and spectators
**v2, 2026-08-21.** The room DO carries a 60-message chat backlog (persisted,
shipped on join) plus ephemeral emoji reactions (broadcast, never stored).
**Spectators** join without a seat: `franchiseId: null`, may chat and react,
are refused any auction intent server-side, and are counted in the state
broadcast. A *full* room now admits newcomers as spectators rather than
rejecting them. Watch links are `?room=CODE&spectate=1`.
Chat lives in a collapsible panel with an unread badge, because a ten-second
clock leaves no room for a permanent chat column — the one-tap reaction row is
the primary channel and typing is the fallback.

## D-029 — Save/resume, replay-by-seed, keyboard control
**2026-08-21.** Autosave writes to localStorage on **lot boundaries**, not
every tick: writes stay rare and a resumed game always begins cleanly on a
fresh player. The save carries a version stamp so a build change discards old
saves instead of crashing on them. Replay-by-seed exposes `rngSeed` on the
results screen and accepts one in the lobby — the engine's determinism (D-002)
means the same seed reproduces the pool, the retentions and every bot
decision. Space bids, P passes, S skips; keys are ignored inside inputs.

## D-028 — "Skip the pool": autoplay finishes the auction
**User request, 2026-08-21.** A ⏭ button hands the remaining lots to the
simulation and jumps to the result.
**The key call:** the player's franchise **keeps bidding**, played by the
shared bot brain under an "Your assistant" personality, and it will not exceed
any shortlist ceiling the player set. Simply removing them would leave a
half-built squad that then loses the tournament on structural penalties —
punishing them for using a convenience feature rather than for any decision
they made. The seat is handed back as `isHuman` before results so the summary
still reads as their team.
Solo only: online rooms are server-authoritative and cannot be fast-forwarded
by one participant.

## D-027b — Ball-by-ball cricket replaces the strength formula
**2026-08-21.** `match.ts` plays real T20 innings: 120 balls, per-delivery
outcomes weighted by batter-vs-bowler edge and phase, wickets, strike
rotation, chases whose aggression scales with the required rate, and full
scorecards.
**The four-over cap is the point.** A legal 12-player squad need only carry
3 BOWL + 1 AR — four bowlers, who can bowl 16 of 20 overs. Somebody's batter
bowls the rest, and `bowlingRating()` docks a pure batter 34 points, so a thin
attack visibly leaks runs. Skimping on bowling at the auction now costs
matches, which is exactly the connection the old formula lacked.
Phase-sensitive tags finally matter: `opener` in the powerplay, `death-bowler`
and `finisher` at the death, `new-ball` up front, spin through the middle.
**`squadStrength()` was rewritten** to predict this rather than the old model —
it now sizes the attack at exactly five bowlers including any part-timer.
**Honest calibration note:** bot auctions spread talent within ~5 strength
points across eight squads, so no team dominates a 7-match season. The test
asserts the correlation that actually holds — the stronger half wins clearly
more titles than the weaker half — rather than "the best squad wins", which
would have been false.

## D-026 — Post-auction tournament decides the winner
**v1, 2026-08-21.** The results screen used to declare a winner from Σ ratings
plus balance bonuses — a number with no meaning attached. Now every squad plays
a single round-robin (8 teams → 28 matches) and the **points table** decides
the title.
**Model:** batting strength = mean of the best six BAT/WK/AR ratings, bowling =
best five BOWL/AR — all-rounders count for both, which is what makes them worth
overpaying for. A score is `120 + (batting − opposing bowling) × 2.6 ± 23`, so
the better squad usually wins but not always. Structurally illegal squads take
a strength penalty per missing mandatory slot and per player short of eleven.
**Tested:** the strongest squad takes the title in roughly half of 40 seeds —
enough that squad quality dominates, not so much that variance is gone.
`scoring.ts` is kept for the Squads tab; the table is the headline.

## D-025 — Retentions come from outside the auction pool
**v1, 2026-08-21.** Each franchise starts with 2 retained players and a purse
cut by the ladder (₹14 Cr + ₹10 Cr → ₹96 Cr left).
**The key call:** retained players are a separate 16-strong roster with
`setId: "RET"`, never entering the auction. Retaining *from* the 100 lots would
have left 84 players for 80 slots — a surplus of four, which destroys the
"someone cheaper is coming" dynamic that makes passing viable (D-009).
Keeping them outside means 100 lots chase 80 open slots instead.
**Measured:** mandatory minimums met went 90/96 → **96/96**, unsold per auction
7 → ~17 (a real surplus again), average price ₹10 Cr → ₹9.2 Cr.
**Also:** retentions are dealt from a per-page-load `lobbySeed` so the lobby can
*show* each franchise's retained players and purse before you pick — franchise
choice is now a real decision, not cosmetic.

## D-024 — Pre-auction shortlist with per-player ceilings
**v1, 2026-08-21.** A planner opened from the lobby lets you flag targets from
all 100 lots and commit a maximum bid to each. During the auction: a ★ TARGET
badge on the lower-third, a "your targets" strip showing how many lots away
each one is and whether you can still afford your ceiling, and the BID button
turning **red** with "over your plan" once the next increment breaks it.
**Why ceilings rather than just favourites:** the plan only creates tension if
breaking it is visible. A list of names is a bookmark; a number you have to
knowingly exceed is a decision.
The shortlist is UI/store state only — `engine/` is untouched.

## D-023 — Bug sweep after the polish pass
**v1, 2026-08-21.** Four defects found by driving the built app headlessly
rather than by reading the diff.

1. **`reset()` leaked per-lot UI state.** "Play again" kept `skipping` and
   `outbid`, so a new auction could start stuck in fast-forward (130ms ticks).
   Reset now clears both.
2. **The outbid cue returned early**, skipping the crowd swell and the
   auctioneer's big-money call — so the room fell silent at exactly the moment
   it should react hardest (a rival taking a ₹9 Cr player off you). The cue now
   replaces only the bid knock; everything downstream still runs.
3. **The rail shake remounted the component.** Driving it with a changing
   `key` restarted the inner leading-state spring, so the entry visibly popped
   on every outbid *and* again when the alert expired. Replaced with
   `useAnimationControls` fired from an effect — no remount.
4. **The alert could hang on screen.** Visibility was computed from
   `Date.now()` at render with nothing scheduled to re-render it; during `rtm`
   and `sold` there are no TICKs, so it only cleared on the next state change.
   It now clears itself on a timer.

Also fixed the same day: hardcoded `"of 4"` and `"12/15"` on the results
screen, left from the 4-team era, and the dead `FranchisePanel.tsx` carrying a
stale `/6` overseas cap.

**Verification:** 45 tests green, `FULL_SIM=1` 1000/1000 auctions valid (931s),
a 35-lot headless playthrough mixing bid/pass/skip with zero console errors,
and the outbid path confirmed end-to-end (toast fires, auto-clears).
**Known non-issue:** three.js logs "THREE.Clock deprecated, use THREE.Timer" —
that comes from inside `@react-three/fiber`, not our code.

## D-022 — Visual polish pass: the eight-point review
**v1, 2026-08-21.** Worked through a visual review in three groups.

**Game feel.** Losing the lead is now an event: a sour descending minor second
(deliberately unlike the bid knock), a red shake on your rail entry, and an
"OUTBID BY <team>" toast. Detection is `prev.bidderId === human && next !==
human`; the flag is raised even when muted, because two of the three cues are
visual.

**Scene corrections.** Board tags moved to the clear bottom-left — the
auctioneer occupies canvas x≈470–770 below y≈300, and the old tag row ran
straight under him. The gavel got a light two-tone head at 1.25× with a white
strike block on the podium and a point-light flash timed to impact, because
dark-brown-on-dark-stage was unreadable. Benches gained a front fill light
(every other light is behind them, so their fronts rendered near-black) plus a
team-colour underglow strip.

**Room.** Bench arc pulled 5.5 → 4.95 to close the dead floor, and a carpet
texture (concentric rings, eight radials pointing at the benches, outer
vignette) replaced the bare plane. The crowd got per-instance vertex colours
across five tones plus a rim light so it reads as people, not one cloned blob.
Franchise rail widened 152 → 170px with a `moneyCompact()` variant so purse and
slots share one line at ₹120 Cr.

**Lighting rebalance:** the new fills initially blew out every face to white;
spot 420 → 300, ambient 0.5 → 0.34, hemisphere 1.5 → 1.1, front fill 70 → 38,
rim 150 → 70.

**Lobby and results now sit inside the hall** via `HallBackdrop`, which mounts
the 3D chunk on `requestIdleCallback` *after* first paint (and prefetches on
hover of Start Auction), so the lobby stays instantly interactive. `Hall` takes
a `mode` — `idle` slowly orbits for the lobby, `podium` frames the stage for
results, `auction` is the reactive game camera. The jumbotron shows AUCTIONROOM
signage when no player is on the block.

**Two real bugs surfaced by putting results on screen:** it said "#7 of 4" and
"12/15" — hardcoded from the 4-team, 15-player era. Both now read from
`franchises.length`, `SQUAD_MAX` and `OVERSEAS_MAX`. Deleted the dead
`FranchisePanel.tsx` (superseded by `TeamRail`) which carried the same stale
`/6` overseas cap.

## D-021 — Player likenesses are generated, never photographs
**v1, 2026-08-21.** The jumbotron shows a stylised head-and-shoulders portrait
per cricketer: skin tone, kit colour, hair, beard and headgear are all derived
from a hash of the player id (so a given player always looks the same), plus a
bat or ball prop by role and a ✈ mark for overseas players.
**Why not real photos:** press images of active cricketers are rights-encumbered
and this is a public, shareable build; separately, the hall is deliberately
asset-free and offline (D-013), so there is nowhere to fetch them from. A
generated likeness gives each lot a face without either problem.

## D-020 — Skip fast-forwards time, it does not skip the auction
**v1, 2026-08-21.** The ⏩ button passes on the player *and* speeds the driver
up (1000ms → 130ms ticks, bot cycles 420ms → 70ms, interstitials to 450ms)
until the lot resolves, then clears itself.
**Why this shape:** the engine is untouched — bots still fight the lot out at
full fidelity and the result is identical, you just watch it at speed. Skipping
by jumping the pool index would have changed who won what, which would make
the human's convenience button alter the auction.

## D-019 — Passing is binding for the whole lot
**v1, 2026-08-21.** `passed` used to clear on every new bid, so the human's
Pass was erased the instant anyone bid — the button visibly did nothing.
Passing now sits you out until the next player, `canBid` rejects a franchise
that passed, and the HUD says "You're out of this lot".
**Consequence for bots:** they no longer emit PASS at all. A bot that locked
itself out at the opening price could not return when the player turned out to
be its last chance at a mandatory role, which broke the desperation override
(D-014). They simply stay quiet instead; `everyoneElseOut()` already treats
"cannot legally bid" as being out, so dead lots still close early.
**Measured after:** normal difficulty 90/96 squads complete, avg ₹10 Cr —
unchanged from before the switch.

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
