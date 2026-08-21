import { describe, it, expect } from "vitest";
import { applyEvent } from "../src/engine/auction";
import { player, biddingState } from "./helpers";
import { makeDefaultFranchises } from "../src/engine/franchises";
import type { AuctionState } from "../src/engine/types";

/** Bidding state where "del" leads at 100 on a former "mum" player, timer 1. */
function rtmSetup(mumCards = 2): AuctionState {
  const star = player({ id: "star", role: "BAT", basePrice: 100 });
  const franchises = makeDefaultFranchises().map((f) =>
    f.id === "mum" ? { ...f, rtmCards: mumCards, formerPlayerIds: ["star"] } : f,
  );
  return biddingState({
    currentPlayer: star,
    pool: [star],
    currentBid: 100,
    currentBidderId: "del",
    franchises,
    timer: 1,
  });
}

const mum = (s: AuctionState) => s.franchises.find((f) => f.id === "mum")!;
const del = (s: AuctionState) => s.franchises.find((f) => f.id === "del")!;

describe("RTM flow (CLAUDE.md §7)", () => {
  it("closing a lot on a former player triggers an RTM offer", () => {
    const s = applyEvent(rtmSetup(), { type: "TICK" });
    expect(s.phase).toBe("rtm");
    expect(s.rtmOffer).toMatchObject({
      playerId: "star",
      formerFranchiseId: "mum",
      winningFranchiseId: "del",
      amount: 100,
      stage: "offer",
    });
  });

  it("no card → no offer, straight sale", () => {
    const s = applyEvent(rtmSetup(0), { type: "TICK" });
    expect(s.phase).toBe("sold");
    expect(del(s).squad.map((p) => p.id)).toEqual(["star"]);
  });

  it("declining the offer sells to the winner, card kept", () => {
    let s = applyEvent(rtmSetup(), { type: "TICK" });
    s = applyEvent(s, { type: "RTM_OFFER_RESPONSE", useCard: false });
    expect(s.phase).toBe("sold");
    expect(del(s).squad).toHaveLength(1);
    expect(mum(s).rtmCards).toBe(2);
  });

  it("match without raise: former franchise pays the winning bid, card spent", () => {
    let s = applyEvent(rtmSetup(), { type: "TICK" });
    s = applyEvent(s, { type: "RTM_OFFER_RESPONSE", useCard: true });
    s = applyEvent(s, { type: "RTM_RAISE", raise: false });
    expect(s.rtmOffer?.stage).toBe("decide");
    s = applyEvent(s, { type: "RTM_DECIDE", match: true });
    expect(s.phase).toBe("sold");
    expect(mum(s).squad.map((p) => p.id)).toEqual(["star"]);
    expect(mum(s).budget).toBe(12000 - 100);
    expect(mum(s).rtmCards).toBe(1);
    expect(del(s).squad).toHaveLength(0);
  });

  it("raise-then-match: winner raises once (100→125), former pays the raise", () => {
    let s = applyEvent(rtmSetup(), { type: "TICK" });
    s = applyEvent(s, { type: "RTM_OFFER_RESPONSE", useCard: true });
    s = applyEvent(s, { type: "RTM_RAISE", raise: true });
    expect(s.rtmOffer?.amount).toBe(125);
    expect(s.rtmOffer?.raiseUsed).toBe(true);
    s = applyEvent(s, { type: "RTM_DECIDE", match: true });
    expect(mum(s).budget).toBe(12000 - 125);
    expect(mum(s).rtmCards).toBe(1);
  });

  it("raise-then-decline: winner pays their own raise", () => {
    let s = applyEvent(rtmSetup(), { type: "TICK" });
    s = applyEvent(s, { type: "RTM_OFFER_RESPONSE", useCard: true });
    s = applyEvent(s, { type: "RTM_RAISE", raise: true });
    s = applyEvent(s, { type: "RTM_DECIDE", match: false });
    expect(s.phase).toBe("sold");
    expect(del(s).squad.map((p) => p.id)).toEqual(["star"]);
    expect(del(s).budget).toBe(12000 - 125);
    expect(mum(s).rtmCards).toBe(2); // card only spent on an actual match
  });
});
