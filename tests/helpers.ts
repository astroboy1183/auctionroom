// Builders for hand-crafted engine states in tests.

import type { AuctionState, Franchise, Player, Role } from "../src/engine/types";
import { SETS } from "../src/engine/sets";
import { makeDefaultFranchises } from "../src/engine/franchises";

let n = 0;

export function player(over: Partial<Player> & { role: Role }): Player {
  n++;
  return {
    id: over.id ?? `p${n}`,
    name: over.name ?? `Player ${n}`,
    basePrice: 30,
    rating: 75,
    tags: [],
    overseas: false,
    setId: "S1",
    ...over,
  };
}

export function franchise(over: Partial<Franchise> = {}): Franchise {
  return { ...makeDefaultFranchises()[0], ...over };
}

/** A mid-bidding state with sensible defaults, overridable per test. */
export function biddingState(over: Partial<AuctionState> = {}): AuctionState {
  const current = over.currentPlayer ?? player({ role: "BAT" });
  return {
    phase: "bidding",
    sets: SETS,
    pool: [current],
    poolIndex: 0,
    currentPlayer: current,
    currentBid: null,
    currentBidderId: null,
    bidHistory: [],
    franchises: makeDefaultFranchises(),
    timer: 10,
    passed: [],
    unsold: [],
    rtmOffer: null,
    accelerated: false,
    rngSeed: 1,
    ...over,
  };
}
