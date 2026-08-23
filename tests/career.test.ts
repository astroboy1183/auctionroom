import { describe, it, expect } from "vitest";
import {
  newCareer, recordSeason, closeSeason, effectiveRating, applyForm,
  retentionCost, purseAfterRetentions, autoRetain, careerLine, slotsToFill,
  MAX_CAREER_RETENTIONS,
} from "../src/engine/career";
import { playTournament } from "../src/engine/tournament";
import { simulateBotAuction } from "../src/engine/simulate";
import { auctionPool } from "../src/engine/retentions";
import { START_BUDGET } from "../src/engine/franchises";
import { SQUAD_MAX } from "../src/engine/rules";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];
const pool = auctionPool(all);
const { state } = simulateBotAuction(pool, 3131);
const tournament = playTournament(state.franchises, 7);

describe("career records", () => {
  const career = recordSeason(newCareer("hyd"), tournament);

  it("accumulates batting and bowling from every match including playoffs", () => {
    const records = Object.values(career.records);
    expect(records.length).toBeGreaterThan(40);
    const totalRuns = records.reduce((n, r) => n + r.runs, 0);
    expect(totalRuns).toBeGreaterThan(1000);
    expect(records.some((r) => r.wickets > 0)).toBe(true);
  });

  it("form drift is bounded so nobody becomes a freak", () => {
    for (const r of Object.values(career.records)) {
      expect(r.formDelta).toBeGreaterThanOrEqual(-8);
      expect(r.formDelta).toBeLessThanOrEqual(8);
    }
  });

  it("effective ratings stay inside the rating scale", () => {
    for (const p of pool) {
      const eff = effectiveRating(p, career);
      expect(eff).toBeGreaterThanOrEqual(50);
      expect(eff).toBeLessThanOrEqual(100);
    }
  });

  it("applyForm only rewrites players whose rating actually moved", () => {
    const applied = applyForm(pool, career);
    expect(applied).toHaveLength(pool.length);
    for (const [i, p] of applied.entries()) {
      expect(p.id).toBe(pool[i].id);
      expect(p.rating).toBe(effectiveRating(pool[i], career));
    }
  });

  it("repeated seasons decay old form rather than stacking it forever", () => {
    let c = newCareer("hyd");
    for (let i = 0; i < 6; i++) c = recordSeason(c, tournament);
    for (const r of Object.values(c.records)) {
      expect(Math.abs(r.formDelta)).toBeLessThanOrEqual(8);
    }
  });
});

describe("season rollover", () => {
  const closed = closeSeason(newCareer("hyd"), tournament, state.franchises);

  it("logs the season and credits the title", () => {
    expect(closed.history).toHaveLength(1);
    expect(closed.history[0].championId).toBe(tournament.championId);
    expect(closed.titles[tournament.championId]).toBe(1);
    expect(closed.history[0].humanPosition).toBeGreaterThan(0);
  });

  it("clears squads ready for retention choices", () => {
    for (const f of state.franchises) expect(closed.carried[f.id]).toEqual([]);
  });
});

describe("retentions between seasons", () => {
  it("costs more the more you keep, and shrinks the purse", () => {
    expect(retentionCost(0)).toBe(0);
    expect(retentionCost(1)).toBeLessThan(retentionCost(2));
    expect(retentionCost(2)).toBeLessThan(retentionCost(3));
    expect(purseAfterRetentions(3)).toBeLessThan(purseAfterRetentions(1));
    expect(purseAfterRetentions(0)).toBe(START_BUDGET);
  });

  it("bots keep their best players, up to the cap", () => {
    const f = state.franchises[0];
    const career = recordSeason(newCareer("hyd"), tournament);
    const kept = autoRetain(f, career);
    expect(kept.length).toBeLessThanOrEqual(MAX_CAREER_RETENTIONS);
    const keptRatings = kept.map((id) => effectiveRating(f.squad.find((p) => p.id === id)!, career));
    const dropped = f.squad.filter((p) => !kept.includes(p.id)).map((p) => effectiveRating(p, career));
    if (dropped.length) expect(Math.min(...keptRatings)).toBeGreaterThanOrEqual(Math.max(...dropped));
  });

  it("leaves the right number of slots to fill", () => {
    expect(slotsToFill(3)).toBe(SQUAD_MAX - 3);
    expect(slotsToFill(0)).toBe(SQUAD_MAX);
  });

  it("formats a readable career line", () => {
    const career = recordSeason(newCareer("hyd"), tournament);
    const withRuns = Object.values(career.records).find((r) => r.ballsFaced > 20);
    expect(careerLine(withRuns)).toMatch(/runs @/);
    expect(careerLine(undefined)).toBe("no matches yet");
  });
});
