// Right to Match — CLAUDE.md §7. Flow: when bidding closes and the winner is
// not the player's former franchise, that franchise may play an RTM card;
// the winner may then raise ONCE; the former franchise matches or declines.
// The card is consumed only on an actual match.

import type { AuctionState, Franchise, Player } from "./types";
import { canTakeAt, remainingPool } from "./rules";
import { seedRng, shuffle, type Rng } from "./rng";

export const RTM_CARDS_START = 2;
export const FORMER_PLAYERS_PER_FRANCHISE = 3; // ×8 teams → RTM stays special

/**
 * Which franchise (if any) gets the RTM offer for this sale?
 * Must hold the player as a former player, not be the winner, have a card
 * left, and be able to legally take the player at the winning amount.
 */
export function rtmCandidateId(
  state: AuctionState,
  player: Player,
  winnerId: string,
  amount: number,
): string | null {
  for (const f of state.franchises) {
    if (f.id === winnerId) continue;
    if (f.rtmCards <= 0) continue;
    if (!f.formerPlayerIds.includes(player.id)) continue;
    if (!canTakeAt(f, player, amount, remainingPool(state)).ok) continue;
    return f.id;
  }
  return null;
}

/**
 * Lobby helper: deal each franchise a disjoint set of "former players"
 * (seeded). These are the players it can RTM during the auction.
 */
export function assignFormerPlayers(
  franchises: Franchise[],
  players: Player[],
  seed: number,
): Franchise[] {
  let rng: Rng = seedRng(seed);
  let deck: Player[];
  [deck, rng] = shuffle(players, rng);
  return franchises.map((f, i) => ({
    ...f,
    formerPlayerIds: deck
      .slice(i * FORMER_PLAYERS_PER_FRANCHISE, (i + 1) * FORMER_PLAYERS_PER_FRANCHISE)
      .map((p) => p.id),
  }));
}
