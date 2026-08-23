import { describe, it, expect } from "vitest";
import {
  FIELD_SETTING, BOUNDARY_RADIUS, PITCH_HALF, placeShot, nearestFielder, positionOf, dismissalText,
} from "../src/engine/field";
import { seedRng } from "../src/engine/rng";
import { player } from "./helpers";

describe("field setting", () => {
  it("fields a full eleven with a keeper", () => {
    expect(FIELD_SETTING).toHaveLength(11);
    expect(FIELD_SETTING[0].name).toBe("Wicketkeeper");
  });

  it("every fielder stands inside the boundary", () => {
    for (const pos of FIELD_SETTING) {
      const [x, z] = positionOf(pos);
      expect(Math.hypot(x, z)).toBeLessThan(BOUNDARY_RADIUS);
    }
  });

  it("puts each fielder where cricket says they go", () => {
    const at = (name: string) => positionOf(FIELD_SETTING.find((p) => p.name === name)!);
    // The keeper stands BEHIND the striker (further from the bowler).
    const [, keeperZ] = at("Wicketkeeper");
    expect(keeperZ).toBeGreaterThan(PITCH_HALF);
    // Point is square on the off side; square leg mirrors it on the leg side.
    const [pointX, pointZ] = at("Point");
    expect(pointX).toBeGreaterThan(20);
    expect(Math.abs(pointZ - PITCH_HALF)).toBeLessThan(3);
    const [legX] = at("Square leg");
    expect(legX).toBeLessThan(-20);
    // Long-on is down the ground, past the bowler.
    const [, longOnZ] = at("Long-on");
    expect(longOnZ).toBeLessThan(-PITCH_HALF);
  });

  it("finds the fielder closest to the ball's line", () => {
    expect(FIELD_SETTING[nearestFielder(90)].name).toBe("Point");
    expect(FIELD_SETTING[nearestFielder(-90)].name).toBe("Square leg");
    expect(FIELD_SETTING[nearestFielder(56)].name).toBe("Cover");
  });
});

describe("shot placement", () => {
  const bat = player({ role: "BAT", tags: ["opener"] });

  it("a six clears the rope in the air", () => {
    for (let s = 0; s < 20; s++) {
      const [shot] = placeShot(6, bat, seedRng(s));
      expect(shot.distance).toBeGreaterThan(BOUNDARY_RADIUS);
      expect(shot.aerial).toBe(true);
      expect(shot.fielder).toBeNull();
    }
  });

  it("a four reaches the rope but nobody fields it", () => {
    for (let s = 0; s < 20; s++) {
      const [shot] = placeShot(4, bat, seedRng(s));
      expect(shot.distance).toBeGreaterThanOrEqual(BOUNDARY_RADIUS);
      expect(shot.fielder).toBeNull();
    }
  });

  it("a dot goes nowhere much and someone picks it up", () => {
    for (let s = 0; s < 20; s++) {
      const [shot] = placeShot(0, bat, seedRng(s));
      expect(shot.distance).toBeLessThan(20);
      expect(shot.fielder).not.toBeNull();
    }
  });

  it("wickets always carry a dismissal type", () => {
    const kinds = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const [shot] = placeShot("W", bat, seedRng(s));
      expect(shot.dismissal).toBeTruthy();
      kinds.add(shot.dismissal!);
    }
    // All five modes should show up across enough deliveries.
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    expect(kinds.has("caught")).toBe(true);
    expect(kinds.has("bowled")).toBe(true);
  });

  it("power hitters favour the leg side, classical players the off", () => {
    const power = player({ role: "BAT", tags: ["six-hitter"] });
    const classy = player({ role: "BAT", tags: ["elegant"] });
    const legSide = (p: typeof power) => {
      let n = 0;
      for (let s = 0; s < 120; s++) if (placeShot(4, p, seedRng(s))[0].angle < 0) n++;
      return n;
    };
    expect(legSide(power)).toBeGreaterThan(legSide(classy));
  });

  it("writes scorecard notation", () => {
    expect(dismissalText({ angle: 0, distance: 0, aerial: false, fielder: null, dismissal: "bowled" }, "Bumrah"))
      .toBe("b Bumrah");
    expect(dismissalText({ angle: 0, distance: 0, aerial: false, fielder: null, dismissal: "lbw" }, "Bumrah"))
      .toBe("lbw b Bumrah");
    expect(dismissalText({ angle: 50, distance: 30, aerial: true, fielder: 3, dismissal: "caught" }, "Bumrah", "Cover"))
      .toBe("c Cover b Bumrah");
  });

  it("is deterministic per seed", () => {
    expect(placeShot(4, bat, seedRng(9))[0]).toEqual(placeShot(4, bat, seedRng(9))[0]);
  });
});
