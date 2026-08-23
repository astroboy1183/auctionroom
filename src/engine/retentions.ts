// Pre-auction retentions — CLAUDE.md §7. Each franchise walks in with players
// already on the books and a purse reduced by the retention ladder, so the
// eight teams start with genuinely different problems instead of eight
// identical blank slates.
//
// Retained players live OUTSIDE the auction pool (setId "RET"). Retaining
// from the 100-player list instead would drop supply below the 96 squad slots
// and destroy the surplus that makes passing viable (see D-009).

import type { Franchise, Player } from "./types";
import { seedRng, shuffle, type Rng } from "./rng";

export const RETAINED_SET_ID = "RET";
/** Cost of the 1st and 2nd retention, in lakhs (₹14 Cr / ₹10 Cr). */
export const RETENTION_COSTS = [1400, 1000];

export interface Retention {
  player: Player;
  cost: number;
}

export function retainedPool(players: Player[]): Player[] {
  return players.filter((p) => p.setId === RETAINED_SET_ID);
}

export function auctionPool(players: Player[]): Player[] {
  return players.filter((p) => p.setId !== RETAINED_SET_ID);
}

/**
 * Deal the retained pool out across the franchises (seeded) and charge each
 * one the retention ladder. Returns franchises with squads pre-filled and
 * budgets already reduced.
 */
export function applyRetentions(
  franchises: Franchise[],
  players: Player[],
  seed: number,
): Franchise[] {
  const pool = retainedPool(players);
  const perTeam = Math.min(RETENTION_COSTS.length, Math.floor(pool.length / franchises.length));
  if (perTeam === 0) return franchises;

  let rng: Rng = seedRng(seed);
  let deck: Player[];
  [deck, rng] = shuffle(pool, rng);

  return franchises.map((f, i) => {
    const mine = deck.slice(i * perTeam, (i + 1) * perTeam);
    const spend = mine.reduce((sum, _, k) => sum + RETENTION_COSTS[k], 0);
    return {
      ...f,
      squad: [...f.squad, ...mine],
      budget: f.budget - spend,
      retained: mine.map((p) => p.id),
    };
  });
}

/** What each franchise paid to retain, for the lobby/results display. */
export function retentionSpend(perTeam: number): number {
  return RETENTION_COSTS.slice(0, perTeam).reduce((a, b) => a + b, 0);
}
