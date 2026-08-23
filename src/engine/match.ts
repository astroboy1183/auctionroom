// Ball-by-ball T20 simulation. Pure and seeded like the rest of engine/ —
// no timers, no Math.random. This is what makes the auction consequential:
// the four-over bowling limit forces real squad depth, and phase-sensitive
// tags (opener, death-bowler, finisher) finally change results instead of
// only changing what the bots pay.

import type { Franchise, Player, Role } from "./types";
import { nextFloat, type Rng } from "./rng";

export const OVERS = 20;
export const BALLS_PER_OVER = 6;
export const MAX_OVERS_PER_BOWLER = 4;
export const XI = 11;
export const ALL_OUT = 10;

export type Phase = "powerplay" | "middle" | "death";

export function phaseOf(over: number): Phase {
  if (over < 6) return "powerplay";
  if (over < 16) return "middle";
  return "death";
}

// ------------------------------------------------------------- selection

const BOWLING_ROLES: Role[] = ["BOWL", "AR"];

/** Can this player realistically bowl their four overs? */
function bowls(p: Player): boolean {
  return BOWLING_ROLES.includes(p.role);
}

/**
 * How good this player is *with the ball*. A 12-player squad only has to
 * carry 3 BOWL + 1 AR, but the four-over cap needs five bowlers to cover
 * twenty overs — so somebody's batter ends up bowling. They bowl badly, and
 * that is precisely the price of skimping on bowling at the auction.
 */
export function bowlingRating(p: Player): number {
  if (p.role === "BOWL") return p.rating;
  if (p.role === "AR") return p.rating - 4;
  // A recognised part-timer is merely poor; a pure batter is a gift.
  const partTimer = p.tags.some((t) => ["spin", "pace", "off-spin", "golden-arm"].includes(t));
  return p.rating - (partTimer ? 22 : 34);
}

/**
 * Pick a legal XI: a keeper, five bowling options (the four-over cap means
 * you genuinely need five), then the best remaining bats. A squad that can't
 * field one is padded with whoever is left — and pays for it in the result.
 */
export function selectXI(squad: Player[]): Player[] {
  const byRating = [...squad].sort((a, b) => b.rating - a.rating);
  const picked: Player[] = [];
  const take = (pred: (p: Player) => boolean, n: number): void => {
    for (const p of byRating) {
      if (picked.length >= XI || n <= 0) break;
      if (picked.includes(p) || !pred(p)) continue;
      picked.push(p);
      n--;
    }
  };
  take((p) => p.role === "WK", 1);
  take(bowls, 5);
  take((p) => !bowls(p), XI - picked.length);
  take(() => true, XI - picked.length); // pad if the squad is thin
  return picked;
}

/** Openers and top order first; finishers held back for the death. */
export function battingOrder(xi: Player[]): Player[] {
  const score = (p: Player): number => {
    let s = p.rating;
    if (p.tags.includes("opener")) s += 30;
    if (p.role === "BAT") s += 12;
    if (p.role === "WK") s += 8;
    if (p.tags.includes("finisher")) s -= 18; // deliberately later
    if (p.role === "BOWL") s -= 45;
    return s;
  };
  return [...xi].sort((a, b) => score(b) - score(a));
}

/** Five bowlers, best first; each capped at four overs by the scheduler. */
export function bowlingAttack(xi: Player[]): Player[] {
  const specialists = xi.filter(bowls).sort((a, b) => bowlingRating(b) - bowlingRating(a));
  if (specialists.length >= 5) return specialists.slice(0, 6);
  // Short of five: the least-bad part-timers are dragged in to fill the overs.
  const fillers = xi
    .filter((p) => !bowls(p))
    .sort((a, b) => bowlingRating(b) - bowlingRating(a))
    .slice(0, 5 - specialists.length);
  return [...specialists, ...fillers];
}

// ------------------------------------------------------------- one ball

export type Outcome = 0 | 1 | 2 | 3 | 4 | 6 | "W";

interface BallContext {
  batter: Player;
  bowler: Player;
  phase: Phase;
  /** 0 = no pressure, 1 = must swing at everything (chasing). */
  aggression: number;
}

/**
 * Outcome weights for one delivery. Edge = how far the batter outclasses the
 * bowler; it shifts probability from dots toward boundaries, and aggression
 * buys boundaries at the price of wickets.
 */
function weights({ batter, bowler, phase, aggression }: BallContext): Record<string, number> {
  const edge = (batter.rating - bowlingRating(bowler)) / 100;

  let attack = aggression;
  if (phase === "powerplay") attack += batter.tags.includes("opener") ? 0.3 : 0.15;
  if (phase === "death") attack += batter.tags.includes("finisher") ? 0.45 : 0.3;
  if (batter.tags.includes("power-hitter") || batter.tags.includes("six-hitter")) attack += 0.18;

  // Specialist bowlers pull it back where they are supposed to be good.
  let control = 0;
  if (phase === "death" && (bowler.tags.includes("death-bowler") || bowler.tags.includes("yorker"))) control += 0.28;
  if (phase === "powerplay" && (bowler.tags.includes("new-ball") || bowler.tags.includes("swing"))) control += 0.22;
  if (phase === "middle" && (bowler.tags.includes("spin") || bowler.tags.includes("wrist-spin"))) control += 0.18;
  if (bowler.tags.includes("wicket-taker")) control += 0.08;

  const boundary = Math.max(0.02, 0.14 + edge * 0.5 + attack * 0.14 - control * 0.12);
  const six = boundary * (0.34 + attack * 0.2);
  const four = boundary - six;
  const wicket = Math.max(0.012, 0.045 - edge * 0.05 + attack * 0.055 + control * 0.045);
  const dot = Math.max(0.06, 0.34 - edge * 0.22 - attack * 0.1 + control * 0.16);
  const two = 0.08 + edge * 0.02;
  const three = 0.012;
  const one = Math.max(0.05, 1 - (six + four + wicket + dot + two + three));

  return { 0: dot, 1: one, 2: two, 3: three, 4: four, 6: six, W: wicket };
}

function pickOutcome(w: Record<string, number>, roll: number): Outcome {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const [key, weight] of Object.entries(w)) {
    acc += weight / total;
    if (roll <= acc) return (key === "W" ? "W" : Number(key)) as Outcome;
  }
  return 0;
}

// ------------------------------------------------------------- an innings

export interface BattingCard {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

export interface BowlingCard {
  playerId: string;
  name: string;
  balls: number;
  runs: number;
  wickets: number;
}

/** One delivery, kept so a match can be watched back rather than only read. */
export interface BallEvent {
  over: number;      // 0-indexed
  ball: number;      // 1-6 within the over
  strikerId: string;
  strikerName: string;
  bowlerName: string;
  outcome: Outcome;
  runsAfter: number;
  wicketsAfter: number;
}

export interface Innings {
  franchiseId: string;
  runs: number;
  wickets: number;
  balls: number;
  batting: BattingCard[];
  bowling: BowlingCard[];
  /** Every delivery in order — the source for match playback. */
  timeline: BallEvent[];
  /** Set when a chase succeeds. */
  chasedDown: boolean;
}

/** Who bowls each over, respecting the four-over cap. */
function overSchedule(attack: Player[]): Player[] {
  const used = new Map<string, number>();
  const plan: Player[] = [];
  let last = "";
  for (let over = 0; over < OVERS; over++) {
    const phase = phaseOf(over);
    const eligible = attack
      .filter((p) => (used.get(p.id) ?? 0) < MAX_OVERS_PER_BOWLER && p.id !== last)
      .sort((a, b) => {
        // Save your best death bowlers for the death.
        const bonus = (p: Player) =>
          (phase === "death" && (p.tags.includes("death-bowler") || p.tags.includes("yorker")) ? 25 : 0) +
          (phase === "powerplay" && p.tags.includes("new-ball") ? 20 : 0);
        return bowlingRating(b) + bonus(b) - (bowlingRating(a) + bonus(a));
      });
    // If everyone is capped, the cap wins: reuse is impossible, so the worst
    // available bowls — which is exactly the cost of a thin attack.
    const bowler = eligible[0] ?? attack.find((p) => p.id !== last) ?? attack[0];
    plan.push(bowler);
    used.set(bowler.id, (used.get(bowler.id) ?? 0) + 1);
    last = bowler.id;
  }
  return plan;
}

/** Play one innings. `target` set means this is a chase. */
export function playInnings(
  batting: Franchise,
  bowling: Franchise,
  rng: Rng,
  target?: number,
): [Innings, Rng] {
  let r = rng;
  const roll = (): number => {
    const [f, next] = nextFloat(r);
    r = next;
    return f;
  };

  const order = battingOrder(selectXI(batting.squad));
  const attack = bowlingAttack(selectXI(bowling.squad));
  const plan = overSchedule(attack);

  const bat = new Map<string, BattingCard>(
    order.map((p) => [p.id, { playerId: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false }]),
  );
  const bowl = new Map<string, BowlingCard>(
    attack.map((p) => [p.id, { playerId: p.id, name: p.name, balls: 0, runs: 0, wickets: 0 }]),
  );

  let runs = 0;
  let wickets = 0;
  let balls = 0;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatter = 2;
  let chasedDown = false;
  const timeline: BallEvent[] = [];

  for (let over = 0; over < OVERS && wickets < ALL_OUT; over++) {
    const bowler = plan[over];
    for (let b = 0; b < BALLS_PER_OVER; b++) {
      if (wickets >= ALL_OUT) break;
      if (target !== undefined && runs >= target) { chasedDown = true; break; }

      const striker = order[strikerIdx];
      if (!striker) break;

      // Chasing: aggression rises with the required rate.
      let aggression = 0;
      if (target !== undefined) {
        const ballsLeft = OVERS * BALLS_PER_OVER - balls;
        const need = target - runs;
        const required = ballsLeft > 0 ? (need / ballsLeft) * 6 : 99;
        aggression = Math.max(0, Math.min(1, (required - 7.5) / 9));
      }

      const outcome = pickOutcome(
        weights({ batter: striker, bowler, phase: phaseOf(over), aggression }),
        roll(),
      );
      balls++;
      const bc = bat.get(striker.id)!;
      const bw = bowl.get(bowler.id)!;
      bc.balls++;
      bw.balls++;

      if (outcome === "W") {
        wickets++;
        bc.out = true;
        bw.wickets++;
        if (nextBatter < order.length) {
          strikerIdx = nextBatter++;
        } else {
          wickets = ALL_OUT; // nobody left to come in
        }
      } else {
        runs += outcome;
        bc.runs += outcome;
        bw.runs += outcome;
        if (outcome === 4) bc.fours++;
        if (outcome === 6) bc.sixes++;
        if (outcome % 2 === 1) [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }

      timeline.push({
        over,
        ball: b + 1,
        strikerId: striker.id,
        strikerName: striker.name,
        bowlerName: bowler.name,
        outcome,
        runsAfter: runs,
        wicketsAfter: Math.min(wickets, ALL_OUT),
      });
    }
    if (target !== undefined && runs >= target) { chasedDown = true; break; }
    [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx]; // ends change
  }

  return [
    {
      franchiseId: batting.id,
      runs,
      wickets: Math.min(wickets, ALL_OUT),
      balls,
      batting: [...bat.values()].filter((c) => c.balls > 0),
      bowling: [...bowl.values()].filter((c) => c.balls > 0),
      timeline,
      chasedDown,
    },
    r,
  ];
}

// --------------------------------------------------------------- a match

export interface Match {
  homeId: string;
  awayId: string;
  first: Innings;
  second: Innings;
  winnerId: string;
  margin: string;
}

/** Full T20: home bats first, away chases. */
export function playMatch(home: Franchise, away: Franchise, rng: Rng): [Match, Rng] {
  let r = rng;
  let first: Innings;
  let second: Innings;
  [first, r] = playInnings(home, away, r);
  [second, r] = playInnings(away, home, r, first.runs + 1);

  let winnerId: string;
  let margin: string;
  if (second.runs > first.runs) {
    winnerId = away.id;
    margin = `${ALL_OUT - second.wickets} wickets`;
  } else if (first.runs > second.runs) {
    winnerId = home.id;
    margin = `${first.runs - second.runs} runs`;
  } else {
    // Tie — decided on wickets lost, then on the toss of the last roll.
    const [f, next] = nextFloat(r);
    r = next;
    winnerId =
      second.wickets < first.wickets ? away.id : first.wickets < second.wickets ? home.id : f < 0.5 ? home.id : away.id;
    margin = "super over";
  }
  return [{ homeId: home.id, awayId: away.id, first, second, winnerId, margin }, r];
}

/** "184/6 (20.0)" */
export function scoreline(i: Innings): string {
  const overs = `${Math.floor(i.balls / 6)}.${i.balls % 6}`;
  return `${i.runs}/${i.wickets} (${overs})`;
}

/** Strike rate and economy, formatted for a scorecard. */
export function strikeRate(c: BattingCard): string {
  return c.balls === 0 ? "—" : ((c.runs / c.balls) * 100).toFixed(1);
}

export function economy(c: BowlingCard): string {
  return c.balls === 0 ? "—" : ((c.runs / c.balls) * 6).toFixed(2);
}

export function oversOf(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/** The closing overs, where chases are won and lost. */
export function finalOvers(inn: Innings, count = 2): BallEvent[] {
  if (inn.timeline.length === 0) return [];
  const lastOver = inn.timeline[inn.timeline.length - 1].over;
  return inn.timeline.filter((b) => b.over > lastOver - count);
}

/** Best individual performance in a match, for a "player of the match" line. */
export function playerOfTheMatch(m: Match): { name: string; line: string } | null {
  const cards: { name: string; line: string; score: number }[] = [];
  for (const inn of [m.first, m.second]) {
    for (const b of inn.batting) {
      if (b.runs >= 25) {
        cards.push({
          name: b.name,
          line: `${b.runs} (${b.balls})`,
          score: b.runs + b.sixes * 2 + b.fours,
        });
      }
    }
    for (const b of inn.bowling) {
      if (b.wickets >= 2) {
        cards.push({
          name: b.name,
          line: `${b.wickets}/${b.runs}`,
          score: b.wickets * 22 - b.runs / 2,
        });
      }
    }
  }
  if (cards.length === 0) return null;
  cards.sort((a, b) => b.score - a.score);
  return { name: cards[0].name, line: cards[0].line };
}
