// Final scoring — CLAUDE.md §9: squad score = Σ ratings with balance
// bonuses/penalties; a missing mandatory role slot is a heavy penalty.

import type { Franchise, Role } from "./types";
import { unfilledNeeds } from "./rules";

export const MISSING_ROLE_PENALTY = 100; // per missing mandatory slot
export const BALANCE_BONUS = 25;         // all mandatory minimums met

export interface SquadScore {
  franchiseId: string;
  base: number;      // Σ ratings
  penalty: number;
  bonus: number;
  total: number;
  missing: Partial<Record<Role, number>>;
  spent: number;
}

export function scoreSquad(franchise: Franchise, startBudget: number): SquadScore {
  const base = franchise.squad.reduce((sum, p) => sum + p.rating, 0);
  const missing = unfilledNeeds(franchise.squad);
  const missingSlots = Object.values(missing).reduce((a, b) => a + b, 0);
  const penalty = missingSlots * MISSING_ROLE_PENALTY;
  const bonus = missingSlots === 0 ? BALANCE_BONUS : 0;
  return {
    franchiseId: franchise.id,
    base,
    penalty,
    bonus,
    total: base - penalty + bonus,
    missing,
    spent: startBudget - franchise.budget,
  };
}

/** All squads scored, best first. */
export function finalScores(franchises: Franchise[], startBudget: number): SquadScore[] {
  return franchises
    .map((f) => scoreSquad(f, startBudget))
    .sort((a, b) => b.total - a.total);
}
