// "Finish without me": hand the rest of the auction to the simulation.
//
// The human's franchise keeps bidding — it does not simply stop, because a
// squad abandoned halfway would lose the tournament on structural penalties
// rather than on anything you decided. Their seat is played by the shared bot
// brain, respecting any shortlist ceilings that were set.

import type { AuctionState, BotPersonality } from "./types";
import { applyEvent } from "./auction";
import { botAction, botRtmMatch, botRtmRaise, botRtmUseCard } from "./bots";
import { canBid } from "./rules";
import { nextBidAmount } from "./bids";
import { shuffle, type Rng } from "./rng";

/** A steady, needs-driven stand-in for the departing human. */
export const ASSISTANT: BotPersonality = {
  name: "Your assistant",
  aggression: 0.5,
  patience: 0.45,
  budgetDiscipline: 0.6,
};

const MAX_STEPS = 400_000;

export interface AutoplayResult {
  state: AuctionState;
  log: string[];
}

/**
 * Run the auction to completion from wherever it stands. `ceilings` is the
 * human's shortlist: their seat will not bid past a ceiling it set itself.
 */
export function finishAuction(
  state: AuctionState,
  humanId: string,
  rng: Rng,
  ceilings: Record<string, number> = {},
): AutoplayResult {
  let s = state;
  let r = rng;
  const log: string[] = [];

  // The human's seat is played by the assistant for the remainder.
  s = {
    ...s,
    franchises: s.franchises.map((f) =>
      f.id === humanId ? { ...f, isHuman: false, botPersonality: f.botPersonality ?? ASSISTANT } : f,
    ),
  };

  const name = (id: string | null) => s.franchises.find((f) => f.id === id)?.name ?? "?";
  let steps = 0;

  while (s.phase !== "finished" && steps++ < MAX_STEPS) {
    switch (s.phase) {
      case "bidding": {
        let order;
        [order, r] = shuffle(s.franchises, r);
        let acted = false;
        for (const f of order) {
          if (!canBid(s, f.id).ok) continue;
          // Never blow through a ceiling the player set for themselves.
          if (f.id === humanId && s.currentPlayer) {
            const ceiling = ceilings[s.currentPlayer.id];
            if (ceiling !== undefined && nextBidAmount(s.currentBid, s.currentPlayer.basePrice) > ceiling) {
              continue;
            }
          }
          let move;
          [move, r] = botAction(s, f.id, r);
          if (move === "bid") {
            s = applyEvent(s, { type: "BID", franchiseId: f.id });
            acted = true;
            break;
          }
        }
        if (!acted && s.phase === "bidding") s = applyEvent(s, { type: "TICK" });
        break;
      }
      case "rtm": {
        const stage = s.rtmOffer!.stage;
        let v: boolean;
        if (stage === "offer") {
          [v, r] = botRtmUseCard(s, r);
          s = applyEvent(s, { type: "RTM_OFFER_RESPONSE", useCard: v });
        } else if (stage === "raise") {
          [v, r] = botRtmRaise(s, r);
          s = applyEvent(s, { type: "RTM_RAISE", raise: v });
        } else {
          [v, r] = botRtmMatch(s, r);
          s = applyEvent(s, { type: "RTM_DECIDE", match: v });
        }
        break;
      }
      case "sold":
        log.push(`SOLD  ${s.currentPlayer!.name} → ${name(s.currentBidderId)} for ${s.currentBid}L`);
        s = applyEvent(s, { type: "NEXT_PLAYER" });
        break;
      case "unsold":
        log.push(`UNSOLD  ${s.currentPlayer!.name}`);
        s = applyEvent(s, { type: "NEXT_PLAYER" });
        break;
      default:
        throw new Error(`autoplay stuck in ${s.phase}`);
    }
  }
  if (s.phase !== "finished") throw new Error("autoplay did not finish");

  // Hand the seat back, so results still show it as the player's team.
  return {
    state: {
      ...s,
      franchises: s.franchises.map((f) =>
        f.id === humanId ? { ...f, isHuman: true, botPersonality: undefined } : f,
      ),
    },
    log,
  };
}

/** How many lots are left, for the confirmation prompt. */
export function lotsRemaining(state: AuctionState): number {
  return Math.max(0, state.pool.length - state.poolIndex);
}
