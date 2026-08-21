// The auction engine: a pure reducer `applyEvent(state, event) → state`.
// Owns no timers and no randomness beyond the seeded RNG in state
// (CLAUDE.md §4). Invalid events return the state unchanged.

import type { AuctionEvent, AuctionState, Player } from "./types";
import { nextBidAmount, nextIncrement } from "./bids";
import { canBid, canTakeAt, remainingPool, unfilledNeeds, SQUAD_MAX } from "./rules";
import { rtmCandidateId } from "./rtm";
import { seedRng, shuffle, type Rng } from "./rng";

export const LOT_SECONDS = 10;
export const ACCEL_SECONDS = 6;
export const NO_BID_TICKS = 4; // a lot nobody opens on resolves this fast

function lotSeconds(accelerated: boolean): number {
  return accelerated ? ACCEL_SECONDS : LOT_SECONDS;
}

/** Set-ordered pool with a seeded shuffle inside each set — CLAUDE.md §7. */
export function buildPool(players: Player[], state: AuctionState, rng: Rng): [Player[], Rng] {
  const pool: Player[] = [];
  let r = rng;
  for (const set of [...state.sets].sort((a, b) => a.order - b.order)) {
    const inSet = players.filter((p) => p.setId === set.id);
    let shuffled: Player[];
    [shuffled, r] = shuffle(inSet, r);
    pool.push(...shuffled);
  }
  return [pool, r];
}

function allSquadsFull(state: AuctionState): boolean {
  return state.franchises.every((f) => f.squad.length >= SQUAD_MAX);
}

/** Hand the player to a franchise at a price; enter the "sold" phase. */
function finalizeSold(
  state: AuctionState,
  franchiseId: string,
  amount: number,
  usedRtmCard: boolean,
): AuctionState {
  const player = state.currentPlayer!;
  return {
    ...state,
    phase: "sold",
    currentBid: amount,
    currentBidderId: franchiseId,
    rtmOffer: null,
    franchises: state.franchises.map((f) =>
      f.id === franchiseId
        ? {
            ...f,
            budget: f.budget - amount,
            squad: [...f.squad, player],
            rtmCards: usedRtmCard ? f.rtmCards - 1 : f.rtmCards,
          }
        : f,
    ),
  };
}

/** Timer hit zero (or everyone passed): close the lot. */
function resolveLot(state: AuctionState): AuctionState {
  const player = state.currentPlayer!;
  if (state.currentBid === null || state.currentBidderId === null) {
    return { ...state, phase: "unsold", unsold: [...state.unsold, player] };
  }
  const rtmTo = rtmCandidateId(state, player, state.currentBidderId, state.currentBid);
  if (rtmTo) {
    return {
      ...state,
      phase: "rtm",
      rtmOffer: {
        playerId: player.id,
        formerFranchiseId: rtmTo,
        winningFranchiseId: state.currentBidderId,
        amount: state.currentBid,
        raiseUsed: false,
        stage: "offer",
      },
    };
  }
  return finalizeSold(state, state.currentBidderId, state.currentBid, false);
}

/** Everyone other than the leader is passed or unable to bid → close early. */
function everyoneElseOut(state: AuctionState): boolean {
  return state.franchises.every(
    (f) =>
      f.id === state.currentBidderId ||
      state.passed.includes(f.id) ||
      !canBid(state, f.id).ok,
  );
}

export function applyEvent(state: AuctionState, event: AuctionEvent): AuctionState {
  switch (event.type) {
    case "START": {
      if (state.phase !== "lobby") return state;
      let rng = seedRng(event.seed);
      // Pool is built from whatever players the lobby put in state.pool.
      let pool: Player[];
      [pool, rng] = buildPool(state.pool, state, rng);
      if (pool.length === 0) return { ...state, phase: "finished", rngSeed: rng };
      return {
        ...state,
        phase: "bidding",
        pool,
        poolIndex: 0,
        currentPlayer: pool[0],
        currentBid: null,
        currentBidderId: null,
        timer: LOT_SECONDS,
        passed: [],
        unsold: [],
        accelerated: false,
        rngSeed: rng,
      };
    }

    case "BID": {
      const check = canBid(state, event.franchiseId);
      if (!check.ok) return state;
      const amount = nextBidAmount(state.currentBid, state.currentPlayer!.basePrice);
      return {
        ...state,
        currentBid: amount,
        currentBidderId: event.franchiseId,
        bidHistory: [
          ...state.bidHistory,
          { franchiseId: event.franchiseId, amount, playerId: state.currentPlayer!.id },
        ],
        timer: lotSeconds(state.accelerated), // every bid resets the clock
        passed: [], // a new price reopens everyone's decision
      };
    }

    case "PASS": {
      if (state.phase !== "bidding") return state;
      if (event.franchiseId === state.currentBidderId) return state; // leader is committed
      if (state.passed.includes(event.franchiseId)) return state;
      const next = { ...state, passed: [...state.passed, event.franchiseId] };
      return everyoneElseOut(next) ? resolveLot(next) : next;
    }

    case "TICK": {
      if (state.phase !== "bidding") return state;
      const timer = state.timer - 1;
      const elapsed = lotSeconds(state.accelerated) - timer;
      const noInterest = state.currentBid === null && elapsed >= NO_BID_TICKS;
      if (timer <= 0 || noInterest) return resolveLot({ ...state, timer });
      return { ...state, timer };
    }

    case "RTM_OFFER_RESPONSE": {
      if (state.phase !== "rtm" || state.rtmOffer?.stage !== "offer") return state;
      const offer = state.rtmOffer;
      if (!event.useCard) return finalizeSold(state, offer.winningFranchiseId, offer.amount, false);
      return { ...state, rtmOffer: { ...offer, stage: "raise" } };
    }

    case "RTM_RAISE": {
      if (state.phase !== "rtm" || state.rtmOffer?.stage !== "raise") return state;
      const offer = state.rtmOffer;
      let amount = offer.amount;
      if (event.raise) {
        const raised = offer.amount + nextIncrement(offer.amount);
        const winner = state.franchises.find((f) => f.id === offer.winningFranchiseId)!;
        // A raise the winner couldn't legally pay is treated as no raise.
        if (canTakeAt(winner, state.currentPlayer!, raised, remainingPool(state)).ok) {
          amount = raised;
        }
      }
      return {
        ...state,
        rtmOffer: { ...offer, amount, raiseUsed: amount !== offer.amount, stage: "decide" },
      };
    }

    case "RTM_DECIDE": {
      if (state.phase !== "rtm" || state.rtmOffer?.stage !== "decide") return state;
      const offer = state.rtmOffer;
      if (event.match) {
        const former = state.franchises.find((f) => f.id === offer.formerFranchiseId)!;
        if (canTakeAt(former, state.currentPlayer!, offer.amount, remainingPool(state)).ok) {
          return finalizeSold(state, offer.formerFranchiseId, offer.amount, true);
        }
      }
      return finalizeSold(state, offer.winningFranchiseId, offer.amount, false);
    }

    case "NEXT_PLAYER": {
      if (state.phase !== "sold" && state.phase !== "unsold") return state;
      if (allSquadsFull(state)) {
        return { ...state, phase: "finished", currentPlayer: null };
      }
      const nextIndex = state.poolIndex + 1;
      if (nextIndex < state.pool.length) {
        return {
          ...state,
          phase: "bidding",
          poolIndex: nextIndex,
          currentPlayer: state.pool[nextIndex],
          currentBid: null,
          currentBidderId: null,
          timer: lotSeconds(state.accelerated),
          passed: [],
          rtmOffer: null,
        };
      }
      // Main pool exhausted → accelerated round for unsold players whose role
      // some franchise still needs for its mandatory minimums (CLAUDE.md §7).
      if (!state.accelerated) {
        const neededRoles = new Set(
          state.franchises.flatMap((f) => Object.keys(unfilledNeeds(f.squad))),
        );
        const comeback = state.unsold.filter((p) => neededRoles.has(p.role));
        if (comeback.length > 0) {
          const comebackIds = new Set(comeback.map((p) => p.id));
          return {
            ...state,
            phase: "bidding",
            accelerated: true,
            pool: comeback,
            poolIndex: 0,
            currentPlayer: comeback[0],
            currentBid: null,
            currentBidderId: null,
            timer: ACCEL_SECONDS,
            passed: [],
            rtmOffer: null,
            unsold: state.unsold.filter((p) => !comebackIds.has(p.id)),
          };
        }
      }
      return { ...state, phase: "finished", currentPlayer: null };
    }
  }
}
