import { describe, it, expect } from "vitest";
import players from "../src/data/players.json";
import { SETS, SET_SIZES, POOL_SIZE } from "../src/engine/sets";
import type { Player } from "../src/engine/types";

const pool = players as Player[];

describe("players.json sanity (CLAUDE.md §6/§7)", () => {
  it("has exactly 100 players with unique ids", () => {
    expect(pool.length).toBe(POOL_SIZE);
    expect(new Set(pool.map(p => p.id)).size).toBe(POOL_SIZE);
  });

  it("role distribution is within spec bands", () => {
    const n = (r: string) => pool.filter(p => p.role === r).length;
    expect(n("BAT")).toBeGreaterThanOrEqual(24);
    expect(n("BAT")).toBeLessThanOrEqual(32);
    expect(n("BOWL")).toBeGreaterThanOrEqual(32);
    expect(n("BOWL")).toBeLessThanOrEqual(40);
    expect(n("AR")).toBeGreaterThanOrEqual(18);
    expect(n("AR")).toBeLessThanOrEqual(24);
    expect(n("WK")).toBeGreaterThanOrEqual(12);
    expect(n("WK")).toBeLessThanOrEqual(18);
  });

  it("has ~38 overseas players (bowler-heavy, ~40% OS, like real lists)", () => {
    const os = pool.filter(p => p.overseas).length;
    expect(os).toBeGreaterThanOrEqual(34);
    expect(os).toBeLessThanOrEqual(42);
  });

  it("base prices and ratings are in range", () => {
    for (const p of pool) {
      expect(p.basePrice).toBeGreaterThanOrEqual(30);
      expect(p.basePrice).toBeLessThanOrEqual(200);
      expect(p.rating).toBeGreaterThanOrEqual(60);
      expect(p.rating).toBeLessThanOrEqual(100);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it("every setId maps to a defined set, with the declared size", () => {
    const setIds = new Set(SETS.map(s => s.id));
    for (const p of pool) expect(setIds.has(p.setId)).toBe(true);
    for (const s of SETS) {
      expect(pool.filter(p => p.setId === s.id).length).toBe(SET_SIZES[s.id]);
    }
  });

  it("pool can satisfy 4 franchises' minimum role requirements", () => {
    // ≥3 BAT, ≥3 BOWL, ≥1 WK, ≥1 AR per franchise × 4 franchises
    const n = (r: string) => pool.filter(p => p.role === r).length;
    expect(n("BAT")).toBeGreaterThanOrEqual(12);
    expect(n("BOWL")).toBeGreaterThanOrEqual(12);
    expect(n("WK")).toBeGreaterThanOrEqual(4);
    expect(n("AR")).toBeGreaterThanOrEqual(4);
  });
});
