// Headless auction simulation with random bidders. Used by the /debug page
// and by tests to prove a full auction always completes legally. Bots with
// real personalities replace the random policy in Phase 2.

import type { AuctionState, Franchise, Player } from "./types";
import { applyEvent } from "./auction";
import { canBid } from "./rules";
import { assignFormerPlayers } from "./rtm";
import { makeDefaultFranchises } from "./franchises";
import { SETS } from "./sets";
import { nextFloat, seedRng, type Rng } from "./rng";

/** Lobby-phase state ready for a START event. */
export function createInitialState(players: Player[], franchises: Franchise[]): AuctionState {
  return {
    phase: "lobby",
    sets: SETS,
    pool: players,
    poolIndex: 0,
    currentPlayer: null,
    currentBid: null,
    currentBidderId: null,
    bidHistory: [],
    franchises,
    timer: 0,
    passed: [],
    unsold: [],
    rtmOffer: null,
    accelerated: false,
    rngSeed: 0,
  };
}

export interface SimResult {
  state: AuctionState;
  log: string[];
  events: number;
}

const MAX_EVENTS = 300_000;

/**
 * Run one full auction where every franchise bids at random (35% per tick
 * when legal) and answers RTM offers with a coin flip. Deterministic per seed.
 */
export function simulateRandomAuction(players: Player[], seed: number): SimResult {
  let rng: Rng = seedRng(seed ^ 0x5eed);
  const franchises = assignFormerPlayers(makeDefaultFranchises(), players, seed + 1);
  let state = applyEvent(createInitialState(players, franchises), { type: "START", seed });
  const log: string[] = [];
  const name = (id: string | null) => franchises.find((f) => f.id === id)?.name ?? "?";
  let events = 1;
  let lastSet = "";

  const chance = (p: number): boolean => {
    const [f, next] = nextFloat(rng);
    rng = next;
    return f < p;
  };

  while (state.phase !== "finished" && events < MAX_EVENTS) {
    events++;
    switch (state.phase) {
      case "bidding": {
        if (state.currentPlayer && state.currentPlayer.setId !== lastSet && !state.accelerated) {
          lastSet = state.currentPlayer.setId;
          log.push(`— SET ${state.sets.find((s) => s.id === lastSet)?.name} —`);
        }
        let bid = false;
        for (const f of state.franchises) {
          if (canBid(state, f.id).ok && chance(0.35)) {
            state = applyEvent(state, { type: "BID", franchiseId: f.id });
            bid = true;
            break; // one bid per tick at most
          }
        }
        if (!bid) state = applyEvent(state, { type: "TICK" });
        break;
      }
      case "rtm": {
        const stage = state.rtmOffer!.stage;
        if (stage === "offer") state = applyEvent(state, { type: "RTM_OFFER_RESPONSE", useCard: chance(0.5) });
        else if (stage === "raise") state = applyEvent(state, { type: "RTM_RAISE", raise: chance(0.5) });
        else state = applyEvent(state, { type: "RTM_DECIDE", match: chance(0.5) });
        break;
      }
      case "sold": {
        log.push(
          `SOLD  ${state.currentPlayer!.name} → ${name(state.currentBidderId)} for ${state.currentBid}L`,
        );
        state = applyEvent(state, { type: "NEXT_PLAYER" });
        break;
      }
      case "unsold": {
        log.push(`UNSOLD  ${state.currentPlayer!.name}`);
        state = applyEvent(state, { type: "NEXT_PLAYER" });
        break;
      }
      default:
        throw new Error(`simulation stuck in phase ${state.phase}`);
    }
  }
  if (state.phase !== "finished") throw new Error("simulation did not finish");
  return { state, log, events };
}
