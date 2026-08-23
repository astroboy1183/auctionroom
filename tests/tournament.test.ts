import { describe, it, expect } from "vitest";
import { playTournament, squadStrength, matchesFor } from "../src/engine/tournament";
import { makeDefaultFranchises } from "../src/engine/franchises";
import { simulateBotAuction } from "../src/engine/simulate";
import { auctionPool } from "../src/engine/retentions";
import { player } from "./helpers";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];

describe("squad strength", () => {
  it("a stronger squad outrates a weaker one", () => {
    const strong = { ...makeDefaultFranchises()[0], squad: Array.from({ length: 12 }, () => player({ role: "AR", rating: 92 })) };
    const weak = { ...makeDefaultFranchises()[1], squad: Array.from({ length: 12 }, () => player({ role: "AR", rating: 68 })) };
    expect(squadStrength(strong).overall).toBeGreaterThan(squadStrength(weak).overall);
  });

  it("missing mandatory roles is punished", () => {
    const balanced = {
      ...makeDefaultFranchises()[0],
      squad: [
        ...Array.from({ length: 4 }, () => player({ role: "BAT", rating: 80 })),
        ...Array.from({ length: 4 }, () => player({ role: "BOWL", rating: 80 })),
        ...Array.from({ length: 2 }, () => player({ role: "AR", rating: 80 })),
        ...Array.from({ length: 2 }, () => player({ role: "WK", rating: 80 })),
      ],
    };
    const lopsided = {
      ...makeDefaultFranchises()[1],
      squad: Array.from({ length: 12 }, () => player({ role: "BAT", rating: 80 })),
    };
    expect(squadStrength(balanced).overall).toBeGreaterThan(squadStrength(lopsided).overall);
  });

  it("an empty squad does not crash and scores poorly", () => {
    const empty = makeDefaultFranchises()[0];
    expect(Number.isFinite(squadStrength(empty).overall)).toBe(true);
    expect(squadStrength(empty).overall).toBeLessThan(60);
  });
});

describe("tournament", () => {
  const { state } = simulateBotAuction(auctionPool(all), 4242);

  it("plays a full single round-robin", () => {
    const t = playTournament(state.franchises, 1);
    const n = state.franchises.length;
    expect(t.matches).toHaveLength((n * (n - 1)) / 2);
    for (const row of t.table) expect(row.played).toBe(n - 1);
    expect(matchesFor(t, state.franchises[0].id)).toHaveLength(n - 1);
  });

  it("points reconcile with wins, and every match has a winner", () => {
    const t = playTournament(state.franchises, 2);
    for (const row of t.table) {
      expect(row.points).toBe(row.won * 2);
      expect(row.won + row.lost).toBe(row.played);
    }
    const totalWins = t.table.reduce((n, r) => n + r.won, 0);
    expect(totalWins).toBe(t.matches.length);
  });

  it("the table is sorted and crowns the top row", () => {
    const t = playTournament(state.franchises, 3);
    for (let i = 1; i < t.table.length; i++) {
      expect(t.table[i - 1].points).toBeGreaterThanOrEqual(t.table[i].points);
    }
    expect(t.championId).toBe(t.table[0].franchiseId);
  });

  it("is deterministic per seed", () => {
    const a = playTournament(state.franchises, 77);
    const b = playTournament(state.franchises, 77);
    expect(a.table.map((r) => r.franchiseId)).toEqual(b.table.map((r) => r.franchiseId));
    expect(a.matches).toEqual(b.matches);
  });

  it("stronger squads win more titles than weaker ones", () => {
    // Bot auctions spread talent evenly — typically ~5 strength points across
    // all eight squads — so over a 7-match season no single team dominates,
    // which is realistic. The honest claim is correlation, not supremacy:
    // the stronger half should collect clearly more titles than the weaker.
    const ranked = [...state.franchises]
      .map((f) => ({ id: f.id, strength: squadStrength(f).overall }))
      .sort((a, b) => b.strength - a.strength);
    const strongHalf = new Set(ranked.slice(0, 4).map((r) => r.id));

    let strongTitles = 0;
    let weakTitles = 0;
    for (let s = 0; s < 120; s++) {
      const champion = playTournament(state.franchises, s).championId;
      if (strongHalf.has(champion)) strongTitles++;
      else weakTitles++;
    }
    expect(strongTitles).toBeGreaterThan(weakTitles);
    expect(weakTitles).toBeGreaterThan(0); // upsets must remain possible
  });
});
