import { describe, it, expect } from "vitest";
import {
  playMatch, playInnings, selectXI, battingOrder, bowlingAttack, bowlingRating, phaseOf,
  scoreline, playerOfTheMatch, OVERS, BALLS_PER_OVER, MAX_OVERS_PER_BOWLER, XI, ALL_OUT,
} from "../src/engine/match";
import { seedRng } from "../src/engine/rng";
import { makeDefaultFranchises } from "../src/engine/franchises";
import { simulateBotAuction } from "../src/engine/simulate";
import { auctionPool } from "../src/engine/retentions";
import { player } from "./helpers";
import playersJson from "../src/data/players.json";
import type { Franchise, Player } from "../src/engine/types";

const all = playersJson as Player[];
const { state } = simulateBotAuction(auctionPool(all), 8080);
const [A, B] = state.franchises;

describe("selection", () => {
  it("picks a legal XI with a keeper and every bowler it can find", () => {
    const xi = selectXI(A.squad);
    expect(xi).toHaveLength(Math.min(XI, A.squad.length));
    expect(xi.some((p) => p.role === "WK")).toBe(true);
    // A 12-man squad only has to carry 3 BOWL + 1 AR, so four is the floor.
    // A bowler-heavy squad legitimately fields more than five — eleven must
    // come from somewhere — so this is a floor, not an exact count.
    const squadBowlers = A.squad.filter((p) => p.role === "BOWL" || p.role === "AR").length;
    expect(xi.filter((p) => p.role === "BOWL" || p.role === "AR").length)
      .toBeGreaterThanOrEqual(Math.min(5, squadBowlers));
  });

  it("always fields five bowlers, dragging in part-timers when short", () => {
    const attack = bowlingAttack(selectXI(A.squad));
    expect(attack.length).toBeGreaterThanOrEqual(5);
  });

  it("a part-timer bowls markedly worse than a specialist of the same rating", () => {
    const spec = player({ role: "BOWL", rating: 85 });
    const bat = player({ role: "BAT", rating: 85 });
    expect(bowlingRating(spec)).toBeGreaterThan(bowlingRating(bat) + 25);
  });

  it("a squad with only four bowlers concedes more than one with six", () => {
    const mk = (bowlers: number, id: string): Franchise => ({
      ...makeDefaultFranchises()[0],
      id,
      squad: [
        ...Array.from({ length: bowlers }, () => player({ role: "BOWL", rating: 84 })),
        player({ role: "WK", rating: 84 }),
        ...Array.from({ length: 11 - bowlers - 1 }, () => player({ role: "BAT", rating: 84 })),
      ],
    });
    const thin = mk(4, "thin");
    const deep = mk(6, "deep");
    const bat = { ...makeDefaultFranchises()[1], id: "bat",
      squad: Array.from({ length: 11 }, () => player({ role: "BAT", rating: 86 })) };
    let thinConceded = 0, deepConceded = 0;
    for (let s = 0; s < 30; s++) {
      thinConceded += playInnings(bat, thin, seedRng(s * 11))[0].runs;
      deepConceded += playInnings(bat, deep, seedRng(s * 11))[0].runs;
    }
    expect(thinConceded).toBeGreaterThan(deepConceded);
  });

  it("openers bat first and finishers are held back", () => {
    const order = battingOrder(selectXI(A.squad));
    const bowlerIdx = order.findIndex((p) => p.role === "BOWL");
    const batIdx = order.findIndex((p) => p.role === "BAT");
    expect(batIdx).toBeLessThan(bowlerIdx === -1 ? XI : bowlerIdx);
  });

  it("phases split the innings 6 / 10 / 4", () => {
    expect(phaseOf(0)).toBe("powerplay");
    expect(phaseOf(5)).toBe("powerplay");
    expect(phaseOf(6)).toBe("middle");
    expect(phaseOf(15)).toBe("middle");
    expect(phaseOf(16)).toBe("death");
    expect(phaseOf(19)).toBe("death");
  });
});

describe("an innings", () => {
  it("never exceeds 120 balls or 10 wickets", () => {
    for (let s = 0; s < 25; s++) {
      const [inn] = playInnings(A, B, seedRng(s));
      expect(inn.balls).toBeLessThanOrEqual(OVERS * BALLS_PER_OVER);
      expect(inn.wickets).toBeLessThanOrEqual(ALL_OUT);
      expect(inn.runs).toBeGreaterThanOrEqual(0);
    }
  });

  it("no bowler exceeds the four-over cap", () => {
    for (let s = 0; s < 25; s++) {
      const [inn] = playInnings(A, B, seedRng(s * 13));
      for (const b of inn.bowling) {
        expect(b.balls).toBeLessThanOrEqual(MAX_OVERS_PER_BOWLER * BALLS_PER_OVER);
      }
    }
  });

  it("the scorecard reconciles with the team total", () => {
    const [inn] = playInnings(A, B, seedRng(99));
    const batRuns = inn.batting.reduce((n, c) => n + c.runs, 0);
    expect(batRuns).toBe(inn.runs);
    const bowlBalls = inn.bowling.reduce((n, c) => n + c.balls, 0);
    expect(bowlBalls).toBe(inn.balls);
    const bowlRuns = inn.bowling.reduce((n, c) => n + c.runs, 0);
    expect(bowlRuns).toBe(inn.runs);
    // Run-outs are not credited to the bowler, so bowlers' wickets plus
    // run-outs must equal the innings total — as on a real scorecard.
    const bowlerWickets = inn.bowling.reduce((n, c) => n + c.wickets, 0);
    const runOuts = inn.timeline.filter((b) => b.shot.dismissal === "run out").length;
    expect(bowlerWickets + runOuts).toBe(inn.wickets);
  });

  it("produces believable T20 totals", () => {
    const totals: number[] = [];
    for (let s = 0; s < 60; s++) totals.push(playInnings(A, B, seedRng(s * 7))[0].runs);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    expect(avg).toBeGreaterThan(110);
    expect(avg).toBeLessThan(230);
  });

  it("every ball records where it went, and wickets say how", () => {
    const [inn] = playInnings(A, B, seedRng(77));
    for (const b of inn.timeline) {
      expect(b.shot).toBeDefined();
      expect(Number.isFinite(b.shot.angle)).toBe(true);
      expect(b.shot.distance).toBeGreaterThanOrEqual(0);
      if (b.outcome === "W") {
        expect(b.dismissal).toBeTruthy();
        expect(b.shot.dismissal).toBeTruthy();
      } else {
        expect(b.dismissal).toBeNull();
      }
      // Sixes clear the rope; nothing else does.
      if (b.outcome === 6) expect(b.shot.distance).toBeGreaterThan(68);
    }
    // Dismissed batters carry scorecard notation.
    for (const c of inn.batting) {
      if (c.out) expect(c.how).toMatch(/b |run out|c |lbw|st /);
    }
  });

  it("a chase stops the moment the target is passed", () => {
    const [inn] = playInnings(A, B, seedRng(5), 60);
    if (inn.chasedDown) expect(inn.runs).toBeGreaterThanOrEqual(60);
  });
});

describe("a match", () => {
  it("always has exactly one winner and a stated margin", () => {
    for (let s = 0; s < 30; s++) {
      const [m] = playMatch(A, B, seedRng(s * 31));
      expect([A.id, B.id]).toContain(m.winnerId);
      expect(m.margin).toBeTruthy();
    }
  });

  it("is deterministic per seed", () => {
    const [x] = playMatch(A, B, seedRng(404));
    const [y] = playMatch(A, B, seedRng(404));
    expect(x).toEqual(y);
  });

  it("a much stronger squad wins the clear majority", () => {
    const mk = (rating: number, id: string): Franchise => ({
      ...makeDefaultFranchises()[0],
      id,
      squad: [
        ...Array.from({ length: 5 }, () => player({ role: "BAT", rating })),
        ...Array.from({ length: 5 }, () => player({ role: "BOWL", rating })),
        player({ role: "WK", rating }),
        player({ role: "AR", rating }),
      ],
    });
    const strong = mk(95, "strong");
    const weak = mk(65, "weak");
    let strongWins = 0;
    for (let s = 0; s < 40; s++) {
      const [m] = playMatch(strong, weak, seedRng(s * 17));
      if (m.winnerId === "strong") strongWins++;
    }
    expect(strongWins).toBeGreaterThan(28);
  });

  it("formats scorelines and finds a player of the match", () => {
    const [m] = playMatch(A, B, seedRng(1234));
    expect(scoreline(m.first)).toMatch(/^\d+\/\d+ \(\d+\.\d\)$/);
    const potm = playerOfTheMatch(m);
    if (potm) expect(potm.name.length).toBeGreaterThan(0);
  });
});
