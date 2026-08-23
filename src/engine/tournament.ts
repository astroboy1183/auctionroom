// Post-auction tournament — the payoff. The squad you assembled plays the
// other seven, so the auction is judged by results rather than by a points
// formula. Pure and seeded like everything else in engine/.

import type { Franchise, Player, Role } from "./types";
import { seedRng, type Rng } from "./rng";
import { MIN_ROLES } from "./rules";
import { bowlingRating, playMatch as playBallByBall, scoreline, type Match } from "./match";

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
 * Squad → match strength. This is a *predictor* of the ball-by-ball result,
 * not the thing that decides it, so it has to model the same pressures:
 * batting from the top six, and bowling from the five who will actually have
 * to bowl — including any part-timer dragged in to cover the four-over cap.
 */
export function squadStrength(franchise: Franchise): Strength {
  const squad = franchise.squad;
  const batting = avg(topRatings(squad, ["BAT", "WK", "AR"], 6));

  // Exactly five bowlers get used; a thin attack has to include a batter,
  // and bowlingRating() makes that cost visible here as it does in a match.
  const attack = [...squad]
    .sort((a, b) => bowlingRating(b) - bowlingRating(a))
    .slice(0, 5)
    .map(bowlingRating);
  while (attack.length < 5) attack.push(REPLACEMENT - 20);
  const bowling = avg(attack);

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
  /** The full ball-by-ball match behind this result. */
  detail: Match;
  homeLine: string;
  awayLine: string;
  margin: string;
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

/** One match, played ball by ball. The result carries the full scorecard. */
function playMatch(a: Franchise, b: Franchise, rng: Rng): [MatchResult, Rng] {
  const [m, next] = playBallByBall(a, b, rng);
  return [
    {
      homeId: a.id,
      awayId: b.id,
      homeScore: m.first.runs,
      awayScore: m.second.runs,
      winnerId: m.winnerId,
      detail: m,
      homeLine: scoreline(m.first),
      awayLine: scoreline(m.second),
      margin: m.margin,
    },
    next,
  ];
}

/** The knockout stage, IPL-style: the top two get a second chance. */
export interface Playoffs {
  qualifier1: MatchResult;  // 1st v 2nd — winner goes straight to the final
  eliminator: MatchResult;  // 3rd v 4th — loser is out
  qualifier2: MatchResult;  // loser of Q1 v winner of Eliminator
  final: MatchResult;
  finalistIds: [string, string];
}

export interface Tournament {
  matches: MatchResult[];
  table: TableRow[];
  playoffs: Playoffs | null;
  /** Winner of the final — or the table-topper if there aren't four teams. */
  championId: string;
  /** Table-topper, which is no longer necessarily the champion. */
  leagueLeaderId: string;
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
      [m, rng] = playMatch(a, b, rng);
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

  // Knockouts. Finishing top two is worth something concrete: lose Q1 and you
  // still get a second route into the final.
  const byId = (id: string) => franchises.find((f) => f.id === id)!;
  let playoffs: Playoffs | null = null;
  let championId = table[0].franchiseId;

  if (table.length >= 4) {
    const [first, second, third, fourth] = table.map((r) => byId(r.franchiseId));

    let qualifier1: MatchResult;
    [qualifier1, rng] = playMatch(first, second, rng);
    let eliminator: MatchResult;
    [eliminator, rng] = playMatch(third, fourth, rng);

    const q1Loser = byId(qualifier1.winnerId === first.id ? second.id : first.id);
    const elimWinner = byId(eliminator.winnerId);
    let qualifier2: MatchResult;
    [qualifier2, rng] = playMatch(q1Loser, elimWinner, rng);

    const finalists: [string, string] = [qualifier1.winnerId, qualifier2.winnerId];
    let final: MatchResult;
    [final, rng] = playMatch(byId(finalists[0]), byId(finalists[1]), rng);

    playoffs = { qualifier1, eliminator, qualifier2, final, finalistIds: finalists };
    championId = final.winnerId;
  }

  return { matches, table, playoffs, championId, leagueLeaderId: table[0].franchiseId };
}

/** Every match a given franchise played, in order. */
export function matchesFor(t: Tournament, franchiseId: string): MatchResult[] {
  return t.matches.filter((m) => m.homeId === franchiseId || m.awayId === franchiseId);
}
