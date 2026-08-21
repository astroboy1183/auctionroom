import { describe, it, expect } from "vitest";
import { adjustedEstimate, attachBotPersonalities, botAction, rawValueEstimate, ratingValue } from "../src/engine/bots";
import { simulateBotAuction } from "../src/engine/simulate";
import { unfilledNeeds, overseasCount, SQUAD_MAX, OVERSEAS_MAX } from "../src/engine/rules";
import { makeDefaultFranchises } from "../src/engine/franchises";
import { biddingState } from "./helpers";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const allPlayers = playersJson as Player[];

function bottedFranchises(difficulty = 1, seed = 7) {
  return attachBotPersonalities(
    makeDefaultFranchises().map((f) => ({ ...f, isHuman: false })),
    difficulty,
    seed,
  );
}

describe("valuation", () => {
  it("rating value is exponential: stars cost multiples", () => {
    expect(ratingValue(60)).toBe(30);
    expect(ratingValue(85)).toBeGreaterThan(3 * ratingValue(70));
    expect(ratingValue(98)).toBeGreaterThan(2000);
  });

  it("The Accountant's ceiling never exceeds the raw value estimate", () => {
    const franchises = bottedFranchises();
    const accountant = franchises.find((f) => f.botPersonality?.name === "The Accountant")!;
    const state = biddingState({ franchises, pool: allPlayers, poolIndex: -1 });
    for (const player of allPlayers) {
      expect(adjustedEstimate(state, accountant, player)).toBeLessThanOrEqual(
        rawValueEstimate(state, accountant, player),
      );
    }
  });

  it("The Shark's ceiling on a fancied player exceeds The Accountant's", () => {
    const franchises = bottedFranchises();
    const shark = franchises.find((f) => f.botPersonality?.name === "The Shark")!;
    const accountant = franchises.find((f) => f.botPersonality?.name === "The Accountant")!;
    const state = biddingState({ franchises, pool: allPlayers, poolIndex: -1 });
    const star = allPlayers.find((p) => p.id === "virat-kohli")!;
    expect(adjustedEstimate(state, shark, star)).toBeGreaterThan(
      adjustedEstimate(state, accountant, star),
    );
  });
});

describe("bidding behaviour", () => {
  it("patience gates entry: the Shark acts early, the Accountant lurks", () => {
    const franchises = bottedFranchises();
    const star = allPlayers.find((p) => p.id === "virat-kohli")!;
    // Fresh lot, full timer: elapsed 0.
    const state = biddingState({ franchises, currentPlayer: star, pool: [star], timer: 10 });
    const shark = franchises.find((f) => f.botPersonality?.name === "The Shark")!;
    const accountant = franchises.find((f) => f.botPersonality?.name === "The Accountant")!;
    // Accountant's entry tick is ~6: at elapsed 0 it never acts, whatever the roll.
    for (let rng = 0; rng < 50; rng++) {
      expect(botAction(state, accountant.id, rng)[0]).toBeNull();
    }
    // The Shark (entry tick 2) acts on at least some rolls once it's in.
    const later = { ...state, timer: 8 };
    const sharkMoves = Array.from({ length: 50 }, (_, rng) => botAction(later, shark.id, rng)[0]);
    expect(sharkMoves).toContain("bid");
  });

  it("bots pass when the price leaves their number", () => {
    const franchises = bottedFranchises();
    const cheap = allPlayers.find((p) => p.rating <= 75)!;
    const state = biddingState({
      franchises,
      currentPlayer: cheap,
      pool: [cheap],
      currentBid: 3000, // wildly over any estimate for a 75-rated player
      currentBidderId: "hyd",
      timer: 3,
    });
    for (const f of franchises.filter((x) => x.id !== "hyd")) {
      expect(botAction(state, f.id, 1)[0]).toBe("pass");
    }
  });
});

describe("bot auctions at scale", () => {
  const SEEDS = Array.from({ length: 25 }, (_, i) => 1000 + i * 37);

  it("25 seeded bot auctions finish with legal squads and sane balance", () => {
    let minimumsMet = 0;
    for (const seed of SEEDS) {
      const { state } = simulateBotAuction(allPlayers, seed);
      expect(state.phase).toBe("finished");
      for (const f of state.franchises) {
        expect(f.budget).toBeGreaterThanOrEqual(0);
        expect(f.squad.length).toBeLessThanOrEqual(SQUAD_MAX);
        expect(overseasCount(f.squad)).toBeLessThanOrEqual(OVERSEAS_MAX);
        if (Object.keys(unfilledNeeds(f.squad)).length === 0) minimumsMet++;
      }
    }
    // Occasional mandatory miss is legal, realistic drama — but must be rare.
    expect(minimumsMet).toBeGreaterThanOrEqual(SEEDS.length * 4 * 0.9);
  }, 120_000);

  // The full CLAUDE.md §10 sweep. Heavy, so it runs when FULL_SIM=1 is set
  // (run once per phase gate) rather than on every dev test cycle.
  it.runIf(process.env.FULL_SIM)("1000 bot auctions all complete validly", () => {
    for (let i = 0; i < 1000; i++) {
      const { state } = simulateBotAuction(allPlayers, 20260821 + i);
      expect(state.phase).toBe("finished");
      for (const f of state.franchises) {
        expect(f.budget).toBeGreaterThanOrEqual(0);
        expect(f.squad.length).toBeLessThanOrEqual(SQUAD_MAX);
        expect(overseasCount(f.squad)).toBeLessThanOrEqual(OVERSEAS_MAX);
      }
    }
  }, 600_000);

  it("bot auctions are deterministic per seed", () => {
    const a = simulateBotAuction(allPlayers, 555);
    const b = simulateBotAuction(allPlayers, 555);
    expect(a.log).toEqual(b.log);
  });
});
