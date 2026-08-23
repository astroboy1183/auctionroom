import { describe, it, expect } from "vitest";
import { tradeValue, canTrade, generateOffers, applyTrade } from "../src/engine/trading";
import { applyFormat, auctionPool } from "../src/engine/retentions";
import { newCareer } from "../src/engine/career";
import { simulateBotAuction } from "../src/engine/simulate";
import { seedRng } from "../src/engine/rng";
import { OVERSEAS_MAX, SQUAD_MAX, overseasCount } from "../src/engine/rules";
import { player } from "./helpers";
import playersJson from "../src/data/players.json";
import type { Player } from "../src/engine/types";

const all = playersJson as Player[];
const pool = auctionPool(all);
const { state } = simulateBotAuction(pool, 555);
const career = newCareer("hyd");
const human = state.franchises[0];
const others = state.franchises.slice(1);

describe("trade valuation", () => {
  it("values a player who fills a hole above one who doesn't", () => {
    const needy = { ...human, squad: [] };
    const stacked = {
      ...human,
      squad: Array.from({ length: 6 }, () => player({ role: "BOWL", rating: 80 })),
    };
    const bowler = player({ role: "BOWL", rating: 85 });
    expect(tradeValue(bowler, needy, career)).toBeGreaterThan(tradeValue(bowler, stacked, career));
  });
});

describe("trade legality", () => {
  it("allows an even swap between two full squads", () => {
    const full = { ...human, squad: Array.from({ length: SQUAD_MAX }, () => player({ role: "BAT" })) };
    const partner = { ...others[0], squad: Array.from({ length: SQUAD_MAX }, () => player({ role: "BAT" })) };
    // The incoming player must genuinely be on the partner's roster, or the
    // partner ends up a player over the cap.
    const offer = { give: full.squad[0], receive: partner.squad[0], cash: 0, partnerId: partner.id };
    expect(canTrade(full, partner, offer).ok).toBe(true);
  });

  it("rejects taking a player the partner does not actually have", () => {
    const full = { ...human, squad: Array.from({ length: SQUAD_MAX }, () => player({ role: "BAT" })) };
    const partner = { ...others[0], squad: Array.from({ length: SQUAD_MAX }, () => player({ role: "BAT" })) };
    const stranger = player({ role: "BAT" });
    const offer = { give: full.squad[0], receive: stranger, cash: 0, partnerId: partner.id };
    expect(canTrade(full, partner, offer).ok).toBe(false);
  });

  it("rejects a trade nobody can afford", () => {
    const broke = { ...human, budget: 0 };
    const offer = { give: broke.squad[0], receive: null, cash: -500, partnerId: others[0].id };
    expect(canTrade(broke, others[0], offer).ok).toBe(false);
  });

  it("rejects a trade that would breach the overseas cap", () => {
    const maxed = {
      ...human,
      squad: [
        ...Array.from({ length: OVERSEAS_MAX }, () => player({ role: "BAT", overseas: true })),
        player({ role: "BOWL" }),
      ],
    };
    const offer = {
      give: maxed.squad[OVERSEAS_MAX], // give away the domestic one
      receive: player({ role: "BOWL", overseas: true }),
      cash: 0,
      partnerId: others[0].id,
    };
    expect(canTrade(maxed, others[0], offer).ok).toBe(false);
  });
});

describe("offer generation and execution", () => {
  it("only offers deals the partner actually wants", () => {
    const [offers] = generateOffers(human, others, career, seedRng(1));
    for (const o of offers) {
      const partner = others.find((f) => f.id === o.partnerId)!;
      expect(tradeValue(o.give, partner, career)).toBeGreaterThan(tradeValue(o.give, human, career));
    }
  });

  it("executing a trade moves both players and the cash", () => {
    const [offers] = generateOffers(human, others, career, seedRng(4));
    if (offers.length === 0) return;
    const o = offers[0];
    const after = applyTrade(state.franchises, human.id, o);
    const me = after.find((f) => f.id === human.id)!;
    const them = after.find((f) => f.id === o.partnerId)!;

    expect(me.squad.some((p) => p.id === o.give.id)).toBe(false);
    expect(them.squad.some((p) => p.id === o.give.id)).toBe(true);
    expect(me.budget).toBe(human.budget + o.cash);
    if (o.receive) {
      expect(me.squad.some((p) => p.id === o.receive!.id)).toBe(true);
      expect(them.squad.some((p) => p.id === o.receive!.id)).toBe(false);
    }
  });

  it("leaves both squads legal", () => {
    const [offers] = generateOffers(human, others, career, seedRng(9));
    for (const o of offers.slice(0, 3)) {
      const after = applyTrade(state.franchises, human.id, o);
      for (const f of after) {
        expect(f.squad.length).toBeLessThanOrEqual(SQUAD_MAX);
        expect(overseasCount(f.squad)).toBeLessThanOrEqual(OVERSEAS_MAX);
        expect(f.budget).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is deterministic per seed", () => {
    const [a] = generateOffers(human, others, career, seedRng(77));
    const [b] = generateOffers(human, others, career, seedRng(77));
    expect(a).toEqual(b);
  });
});

describe("auction formats", () => {
  it("sprint halves the pool and keeps the best players", () => {
    const sprint = applyFormat(pool, "sprint");
    expect(sprint.length).toBe(Math.ceil(pool.length / 2));
    const worstKept = Math.min(...sprint.map((p) => p.rating));
    const dropped = pool.filter((p) => !sprint.includes(p));
    expect(Math.max(...dropped.map((p) => p.rating))).toBeLessThanOrEqual(worstKept);
  });

  it("reverse keeps every player but flips the order", () => {
    const rev = applyFormat(pool, "reverse");
    expect(rev).toHaveLength(pool.length);
    expect(rev[0].id).toBe(pool[pool.length - 1].id);
  });

  it("classic and mystery leave the pool intact", () => {
    expect(applyFormat(pool, "classic")).toHaveLength(pool.length);
    const mystery = applyFormat(pool, "mystery");
    expect(mystery).toHaveLength(pool.length);
    // The engine still sees true ratings — only the UI hides them.
    expect(mystery[0].rating).toBe(pool[0].rating);
  });
});
