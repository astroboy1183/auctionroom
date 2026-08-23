import { describe, it, expect } from "vitest";
import { finishAuction, lotsRemaining } from "../src/engine/autoplay";
import { applyEvent } from "../src/engine/auction";
import { createInitialState } from "../src/engine/simulate";
import { makeDefaultFranchises } from "../src/engine/franchises";
import { applyRetentions, auctionPool } from "../src/engine/retentions";
import { assignFormerPlayers } from "../src/engine/rtm";
import { attachBotPersonalities } from "../src/engine/bots";
import { unfilledNeeds, overseasCount, SQUAD_MAX, OVERSEAS_MAX } from "../src/engine/rules";
import { seedRng } from "../src/engine/rng";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];
const pool = auctionPool(all);

function startedAuction(seed: number) {
  let fs = applyRetentions(makeDefaultFranchises("hyd"), all, seed + 3);
  fs = assignFormerPlayers(fs, pool, seed + 1);
  fs = attachBotPersonalities(fs, 1, seed + 2);
  return applyEvent(createInitialState(pool, fs), { type: "START", seed });
}

describe("skip the pool (autoplay)", () => {
  it("finishes a whole auction from the very first lot", () => {
    const s = startedAuction(11);
    const { state } = finishAuction(s, "hyd", seedRng(5));
    expect(state.phase).toBe("finished");
    for (const f of state.franchises) {
      expect(f.budget).toBeGreaterThanOrEqual(0);
      expect(f.squad.length).toBeLessThanOrEqual(SQUAD_MAX);
      expect(overseasCount(f.squad)).toBeLessThanOrEqual(OVERSEAS_MAX);
    }
  });

  it("finishes from mid-auction and keeps what was already bought", () => {
    let s = startedAuction(23);
    for (let i = 0; i < 40; i++) s = applyEvent(s, { type: "TICK" });
    const before = s.franchises.map((f) => f.squad.length);
    const { state } = finishAuction(s, "hyd", seedRng(9));
    expect(state.phase).toBe("finished");
    state.franchises.forEach((f, i) => {
      expect(f.squad.length).toBeGreaterThanOrEqual(before[i]);
    });
  });

  it("keeps building the player's squad rather than abandoning it", () => {
    const { state } = finishAuction(startedAuction(31), "hyd", seedRng(3));
    const human = state.franchises.find((f) => f.id === "hyd")!;
    expect(human.squad.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(unfilledNeeds(human.squad))).toHaveLength(0);
  });

  it("hands the seat back as the human's team", () => {
    const { state } = finishAuction(startedAuction(41), "hyd", seedRng(2));
    const human = state.franchises.find((f) => f.id === "hyd")!;
    expect(human.isHuman).toBe(true);
    expect(human.botPersonality).toBeUndefined();
  });

  it("respects shortlist ceilings the player set", () => {
    const s = startedAuction(53);
    const target = s.pool[0];
    const ceiling = target.basePrice; // refuse to go even one increment above
    const { state } = finishAuction(s, "hyd", seedRng(7), { [target.id]: ceiling });
    const human = state.franchises.find((f) => f.id === "hyd")!;
    const bought = human.squad.find((p) => p.id === target.id);
    const paid = state.bidHistory.filter((b) => b.playerId === target.id && b.franchiseId === "hyd");
    if (bought) for (const b of paid) expect(b.amount).toBeLessThanOrEqual(ceiling);
  });

  it("is deterministic per seed", () => {
    const a = finishAuction(startedAuction(67), "hyd", seedRng(1));
    const b = finishAuction(startedAuction(67), "hyd", seedRng(1));
    expect(a.log).toEqual(b.log);
  });

  it("reports how many lots are left", () => {
    const s = startedAuction(71);
    expect(lotsRemaining(s)).toBe(s.pool.length);
  });
});
