import { describe, it, expect } from "vitest";
import { canBid, canTakeAt, reserve, unfilledNeeds, SQUAD_MAX, OVERSEAS_MAX } from "../src/engine/rules";
import { player, franchise, biddingState } from "./helpers";

describe("squad validation", () => {
  it("reports unfilled mandatory needs", () => {
    const squad = [player({ role: "BAT" }), player({ role: "WK" })];
    expect(unfilledNeeds(squad)).toEqual({ BAT: 2, BOWL: 3, AR: 1 });
    const full = [
      ...Array.from({ length: 3 }, () => player({ role: "BAT" })),
      ...Array.from({ length: 3 }, () => player({ role: "BOWL" })),
      player({ role: "WK" }),
      player({ role: "AR" }),
    ];
    expect(unfilledNeeds(full)).toEqual({});
  });

  it("blocks bids when the squad is full", () => {
    const f = franchise({ squad: Array.from({ length: SQUAD_MAX }, () => player({ role: "BAT" })) });
    expect(canTakeAt(f, player({ role: "WK" }), 30, []).ok).toBe(false);
  });

  it("blocks overseas players at the overseas cap, allows domestic", () => {
    const f = franchise({
      squad: Array.from({ length: OVERSEAS_MAX }, () => player({ role: "BAT", overseas: true })),
    });
    expect(canTakeAt(f, player({ role: "BOWL", overseas: true }), 30, []).ok).toBe(false);
    expect(canTakeAt(f, player({ role: "BOWL" }), 30, []).ok).toBe(true);
  });

  it("blocks filling a slot that mandatory roles still need (slot-lock)", () => {
    // 13 players, no WK, no AR → both remaining slots are spoken for.
    const f = franchise({
      squad: [
        ...Array.from({ length: 7 }, () => player({ role: "BAT" })),
        ...Array.from({ length: 6 }, () => player({ role: "BOWL" })),
      ],
    });
    const remaining = [player({ role: "WK" }), player({ role: "AR" })];
    expect(canTakeAt(f, player({ role: "BAT" }), 30, remaining).ok).toBe(false);
    expect(canTakeAt(f, player({ role: "WK" }), 30, remaining).ok).toBe(true);
  });
});

describe("reserve / soft-lock (CLAUDE.md §5)", () => {
  it("reserve = cheapest remaining players covering each deficit", () => {
    const squad = [player({ role: "WK" }), player({ role: "AR" })]; // needs 3 BAT + 3 BOWL
    const remaining = [
      player({ role: "BAT", basePrice: 30 }),
      player({ role: "BAT", basePrice: 50 }),
      player({ role: "BAT", basePrice: 200 }),
      player({ role: "BAT", basePrice: 40 }),
      player({ role: "BOWL", basePrice: 30 }),
      player({ role: "BOWL", basePrice: 30 }),
      player({ role: "BOWL", basePrice: 75 }),
    ];
    // 3 cheapest BAT = 30+40+50, 3 cheapest BOWL = 30+30+75
    expect(reserve(squad, remaining)).toBe(120 + 135);
  });

  it("roles missing from the pool add nothing to reserve", () => {
    const squad = [player({ role: "WK" })];
    expect(reserve(squad, [])).toBe(0);
  });

  it("rejects a bid that would dip the budget below the reserve", () => {
    const poor = franchise({ id: "hyd", budget: 130 });
    const current = player({ role: "AR", basePrice: 50 });
    const state = biddingState({
      currentPlayer: current,
      pool: [
        current,
        player({ role: "BAT", basePrice: 30 }),
        player({ role: "BAT", basePrice: 30 }),
        player({ role: "BAT", basePrice: 30 }),
        player({ role: "BOWL", basePrice: 30 }),
        player({ role: "BOWL", basePrice: 30 }),
        player({ role: "BOWL", basePrice: 30 }),
        player({ role: "WK", basePrice: 30 }),
      ],
      franchises: [poor],
    });
    // Reserve after winning: 3 BAT + 3 BOWL + 1 WK at 30 = 210 > 130-50.
    expect(canBid(state, "hyd").ok).toBe(false);
    const rich = { ...poor, budget: 1000 };
    expect(canBid({ ...state, franchises: [rich] }, "hyd").ok).toBe(true);
  });

  it("never lets the highest bidder outbid themselves", () => {
    const state = biddingState({ currentBid: 50, currentBidderId: "hyd" });
    expect(canBid(state, "hyd").ok).toBe(false);
    expect(canBid(state, "mum").ok).toBe(true);
  });
});
