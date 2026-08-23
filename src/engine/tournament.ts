// Post-auction tournament — the payoff. The squad you assembled plays the
// other seven, so the auction is judged by results rather than by a points
// formula. Pure and seeded like everything else in engine/.

import type { Franchise, Player, Role } from "./types";
import { nextFloat, seedRng, type Rng } from "./rng";
import { MIN_ROLES } from "./rules";

/** Best N ratings for a role, padded with a replacement-level filler so a
 * short squad is punished rather than crashing. */
const REPLACEMENT = 55;

function topRatings(squad: Player[], roles: Role[], n: number): number[] {
  const pool = squad
    .filter((p) => roles.includes(p.role))
    .map((p) => p.rating)
    .sort((a, b) => b - a);
  return Array.from({ length: n }, (_, i) => pool[i] ?? REPLACEMENT);
}

export interface Strength {
  batting: number;
  bowling: number;
  overall: number;
}

/**
 * Squad → match strength. Batting leans on the top six who can hold a bat,
 * bowling on the five who bowl; all-rounders count for both, which is what
 * makes them worth overpaying for.
 */
export function squadStrength(franchise: Franchise): Strength {
  const squad = franchise.squad;
  const batting = avg(topRatings(squad, ["BAT", "WK", "AR"], 6));
  const bowling = avg(topRatings(squad, ["BOWL", "AR"], 5));

  // A structurally illegal squad cannot field a proper XI.
  let penalty = 0;
  for (const role of Object.keys(MIN_ROLES) as Role[]) {
    const short = MIN_ROLES[role] - squad.filter((p) => p.role === role).length;
    if (short > 0) penalty += short * 6;
  }
  if (squad.length < 11) penalty += (11 - squad.length) * 4;

  return {
    batting: batting - penalty / 2,
    bowling: bowling - penalty / 2,
    overall: (batting + bowling) / 2 - penalty,
  };
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
}

export interface TableRow {
  franchiseId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  runRate: number;
  strength: Strength;
}

/** One match: batting probed against the opponent's bowling, plus variance —
 * the better squad usually wins, but not always, which is the point. */
function playMatch(a: Franchise, b: Franchise, sa: Strength, sb: Strength, rng: Rng): [MatchResult, Rng] {
  let r = rng;
  const roll = (): number => {
    const [f, next] = nextFloat(r);
    r = next;
    return f;
  };
  // Score ≈ how far batting outguns the opposing attack, on a T20-ish scale.
  const score = (bat: number, bowl: number, luck: number): number =>
    Math.round(120 + (bat - bowl) * 2.6 + (luck - 0.5) * 46);

  const homeScore = score(sa.batting, sb.bowling, roll());
  const awayScore = score(sb.batting, sa.bowling, roll());
  const tieBreak = roll() < 0.5;
  const winnerId =
    homeScore === awayScore ? (tieBreak ? a.id : b.id) : homeScore > awayScore ? a.id : b.id;
  return [{ homeId: a.id, awayId: b.id, homeScore, awayScore, winnerId }, r];
}

export interface Tournament {
  matches: MatchResult[];
  table: TableRow[];
  championId: string;
}

/**
 * Single round-robin across all franchises (8 teams → 28 matches), then the
 * table decides the title. Deterministic for a given seed.
 */
export function playTournament(franchises: Franchise[], seed: number): Tournament {
  let rng: Rng = seedRng(seed ^ 0x7011);
  const strengths = new Map(franchises.map((f) => [f.id, squadStrength(f)]));
  const rows = new Map<string, TableRow>(
    franchises.map((f) => [
      f.id,
      { franchiseId: f.id, played: 0, won: 0, lost: 0, points: 0, runRate: 0, strength: strengths.get(f.id)! },
    ]),
  );
  const matches: MatchResult[] = [];

  for (let i = 0; i < franchises.length; i++) {
    for (let j = i + 1; j < franchises.length; j++) {
      const a = franchises[i];
      const b = franchises[j];
      let m: MatchResult;
      [m, rng] = playMatch(a, b, strengths.get(a.id)!, strengths.get(b.id)!, rng);
      matches.push(m);

      const ra = rows.get(a.id)!;
      const rb = rows.get(b.id)!;
      ra.played++;
      rb.played++;
      ra.runRate += m.homeScore - m.awayScore;
      rb.runRate += m.awayScore - m.homeScore;
      if (m.winnerId === a.id) {
        ra.won++; ra.points += 2; rb.lost++;
      } else {
        rb.won++; rb.points += 2; ra.lost++;
      }
    }
  }

  const table = [...rows.values()].sort(
    (x, y) => y.points - x.points || y.runRate - x.runRate || y.strength.overall - x.strength.overall,
  );
  return { matches, table, championId: table[0].franchiseId };
}

/** Every match a given franchise played, in order. */
export function matchesFor(t: Tournament, franchiseId: string): MatchResult[] {
  return t.matches.filter((m) => m.homeId === franchiseId || m.awayId === franchiseId);
}
