// Field geometry and shot placement — the layer between "the ball was worth 4
// runs" and "it was driven through extra cover and beat the sweeper".
//
// Coordinates are in metres on a real-sized ground, origin at the middle of
// the pitch, +z toward the striker's end, +x the off side for a right-hander.
// The renderer can use these directly.

import type { Player } from "./types";
import type { Outcome } from "./match";
import { nextFloat, type Rng } from "./rng";

export const BOUNDARY_RADIUS = 68;   // metres
export const PITCH_HALF = 10.06;     // half a 22-yard pitch

export interface FieldPosition {
  name: string;
  /** Degrees: 0 = straight back past the bowler, +ve = off side. */
  angle: number;
  /** Metres from the striker. */
  distance: number;
}

/**
 * A standard T20 field for a right-hander: keeper, bowler and nine others.
 * Positions are the recognisable ones so the view reads as cricket to anyone
 * who watches the sport.
 */
export const FIELD_SETTING: FieldPosition[] = [
  { name: "Wicketkeeper", angle: 180, distance: 14 },
  { name: "Slip", angle: 155, distance: 15 },
  { name: "Point", angle: 90, distance: 30 },
  { name: "Cover", angle: 55, distance: 34 },
  { name: "Mid-off", angle: 25, distance: 32 },
  { name: "Mid-on", angle: -25, distance: 32 },
  { name: "Midwicket", angle: -55, distance: 34 },
  { name: "Square leg", angle: -90, distance: 30 },
  { name: "Fine leg", angle: -150, distance: 52 },
  { name: "Third man", angle: 150, distance: 52 },
  { name: "Long-on", angle: -15, distance: 58 },
];

/**
 * Where a fielder stands, in ground coordinates.
 *
 * Angle 0 points straight down the ground past the bowler (−z); 180 is behind
 * the striker, where the keeper stands; +90 is square on the off side. The
 * striker is at +PITCH_HALF, so every position is measured from there.
 */
export function positionOf(pos: FieldPosition): [number, number] {
  const rad = (pos.angle * Math.PI) / 180;
  return [Math.sin(rad) * pos.distance, PITCH_HALF - Math.cos(rad) * pos.distance];
}

export type Dismissal = "bowled" | "caught" | "lbw" | "run out" | "stumped";

export interface Shot {
  /** Degrees, as FieldPosition.angle. */
  angle: number;
  /** How far the ball travelled, in metres. */
  distance: number;
  /** True for a lofted shot — the renderer arcs it. */
  aerial: boolean;
  /** Index into FIELD_SETTING of whoever dealt with it, if anyone. */
  fielder: number | null;
  dismissal: Dismissal | null;
}

/** Shot-making zones, weighted by what the batter is known for. */
function preferredAngles(batter: Player): number[] {
  const tags = batter.tags;
  const off = [25, 55, 90, 150];        // mid-off through third man
  const leg = [-25, -55, -90, -150];    // mid-on through fine leg
  const straight = [0, 15, -15];
  if (tags.includes("opener") || tags.includes("elegant") || tags.includes("technician")) {
    return [...off, ...straight];       // classical players score square of the wicket
  }
  if (tags.includes("six-hitter") || tags.includes("power-hitter") || tags.includes("finisher")) {
    return [...leg, ...straight, ...straight]; // power players go leg side and straight
  }
  return [...off, ...leg, ...straight];
}

function pick<T>(items: T[], rng: Rng): [T, Rng] {
  const [f, next] = nextFloat(rng);
  return [items[Math.floor(f * items.length)], next];
}

/**
 * Turn an outcome into something watchable: a direction, a distance, whether
 * it was in the air, and who fielded it.
 */
export function placeShot(
  outcome: Outcome,
  batter: Player,
  rng: Rng,
): [Shot, Rng] {
  let r = rng;
  const roll = (): number => {
    const [f, next] = nextFloat(r);
    r = next;
    return f;
  };

  let base: number;
  [base, r] = pick(preferredAngles(batter), r);
  const angle = base + (roll() - 0.5) * 22; // scatter within the zone

  const nearest = nearestFielder(angle);

  if (outcome === "W") {
    const kind = roll();
    // Bowled and LBW are beaten-by-the-ball dismissals: no shot placement.
    if (kind < 0.3) {
      return [{ angle: 0, distance: 0, aerial: false, fielder: null, dismissal: "bowled" }, r];
    }
    if (kind < 0.42) {
      return [{ angle: 0, distance: 0, aerial: false, fielder: null, dismissal: "lbw" }, r];
    }
    if (kind < 0.5) {
      return [{ angle: 180, distance: 14, aerial: false, fielder: 0, dismissal: "stumped" }, r];
    }
    if (kind < 0.58) {
      return [{ angle, distance: 22, aerial: false, fielder: nearest, dismissal: "run out" }, r];
    }
    // Caught: in the air, and it carries to somebody.
    return [{ angle, distance: 18 + roll() * 38, aerial: true, fielder: nearest, dismissal: "caught" }, r];
  }

  if (outcome === 6) {
    return [{ angle, distance: BOUNDARY_RADIUS + 4 + roll() * 12, aerial: true, fielder: null, dismissal: null }, r];
  }
  if (outcome === 4) {
    // Mostly along the ground, occasionally over the top and landing safe.
    return [{ angle, distance: BOUNDARY_RADIUS, aerial: roll() < 0.25, fielder: null, dismissal: null }, r];
  }
  if (outcome === 0) {
    // Defended, or straight to a close fielder.
    return [{ angle, distance: 4 + roll() * 12, aerial: false, fielder: nearest, dismissal: null }, r];
  }
  // 1, 2 or 3: pushed into a gap and run.
  const distance = 20 + outcome * 9 + roll() * 12;
  return [{ angle, distance, aerial: false, fielder: nearest, dismissal: null }, r];
}

/** Whoever is closest to the ball's line. */
export function nearestFielder(angle: number): number {
  let best = 0;
  let bestGap = 999;
  for (const [i, pos] of FIELD_SETTING.entries()) {
    let gap = Math.abs(pos.angle - angle);
    if (gap > 180) gap = 360 - gap;
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

/** Scorecard notation: "c Cover b Bumrah", "b Bumrah", "lbw b Bumrah". */
export function dismissalText(shot: Shot, bowler: string, fielderName?: string): string {
  switch (shot.dismissal) {
    case "bowled": return `b ${bowler}`;
    case "lbw": return `lbw b ${bowler}`;
    case "caught": return `c ${fielderName ?? "fielder"} b ${bowler}`;
    case "stumped": return `st ${fielderName ?? "keeper"} b ${bowler}`;
    case "run out": return `run out (${fielderName ?? "fielder"})`;
    default: return "not out";
  }
}
