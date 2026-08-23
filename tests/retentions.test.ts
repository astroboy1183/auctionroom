import { describe, it, expect } from "vitest";
import { applyRetentions, auctionPool, retainedPool, RETENTION_COSTS } from "../src/engine/retentions";
import { makeDefaultFranchises, START_BUDGET } from "../src/engine/franchises";
import { SQUAD_MAX } from "../src/engine/rules";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];

describe("retentions (CLAUDE.md §7)", () => {
  it("splits the roster into a 100-lot auction pool and 16 retained", () => {
    expect(auctionPool(all)).toHaveLength(100);
    expect(retainedPool(all)).toHaveLength(16);
  });

  it("gives every franchise two players and charges the ladder", () => {
    const out = applyRetentions(makeDefaultFranchises(), all, 42);
    const cost = RETENTION_COSTS[0] + RETENTION_COSTS[1];
    for (const f of out) {
      expect(f.squad).toHaveLength(2);
      expect(f.retained).toHaveLength(2);
      expect(f.budget).toBe(START_BUDGET - cost);
      expect(f.squad.length).toBeLessThan(SQUAD_MAX);
    }
  });

  it("never retains the same player twice", () => {
    const out = applyRetentions(makeDefaultFranchises(), all, 7);
    const ids = out.flatMap((f) => f.retained);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retained players never enter the auction pool", () => {
    const out = applyRetentions(makeDefaultFranchises(), all, 11);
    const retainedIds = new Set(out.flatMap((f) => f.retained));
    for (const p of auctionPool(all)) expect(retainedIds.has(p.id)).toBe(false);
  });

  it("is deterministic per seed", () => {
    const a = applyRetentions(makeDefaultFranchises(), all, 99).map((f) => f.retained.join());
    const b = applyRetentions(makeDefaultFranchises(), all, 99).map((f) => f.retained.join());
    expect(a).toEqual(b);
    const c = applyRetentions(makeDefaultFranchises(), all, 100).map((f) => f.retained.join());
    expect(c).not.toEqual(a);
  });
});
