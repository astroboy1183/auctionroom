// Squad rules and the soft-lock guard — CLAUDE.md §5.

import type { AuctionState, Franchise, Player, Role } from "./types";
import { nextBidAmount } from "./bids";

export const SQUAD_MAX = 12; // 8 teams × 12 = 96 slots vs a 100-player pool
export const OVERSEAS_MAX = 4;
export const MIN_ROLES: Record<Role, number> = { BAT: 3, BOWL: 3, WK: 1, AR: 1 };
export const ROLES: Role[] = ["BAT", "BOWL", "AR", "WK"];

export function roleCount(squad: Player[], role: Role): number {
  return squad.filter((p) => p.role === role).length;
}

export function overseasCount(squad: Player[]): number {
  return squad.filter((p) => p.overseas).length;
}

/** Per-role deficits vs the mandatory minimums. */
export function unfilledNeeds(squad: Player[]): Partial<Record<Role, number>> {
  const needs: Partial<Record<Role, number>> = {};
  for (const role of ROLES) {
    const deficit = MIN_ROLES[role] - roleCount(squad, role);
    if (deficit > 0) needs[role] = deficit;
  }
  return needs;
}

export function totalDeficit(squad: Player[]): number {
  return Object.values(unfilledNeeds(squad)).reduce((a, b) => a + b, 0);
}

/** Hard caps only (mandatory minimums are an END-of-auction requirement). */
export function withinCaps(squad: Player[]): boolean {
  return squad.length <= SQUAD_MAX && overseasCount(squad) <= OVERSEAS_MAX;
}

/**
 * Reserve: the minimum spend still required to fill this squad's unfilled
 * mandatory roles from the cheapest remaining pool players. A franchise may
 * never bid its budget below its reserve — that is the soft-lock guard.
 * Roles no longer available in the pool contribute nothing (unfillable
 * regardless of money).
 */
export function reserve(squad: Player[], remainingPool: Player[]): number {
  const needs = unfilledNeeds(squad);
  let total = 0;
  for (const [role, deficit] of Object.entries(needs)) {
    const cheapest = remainingPool
      .filter((p) => p.role === role)
      .map((p) => p.basePrice)
      .sort((a, b) => a - b)
      .slice(0, deficit);
    total += cheapest.reduce((a, b) => a + b, 0);
  }
  return total;
}

/** Players not yet auctioned (excludes the one on the block). */
export function remainingPool(state: AuctionState): Player[] {
  return state.pool.slice(state.poolIndex + 1);
}

export interface RuleCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Can `franchise` legally take `player` at `amount`? Shared by open bidding
 * and RTM matching. Applies caps, the slot-lock rule (never fill a slot that
 * a mandatory role still needs) and the budget soft-lock rule.
 */
export function canTakeAt(
  franchise: Franchise,
  player: Player,
  amount: number,
  remaining: Player[],
): RuleCheck {
  if (franchise.squad.length >= SQUAD_MAX) return { ok: false, reason: "squad full" };
  if (player.overseas && overseasCount(franchise.squad) >= OVERSEAS_MAX)
    return { ok: false, reason: "overseas limit reached" };
  if (amount > franchise.budget) return { ok: false, reason: "over budget" };

  const squadAfter = [...franchise.squad, player];
  const slotsLeft = SQUAD_MAX - squadAfter.length;
  if (totalDeficit(squadAfter) > slotsLeft)
    return { ok: false, reason: "would lock out required roles" };

  if (franchise.budget - amount < reserve(squadAfter, remaining))
    return { ok: false, reason: "soft-lock: must keep budget for required roles" };

  return { ok: true };
}

/** Can `franchiseId` place the next bid on the current lot? */
export function canBid(state: AuctionState, franchiseId: string): RuleCheck {
  if (state.phase !== "bidding" || !state.currentPlayer)
    return { ok: false, reason: "not in bidding phase" };
  if (state.currentBidderId === franchiseId)
    return { ok: false, reason: "already the highest bidder" };
  if (state.passed.includes(franchiseId))
    return { ok: false, reason: "passed on this player" };
  const franchise = state.franchises.find((f) => f.id === franchiseId);
  if (!franchise) return { ok: false, reason: "unknown franchise" };
  const amount = nextBidAmount(state.currentBid, state.currentPlayer.basePrice);
  return canTakeAt(franchise, state.currentPlayer, amount, remainingPool(state));
}
