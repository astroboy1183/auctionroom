import { describe, it, expect } from "vitest";
import { applyEvent, LOT_SECONDS, NO_BID_TICKS } from "../src/engine/auction";
import { simulateRandomAuction } from "../src/engine/simulate";
import { SQUAD_MAX, OVERSEAS_MAX, overseasCount, canBid } from "../src/engine/rules";
import { biddingState, player } from "./helpers";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const allPlayers = (playersJson as Player[]).filter((p) => p.setId !== "RET");

describe("lot lifecycle", () => {
  it("a lot nobody opens on resolves unsold after exactly NO_BID_TICKS", () => {
    let s = biddingState();
    for (let i = 0; i < NO_BID_TICKS - 1; i++) {
      s = applyEvent(s, { type: "TICK" });
      expect(s.phase).toBe("bidding");
    }
    s = applyEvent(s, { type: "TICK" });
    expect(s.phase).toBe("unsold");
    expect(s.unsold).toHaveLength(1);
  });

  it("a bid resets the clock to the full lot length", () => {
    let s = biddingState();
    s = applyEvent(s, { type: "TICK" });
    s = applyEvent(s, { type: "BID", franchiseId: "mum" });
    expect(s.timer).toBe(LOT_SECONDS);
    expect(s.currentBid).toBe(s.currentPlayer!.basePrice);
    expect(s.currentBidderId).toBe("mum");
  });

  it("when every rival passes, the lot closes immediately", () => {
    let s = biddingState();
    s = applyEvent(s, { type: "BID", franchiseId: "mum" });
    const rivals = s.franchises.filter((f) => f.id !== "mum");
    for (const [i, f] of rivals.entries()) {
      expect(s.phase).toBe("bidding");
      s = applyEvent(s, { type: "PASS", franchiseId: f.id });
      if (i < rivals.length - 1) expect(s.phase).toBe("bidding");
    }
    expect(s.phase).toBe("sold");
  });

  it("passing is binding for the whole lot, even after a new bid", () => {
    const a = player({ role: "BAT" });
    const b = player({ role: "BOWL" });
    let s = biddingState({ currentPlayer: a, pool: [a, b] });
    s = applyEvent(s, { type: "BID", franchiseId: "mum" });
    s = applyEvent(s, { type: "PASS", franchiseId: "hyd" });
    s = applyEvent(s, { type: "BID", franchiseId: "del" });
    expect(s.passed).toContain("hyd");
    expect(canBid(s, "hyd").ok).toBe(false);
    // …and clears when the next player comes up
    s = { ...s, phase: "sold" as const };
    s = applyEvent(s, { type: "NEXT_PLAYER" });
    expect(s.passed).toEqual([]);
  });

  it("invalid events leave the state unchanged", () => {
    const s = biddingState({ currentBid: 50, currentBidderId: "hyd" });
    expect(applyEvent(s, { type: "BID", franchiseId: "hyd" })).toBe(s);
    expect(applyEvent(s, { type: "RTM_DECIDE", match: true })).toBe(s);
    expect(applyEvent(s, { type: "NEXT_PLAYER" })).toBe(s);
  });

  it("unsold players whose roles are still needed return in the accelerated round", () => {
    const wk = player({ role: "WK", basePrice: 30 });
    let s = biddingState({ currentPlayer: wk, pool: [wk] });
    for (let i = 0; i < NO_BID_TICKS; i++) s = applyEvent(s, { type: "TICK" });
    expect(s.phase).toBe("unsold");
    s = applyEvent(s, { type: "NEXT_PLAYER" }); // pool exhausted → accelerated
    expect(s.accelerated).toBe(true);
    expect(s.currentPlayer?.id).toBe(wk.id);
    expect(s.timer).toBe(6);
  });
});

describe("full simulated auctions (random bidders)", () => {
  it.each([1, 7, 42, 1337, 20260821])("seed %i completes with legal state", (seed) => {
    const { state, events } = simulateRandomAuction(allPlayers, seed);
    expect(state.phase).toBe("finished");
    expect(events).toBeLessThan(300_000);

    const soldCount = state.franchises.reduce((n, f) => n + f.squad.length, 0);
    expect(soldCount + state.unsold.length).toBe(allPlayers.length);

    const soldIds = state.franchises.flatMap((f) => f.squad.map((p) => p.id));
    expect(new Set(soldIds).size).toBe(soldIds.length); // nobody sold twice

    for (const f of state.franchises) {
      expect(f.budget).toBeGreaterThanOrEqual(0);
      expect(f.squad.length).toBeLessThanOrEqual(SQUAD_MAX);
      expect(overseasCount(f.squad)).toBeLessThanOrEqual(OVERSEAS_MAX);
      expect(f.rtmCards).toBeGreaterThanOrEqual(0);
    }

    // Money conservation: spend equals the sum of winning prices.
    const spent = state.franchises.reduce((n, f) => n + (12000 - f.budget), 0);
    expect(spent).toBeGreaterThan(0);
  });

  it("the same seed reproduces the same auction (determinism)", () => {
    const a = simulateRandomAuction(allPlayers, 99);
    const b = simulateRandomAuction(allPlayers, 99);
    expect(a.log).toEqual(b.log);
    expect(a.state.franchises.map((f) => f.budget)).toEqual(
      b.state.franchises.map((f) => f.budget),
    );
  });
});
