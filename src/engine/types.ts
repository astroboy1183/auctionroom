// Core domain types. This file (and everything in src/engine/) must never
// import React or touch the DOM — see CLAUDE.md §4.

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface Player {
  id: string;
  name: string;           // real cricketer
  role: Role;
  basePrice: number;      // in lakhs, e.g. 200 = ₹2 Cr
  rating: number;         // 60-100 overall skill (hand-tuned in data file)
  tags: string[];         // "pace", "spin", "opener", "finisher", ...
  overseas: boolean;
  setId: string;          // auction set this player belongs to (CLAUDE.md §7)
}

export interface AuctionSet {
  id: string;             // "S1".."S12"
  name: string;           // "Marquee", "Batters I", ...
  order: number;          // fixed auction order; shuffle happens within a set
}

export interface BotPersonality {
  name: string;
  aggression: number;       // 0-1: willingness to bid above value estimate
  patience: number;         // 0-1: how long they lurk before entering
  roleObsession?: Role;     // overvalues this role by 20%
  tagObsession?: string;    // e.g. "pace" — overvalues by 15%
  budgetDiscipline: number; // 0-1: how hard they cap per-player spend
}

export interface Franchise {
  id: string;
  name: string;             // fictional: "Hyderabad Hawks", never real IPL names
  color: string;            // hex, used by the UI only
  budget: number;           // starts at 9000 (₹90 Cr, in lakhs)
  squad: Player[];
  isHuman: boolean;
  botPersonality?: BotPersonality;
  rtmCards: number;         // Right to Match cards remaining (start: 2)
  formerPlayerIds: string[]; // players this franchise may RTM
  retained: string[];        // ids kept pre-auction (never enter the pool)
}

export interface Bid {
  franchiseId: string;
  amount: number;           // lakhs
  playerId: string;
}

// RTM flow: offer → (optional winner raise) → decide. CLAUDE.md §7.
export type RtmStage = "offer" | "raise" | "decide";

export interface RtmOffer {
  playerId: string;
  formerFranchiseId: string;  // holder of the RTM right
  winningFranchiseId: string; // won the open bidding
  amount: number;             // current number to match
  raiseUsed: boolean;         // winner's single post-RTM raise spent?
  stage: RtmStage;
}

export type Phase =
  | "lobby"
  | "bidding"
  | "rtm"
  | "sold"
  | "unsold"
  | "finished";

export interface AuctionState {
  phase: Phase;
  sets: AuctionSet[];         // ordered; pool is derived from these
  pool: Player[];             // full auction order (seeded shuffle within sets)
  poolIndex: number;          // index of the player currently on the block
  currentPlayer: Player | null;
  currentBid: number | null;
  currentBidderId: string | null;
  bidHistory: Bid[];
  franchises: Franchise[];
  timer: number;              // seconds left on current lot (resets on bid)
  passed: string[];           // franchises out of the current lot (bid clears)
  unsold: Player[];           // went unsold (accelerated round may re-list)
  rtmOffer: RtmOffer | null;  // set when phase === "rtm"
  accelerated: boolean;       // in the post-final-set accelerated round (6s)
  rngSeed: number;            // engine never calls Math.random — CLAUDE.md §4
}

// Events consumed by applyEvent in auction.ts. TICK performs resolution when
// the clock runs out; there is no separate RESOLVE event.
export type AuctionEvent =
  | { type: "START"; seed: number }
  | { type: "BID"; franchiseId: string }
  | { type: "PASS"; franchiseId: string }
  | { type: "TICK" }                                  // 1 second elapsed
  | { type: "RTM_OFFER_RESPONSE"; useCard: boolean }  // former franchise
  | { type: "RTM_RAISE"; raise: boolean }             // original winner, once
  | { type: "RTM_DECIDE"; match: boolean }            // former franchise, final
  | { type: "NEXT_PLAYER" };
