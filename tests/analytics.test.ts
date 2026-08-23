import { describe, it, expect } from "vitest";
import { analyse } from "../src/engine/analytics";
import { simulateBotAuction } from "../src/engine/simulate";
import { auctionPool } from "../src/engine/retentions";
import { START_BUDGET } from "../src/engine/franchises";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];
const { state } = simulateBotAuction(auctionPool(all), 1717);

describe("auction analytics", () => {
  const a = analyse(state, START_BUDGET);

  it("finds a steal, an overpay and a biggest sale", () => {
    expect(a.steal).not.toBeNull();
    expect(a.overpay).not.toBeNull();
    expect(a.biggestSale).not.toBeNull();
    expect(a.overpay!.ratio).toBeGreaterThanOrEqual(a.steal!.ratio);
  });

  it("the biggest sale is the highest price paid", () => {
    const prices = state.franchises.flatMap((f) =>
      f.squad.filter((p) => !f.retained.includes(p.id)).map((p) => {
        const bids = state.bidHistory.filter((b) => b.playerId === p.id);
        return bids.length ? bids[bids.length - 1].amount : 0;
      }),
    );
    expect(a.biggestSale!.price).toBe(Math.max(...prices));
  });

  it("excludes retained players, who were never auctioned", () => {
    const retainedIds = new Set(state.franchises.flatMap((f) => f.retained));
    for (const h of [a.steal, a.overpay, a.biggestSale]) {
      if (h) expect(retainedIds.has(h.player.id)).toBe(false);
    }
  });

  it("counts reconcile with the auction", () => {
    expect(a.soldCount + a.unsoldCount).toBeLessThanOrEqual(100);
    expect(a.totalSpend).toBeGreaterThan(0);
    expect(a.mostContested!.bids).toBeGreaterThan(0);
  });
});
