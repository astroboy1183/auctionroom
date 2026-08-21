# AuctionRoom — IPL-Style Cricket Auction Simulator

> **For the AI agent building this:** Read this entire file before writing any code.
> Build phase by phase. Do not start a phase until the previous phase's
> acceptance criteria all pass. Ask the human to run and verify at each gate.
>
> Companion files: `DECISIONS.md` (rationale for choices not in this spec) and
> `BUILD-CHECKLIST.md` (the end-to-end task list). Keep all three in sync.

## 1. What this is

A browser-based cricket auction game. Players experience an IPL-style auction:
cricketers come up for bidding one at a time, human and bot bidders compete with
limited budgets, and each franchise tries to assemble the best squad under
constraints. v0 is single-player vs 3 AI bot franchises, fully 2D. v1 upgrades the
presentation to a 3D auction hall. v2 adds real-time multiplayer rooms so
friends can join via a link.

**Vibe target:** the tension of a real auction — escalating bids, budget anxiety,
"do I overpay for this player or save for the next one." Fast, snappy, fun in
the first 60 seconds.

**Authenticity target:** it should feel like watching the real thing — auction
*sets*, an auctioneer calling numbers, Right to Match drama. See §7.

## 2. Goals / Non-goals

**Goals (v0):**
- Complete solo auction: 100-player pool for 60 squad slots, 4 franchises
  (1 human + 3 bots), full auction loop, squad building, final scoring screen.
- Bot bidders with distinct personalities that feel intentional, not random.
- Playable end-to-end in ~15–20 minutes (no-interest lots resolve fast).
- Deployable as a static site (no backend in v0).

**Goals (v1):**
- 3D auction hall: stage, podium, animated auctioneer character, franchise
  tables — rendered with react-three-fiber, game UI stays as a DOM overlay.
- Still a static site; still playable on phones (quality toggle + 2D fallback).

**Goals (v2):**
- Multiplayer rooms: create room → share link → 2-6 humans + bots fill the rest.
- Server-authoritative auction state, reconnection handling.

**Non-goals (all versions):**
- Real IPL branding, logos, or trademarked team names (use fictional franchise
  names). Player names: use real cricketer names with publicly known role/stats
  info only.
- Accounts, persistence beyond a room's lifetime, rankings, payments.
- Mobile app. (Responsive web is required, native is not.)

## 3. Tech stack

Versions verified current as of 2026-08-21. Pin majors; let patches float.

| Layer | Choice | Version | Why |
|---|---|---|---|
| Build tool | Vite | ^8 | fast, standard |
| Frontend | React + TypeScript | ^19 / ^7 | agent-friendly, typed game state |
| State | Zustand | ^5 | simple store for game state machine |
| Styling | Tailwind CSS | ^4 | fast iteration |
| Animation | `motion` | ^13 | bid pop-ins, hammer drop |
| Sounds | Howler.js | ^2 | bid tick, hammer, crowd murmur (phase 4) |
| Auctioneer voice | Web Speech API | built-in | zero-cost TTS, no backend (phase 4) |
| Testing | Vitest | ^4 | auction engine unit tests |
| Deploy (v0/v1) | **Cloudflare Pages** | — | static, free, same platform as v2 |
| v1 3D | three.js + `@react-three/fiber` + `drei` | latest | auction hall scene, GLB assets |
| v2 realtime | **Cloudflare Durable Objects** | — | one DO per room = the authority |

**Stack notes — these differ from common tutorials, read before scaffolding:**
- **React 19**, not 18. No legacy deps, no reason to start two majors back.
- **Tailwind v4** has no `tailwind.config.js` and no PostCSS step. Config is
  CSS-first via `@theme`, wired through the `@tailwindcss/vite` plugin.
- **`motion`**, not `framer-motion` — same library, renamed package.
- **3D is a scene layer, not a UI replacement.** In v1 the canvas renders the
  hall (stage, auctioneer, tables); all interactive UI — bid buttons, panels,
  timer — stays DOM, overlaid broadcast-style. Low-poly stylized art, GLB with
  Draco compression, and the finished 2D renderer is kept as a fallback mode
  for weak devices.
- **Durable Objects over Socket.IO** for v2: one DO per room *is* the
  server-authoritative state, hibernation makes idle rooms free, and built-in
  alarms drive the bid timer with no long-running process. Socket.IO on
  Fly/Railway remains the fallback if DOs prove awkward. Decide at Phase 6.

## 4. Architecture invariants

These are non-negotiable and decide the shape of everything else.

**1. Engine purity.** `src/engine/` must never import React or touch the DOM.
It must run headless in tests and, unchanged, on the v2 multiplayer server.
This is the single most important architectural constraint in the project.
Corollary for v1: 3D is presentation only — `engine/` must not know or care
whether the renderer is 2D DOM or a three.js canvas.

**2. The engine is a pure reducer.** Not a class with methods and internal
timers: `applyEvent(state, event) → state`. Events are
`START | BID | PASS | TICK | RESOLVE | RTM_OFFER | RTM_DECIDE | NEXT_PLAYER`.
The same function runs in the browser in v0/v1 and inside the Durable Object
in v2, so Phase 6 is a lift, not a rewrite.

**3. The engine never owns time.** No `setInterval` anywhere in `engine/`. The
countdown advances only when something feeds it a `TICK`. React drives ticks in
v0/v1; the DO alarm drives them in v2; tests drive them instantly — which is what
makes 1000-auction simulations fast.

**4. The engine never calls `Math.random()`.** It takes a seeded PRNG
(mulberry32). Pool shuffles and bot hesitation become reproducible, so a
failure in 1 of 1000 simulations is debuggable by seed, and v2 clients can't
diverge from the server.

## 5. Data model (TypeScript)

```ts
type Role = "BAT" | "BOWL" | "AR" | "WK";

interface Player {
  id: string;
  name: string;           // real cricketer
  role: Role;
  basePrice: number;      // in lakhs, e.g. 200 = ₹2 Cr
  rating: number;         // 60-100 overall skill (hand-tuned in data file)
  tags: string[];         // "pace", "spin", "opener", "finisher", "death-bowler"
  overseas: boolean;
  setId: string;          // auction set this player belongs to (see §7)
}

interface Franchise {
  id: string;
  name: string;           // fictional: "Hyderabad Hawks", "Mumbai Mavericks"
  budget: number;         // starts at 9000 (₹90 Cr, in lakhs)
  squad: Player[];
  isHuman: boolean;
  botPersonality?: BotPersonality;
  rtmCards: number;       // Right to Match cards remaining (start: 2)
  formerPlayerIds: string[];  // players this franchise may RTM
}

interface AuctionState {
  phase: "lobby" | "bidding" | "rtm" | "sold" | "unsold" | "finished";
  sets: AuctionSet[];         // ordered; pool is derived from these
  currentSetIndex: number;
  currentPlayer: Player | null;
  currentBid: number | null;
  currentBidderId: string | null;
  bidHistory: Bid[];
  franchises: Franchise[];
  timer: number;              // seconds left on current bid (10s, resets on bid)
  rtmOffer: RtmOffer | null;  // set when phase === "rtm"
  rngSeed: number;            // see architecture invariant 4
}
```

**Squad rules (validated live):** max 15 players, max 6 overseas, must end with
≥3 BAT, ≥3 BOWL, ≥1 WK, ≥1 AR. Budget cannot go below what's needed to fill
minimum squad at base prices (prevent soft-locking).

**Soft-lock math:** before accepting any bid, compute the *reserve* — the sum of
the cheapest remaining pool players that would satisfy this franchise's unfilled
mandatory roles. A bid is legal only if `budget - bid >= reserve`. Applies
identically to the human's BID button and every bot.

**Bid increments:** below 100L → +10L; 100–500L → +25L; above 500L → +50L.

## 6. Player data (Phase 0 deliverable)

Create `src/data/players.json` with **100 real cricketers** spanning roles and
price tiers. Hand-write realistic entries (agent: use well-known players and
plausible base prices/ratings; exact stat accuracy is NOT required, this is a
game). Distribution: ~26 BAT, ~38 BOWL, ~21 AR, ~15 WK; ~38 overseas (real
auction lists are bowler-heavy and ~40% overseas); base prices from 30L to
200L in tiers. Every player needs a `setId` per §7.

**Why 100 for 60 slots:** real auctions have a large surplus — most registered
players go unsold. The surplus is what makes *passing* a viable strategy
("someone cheaper is coming") instead of every lot being must-win. ~40 unsold
players per game is correct behaviour, not a bug.

## 7. Auction format (what makes it feel live)

**Sets, not a flat shuffle.** Real auctions run in ordered sets, and the agent
must too. This is a strategy mechanic, not decoration: knowing another batch of
batters is still coming is exactly the "spend now or wait" tension in §1.

```
Set 1   Marquee          8 players   (highest-rated, mixed roles)
Set 2   Batters I        9
Set 3   Fast Bowlers I   9
Set 4   All-Rounders I   8
Set 5   Wicketkeepers I  6
Set 6   Spinners I       7
Set 7   Batters II       9
Set 8   Fast Bowlers II  9
Set 9   All-Rounders II  8
Set 10  Wicketkeepers II 5
Set 11  Spinners II      6
Set 12  Uncapped & Rest  16
```

**End condition.** The auction ends when every squad is full or the pool is
exhausted. With 100 players for 60 slots, ~40 going unsold is normal.

**Pacing.** A lot that attracts no opening bid resolves in 4 ticks instead of
10 — no-interest players must not drag the game.

Players shuffle *within* a set (seeded); set order is fixed. Announce each set
transition on screen — it's a natural breathing point.

**Right to Match (RTM).** The best drama mechanic in the real auction. Each
franchise starts with 2 RTM cards and a short `formerPlayerIds` list (assigned
at lobby). When bidding closes:
1. If the winner is *not* the former franchise, that franchise is offered RTM.
2. If they use a card, the original winner may raise **once** more.
3. The RTM franchise then matches that final number or declines.

RTM respects budget and soft-lock rules exactly like a normal bid.

**Accelerated round.** After Set 12, unsold players whose roles are still
mandatory-unfilled for any franchise come back once, on a 6-second timer.

**Auctioneer (Phase 4).** Web Speech API calls the numbers — "two crore twenty
lakhs… going once… going twice… sold, to the Hyderabad Hawks." Pre-record the
~40 stock phrases as audio; use TTS only for player names and numbers, since
browser voice quality varies by OS. Final 3 seconds get their own "going once /
going twice" visual state, colour, and sound.

## 8. Bot personalities (the heart of the game)

Each bot gets a personality — a set of weights over a shared bidding brain:

```ts
interface BotPersonality {
  name: string;
  aggression: number;     // 0-1: willingness to bid above value estimate
  patience: number;       // 0-1: how long they lurk before entering
  roleObsession?: Role;   // overvalues this role by 20%
  tagObsession?: string;  // e.g. "pace" — overvalues by 15%
  budgetDiscipline: number; // 0-1: how hard they cap per-player spend
}
```

**Shared bidding brain (pure function, unit-tested):**
1. Compute `valueEstimate(player, franchise)` = f(rating, role scarcity in
   remaining pool, franchise's unfilled squad needs, remaining budget pressure).
2. Personality modifiers scale the estimate (obsessions, aggression).
3. Bot bids if `currentBid + increment <= adjustedEstimate` AND squad rules
   allow AND a probabilistic hesitation gate passes (patience → sometimes lets
   a bid slide even when value is there — this creates realistic drama).
4. Hard rule: never bid into soft-lock (see §5).

**Reaction timing.** Bots must not bid at t=0 or the 10s timer is decorative.
Each bot gets a jittered reaction delay driven by `patience` — The Shark snaps
in around 1s, The Accountant waits until ~7s. Delay is seeded, not `Math.random`.

**Ship 3 named bots:** "The Shark" (high aggression, low patience),
"The Accountant" (max discipline, value-only), "The Scout" (tag-obsessed with
one random obsession per game, medium everything).

## 9. Screens

1. **Lobby** — franchise picker (name + color), difficulty (bot aggression
   multiplier), Start Auction.
2. **Auction floor** (the main screen) — center: current player card (name,
   role, tags, base price, rating shown as stars). Left: 4 franchise panels
   (budget bars, squad count, needs indicator, RTM cards left). Bottom: BID
   button (shows next increment) + PASS. Bid history ticker. Current set name
   banner. 10-second timer ring that resets on each bid; when it expires →
   RTM offer if applicable, else SOLD (hammer animation) or UNSOLD.
3. **Squad view** (tab) — your roster grouped by role, money spent, needs left.
4. **Results** — final squads side by side, squad score = Σ ratings with balance
   bonuses/penalties (missing role = heavy penalty), winner declared,
   "share result" copies a text summary.

Franchise panels flash on bid (paddle-raise). Purse/slots for all four teams
stay visible at all times — the broadcast "big board" look.

## 10. Build phases & acceptance gates

**Phase 0 — Skeleton + data.** Vite + React + TS + Tailwind scaffold;
players.json (100 players, with setIds); types file; Zustand store with
AuctionState; deploy pipeline live with a placeholder page.
✅ Gate: `npm run dev` renders a page listing all 100 players from JSON, and
the Cloudflare Pages URL serves the same build.

**Phase 1 — Auction engine (no UI polish).** Pure-TS reducer: seeded RNG, set
construction and within-set shuffling, bid validation, increments, timer via
TICK, sold/unsold transitions, no-bid fast resolution, end condition (all
squads full or pool exhausted), RTM flow, accelerated round, squad rule
enforcement. Vitest tests for: bid increment ladder, soft-lock prevention,
squad validation, RTM resolution paths, full simulated auction with 4 random
bidders completing without errors.
✅ Gate: `npm test` green; a debug page can auto-run a full random auction.

**Phase 2 — Bots.** Bidding brain + 3 personalities + hesitation model +
reaction delays + RTM decisions. Tests: The Accountant never exceeds value
estimate; no bot ever soft-locks; 1000 seeded auctions complete with all squads
valid.
✅ Gate: watching a bots-only auction in the debug page "feels like an auction"
(human judgment check).

**Phase 3 — Real UI.** All 4 screens, `motion` for bid pulses and hammer,
responsive down to 380px width. Timer ring animation, set banners, RTM modal.
✅ Gate: human plays a full auction start→results on desktop AND phone browser.

**Phase 4 — Juice + ship.** Auctioneer voice, sounds (toggleable), share-result
text, 2-3 balance passes on bot difficulty, production deploy on Cloudflare
Pages.
✅ Gate: a friend plays it from the public URL with zero instructions.

**Phase 5 (v1) — 3D auction hall.** react-three-fiber scene behind the DOM UI:
stage + podium, four franchise tables, low-poly auctioneer character with
states (idle, calling, going-once lean, hammer slam) synced to the voice and
engine phase, camera moves on set transitions and SOLD. Player reveal on the
podium. Quality toggle; the 2D renderer remains selectable as a fallback.
Still a static deploy — no backend.
✅ Gate: full auction in 3D on desktop AND a mid-range phone at playable
frame rate; 2D fallback still works.

**Phase 6 (v2) — Multiplayer.** Extract engine to a shared package. Cloudflare
Durable Object per room: create/join by 6-char code, server-authoritative state
via the same reducer, per-connection franchise assignment, bots fill empty
seats, DO alarms drive the timer, reconnect via room code + token in
sessionStorage.
✅ Gate: two humans on different networks complete an auction.

## 11. Repo layout

```
auctionroom/
  CLAUDE.md            ← this file
  DECISIONS.md         ← choices not covered here
  BUILD-CHECKLIST.md   ← end-to-end task list
  src/
    data/players.json
    engine/            ← pure TS, no React imports allowed here
      types.ts  rng.ts  sets.ts  bids.ts  rules.ts
      auction.ts  bots.ts  rtm.ts  scoring.ts
    store/gameStore.ts
    screens/  components/  hooks/  assets/
    scene/             ← v1 only: r3f components, 3D-side of the state bridge
    assets/models/     ← v1 only: GLB (Draco-compressed)
  worker/              ← v2 only (Durable Object)
  tests/
```

## 12. Deployment

**v0 — Cloudflare Pages, `auctionroom-bue.pages.dev`.**
(`auctionroom.pages.dev` was taken — project names are global.)
GitHub holds source; Cloudflare hosts. Deploys are **wrangler direct upload**,
not Git integration: `npm run build && npx wrangler pages deploy dist
--project-name auctionroom --branch main`. Run this at every phase gate (and
any time the public URL should update). Push-to-deploy via GitHub Actions +
`wrangler-action` can be added later if wanted.

`npm run build` runs `vitest run` first, so a failing engine test fails the
build and never reaches the public URL.

Since this is served from a domain root, Vite `base` stays `/`.

> **Do NOT deploy to jayanthappalla.com.** An earlier draft of this spec named a
> custom path on that domain; that was explicitly overridden. GitHub Pages under
> the `astroboy1183` account is also out — that account's user site has a custom
> domain, so all its Pages project repos inherit `jayanthappalla.com/<repo>`.

**v1 — same Pages deploy.** 3D adds client bundle + GLB assets, no backend.
Lazy-load the three.js chunk and models so the 2D game stays fast-first-paint.

**v2 — Durable Objects on the same Cloudflare account.** Same origin as the
Pages site, so no CORS, no second host, no separate bill.

## 13. Instructions to the coding agent

- Work one phase at a time; stop at each gate and ask the human to verify.
- Prefer boring, readable code over clever code. Type everything.
- When hand-writing players.json, prioritize name recognition and fun over
  statistical accuracy.
- Never use real IPL franchise names/branding anywhere.
- If a design decision isn't covered here, choose the option that makes the
  game more tense/fun, and note the decision in `DECISIONS.md`.
- Tick items off `BUILD-CHECKLIST.md` as they land.
