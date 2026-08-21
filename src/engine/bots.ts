// The shared bidding brain + three personalities — CLAUDE.md §8.
// Pure functions; all randomness comes through the caller's seeded Rng.

import type { AuctionState, Franchise, Player, Role } from "./types";
import { nextBidAmount, nextIncrement } from "./bids";
import { canBid, remainingPool, reserve, roleCount, unfilledNeeds, SQUAD_MAX } from "./rules";
import { nextFloat, nextInt, type Rng } from "./rng";
import { ACCEL_SECONDS, LOT_SECONDS } from "./auction";

// ---------------------------------------------------------------- valuation

/** Market value of a rating, in lakhs. Exponential: stars cost multiples.
 * Calibrated for 8 × ₹120 Cr purses chasing ~96 squad slots. */
export function ratingValue(rating: number): number {
  return Math.round((50 * Math.exp((rating - 60) / 8.5)) / 5) * 5;
}

/** Typical squad shape (12-player squads) — beyond this a role is a luxury. */
const ROLE_TYPICAL: Record<Role, number> = { BAT: 4, BOWL: 5, AR: 3, WK: 2 };

/**
 * Franchise-relative value before personality: rating value scaled by squad
 * need, pool scarcity, and how much money-per-slot this franchise has left.
 */
export function rawValueEstimate(state: AuctionState, franchise: Franchise, player: Player): number {
  let value = ratingValue(player.rating);

  const needs = unfilledNeeds(franchise.squad);
  const deficit = needs[player.role] ?? 0;
  const supply = remainingPool(state).filter((p) => p.role === player.role).length;

  if (deficit > 0) {
    value *= 1.2; // fills a mandatory hole
    if (supply <= deficit) value *= 1.5; // last chances to fill it
    else if (supply <= deficit * 2) value *= 1.25;
  } else if (roleCount(franchise.squad, player.role) >= ROLE_TYPICAL[player.role]) {
    value *= 0.55; // luxury surplus
  }

  // Money burning a hole: rich teams with slots to fill pay up; poor ones cool off.
  const slotsLeft = Math.max(1, SQUAD_MAX - franchise.squad.length);
  const spendable = Math.max(0, franchise.budget - reserve(franchise.squad, remainingPool(state)));
  const perSlot = spendable / slotsLeft;
  value *= Math.min(1.5, Math.max(0.6, Math.sqrt(perSlot / 800)));

  return Math.round(value);
}

/** Personality-adjusted ceiling this bot will pay for this player. */
export function adjustedEstimate(state: AuctionState, franchise: Franchise, player: Player): number {
  const p = franchise.botPersonality;
  const raw = rawValueEstimate(state, franchise, player);
  if (!p) return raw;

  let value = raw;
  if (p.roleObsession === player.role) value *= 1.2;
  if (p.tagObsession && player.tags.includes(p.tagObsession)) value *= 1.15;
  value *= 0.85 + 0.45 * p.aggression;

  // Discipline caps the single-player spend as a share of spendable budget.
  const spendable = Math.max(0, franchise.budget - reserve(franchise.squad, remainingPool(state)));
  value = Math.min(value, spendable * (0.5 - 0.3 * p.budgetDiscipline));

  // A truly disciplined bot never pays above raw value, whatever the modifiers.
  if (p.budgetDiscipline > 0.85) value = Math.min(value, raw);

  return Math.round(value);
}

// ---------------------------------------------------------------- bidding

export type BotMove = "bid" | "pass" | null;

/**
 * One bot's decision for the current tick of an open lot.
 * Personality shapes WHEN it acts (patience → entry time, hesitation) and
 * WHETHER the price still fits its estimate. Returns null to keep lurking.
 */
export function botAction(state: AuctionState, franchiseId: string, rng: Rng): [BotMove, Rng] {
  const franchise = state.franchises.find((f) => f.id === franchiseId);
  if (!franchise?.botPersonality || state.phase !== "bidding" || !state.currentPlayer)
    return [null, rng];
  if (state.currentBidderId === franchiseId || state.passed.includes(franchiseId))
    return [null, rng];

  if (!canBid(state, franchiseId).ok) {
    // Can't legally bid this lot at this price — declare out (helps pacing).
    return ["pass", rng];
  }

  const p = franchise.botPersonality;
  const player = state.currentPlayer;
  const amount = nextBidAmount(state.currentBid, player.basePrice);
  const estimate = adjustedEstimate(state, franchise, player);

  // Desperation: this player fills a mandatory hole and the pool is running
  // out of that role. Real teams overpay here — value ceilings stop mattering
  // (the soft-lock guard in canBid still bounds the spend).
  const deficit = unfilledNeeds(franchise.squad)[player.role] ?? 0;
  const supply = remainingPool(state).filter((x) => x.role === player.role).length;
  const desperate = deficit > 0 && supply <= deficit;

  if (!desperate && amount > estimate) return ["pass", rng]; // price left our number

  // Patience gates entry: patient bots lurk before they even consider acting.
  // A desperate bot has no patience left.
  const lotLen = state.accelerated ? ACCEL_SECONDS : LOT_SECONDS;
  const elapsed = lotLen - state.timer;
  const entryTick = desperate ? 0 : Math.ceil(p.patience * (lotLen - 3));
  const lastChance = state.timer <= 1;
  if (elapsed < entryTick && !lastChance) return [null, rng];

  // Hesitation: even with value on the table, sometimes let it slide — drama.
  const pBid = desperate ? 0.92 : lastChance ? 0.9 : 0.35 + 0.45 * p.aggression;
  const [roll, next] = nextFloat(rng);
  return [roll < pBid ? "bid" : null, next];
}

// ---------------------------------------------------------------- RTM

export function botRtmUseCard(state: AuctionState, rng: Rng): [boolean, Rng] {
  const offer = state.rtmOffer!;
  const franchise = state.franchises.find((f) => f.id === offer.formerFranchiseId)!;
  const estimate = adjustedEstimate(state, franchise, state.currentPlayer!);
  const [roll, next] = nextFloat(rng);
  return [offer.amount <= estimate && roll < 0.8, next];
}

export function botRtmRaise(state: AuctionState, rng: Rng): [boolean, Rng] {
  const offer = state.rtmOffer!;
  const winner = state.franchises.find((f) => f.id === offer.winningFranchiseId)!;
  const p = winner.botPersonality;
  const raised = offer.amount + nextIncrement(offer.amount);
  const estimate = adjustedEstimate(state, winner, state.currentPlayer!);
  const [roll, next] = nextFloat(rng);
  return [raised <= estimate && roll < 0.45 + 0.4 * (p?.aggression ?? 0.5), next];
}

export function botRtmMatch(state: AuctionState, rng: Rng): [boolean, Rng] {
  const offer = state.rtmOffer!;
  const franchise = state.franchises.find((f) => f.id === offer.formerFranchiseId)!;
  const estimate = adjustedEstimate(state, franchise, state.currentPlayer!);
  return [offer.amount <= estimate * 1.05, rng]; // small sunk-cost lean
}

// ---------------------------------------------------------------- roster

const SCOUT_TAGS = ["pace", "spin", "opener", "finisher", "six-hitter",
  "death-bowler", "power-hitter", "wrist-spin"];

/**
 * Attach the three shipped personalities to the non-human franchises.
 * Difficulty (0.8 easy / 1.0 normal / 1.2 hard) scales aggression.
 * The Scout's obsession is seeded fresh each game — CLAUDE.md §8.
 */
export function attachBotPersonalities(
  franchises: Franchise[],
  difficulty: number,
  seed: number,
): Franchise[] {
  const [tagIdx] = nextInt(seed >>> 0, SCOUT_TAGS.length);
  const [tagIdx2] = nextInt((seed + 13) >>> 0, SCOUT_TAGS.length);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  // Difficulty pushes aggression up AND discipline down — harder bots bid
  // more often, hold higher ceilings, and untie their wallets.
  const loosen = (d: number) => clamp(d - (difficulty - 1) * 0.4);
  // Seven rivals, seven temperaments (CLAUDE.md §8 shipped three; five-a-side
  // wasn't enough once the league grew to eight franchises).
  const personalities = [
    { name: "The Shark", aggression: clamp(0.9 * difficulty), patience: 0.15, budgetDiscipline: loosen(0.25) },
    { name: "The Accountant", aggression: clamp(0.15 * difficulty), patience: 0.85, budgetDiscipline: loosen(0.95) },
    { name: "The Scout", aggression: clamp(0.5 * difficulty), patience: 0.5, budgetDiscipline: loosen(0.5),
      tagObsession: SCOUT_TAGS[tagIdx] },
    { name: "The Gambler", aggression: clamp(0.75 * difficulty), patience: 0.7, budgetDiscipline: loosen(0.3) },
    { name: "The Professor", aggression: clamp(0.4 * difficulty), patience: 0.6, budgetDiscipline: loosen(0.7),
      roleObsession: "BOWL" as const },
    { name: "The Showman", aggression: clamp(0.8 * difficulty), patience: 0.3, budgetDiscipline: loosen(0.4),
      tagObsession: SCOUT_TAGS[tagIdx2] },
    { name: "The Vulture", aggression: clamp(0.3 * difficulty), patience: 0.9, budgetDiscipline: loosen(0.6) },
  ];
  let i = 0;
  return franchises.map((f) =>
    f.isHuman ? f : { ...f, botPersonality: personalities[i++ % personalities.length] },
  );
}
