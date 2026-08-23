// Career mode — seasons that remember. Your squad carries over, you choose
// who to retain, players accrue real statistics *in your league*, and their
// ratings drift on form. By season three you are bidding on history you made.
//
// Pure and seeded like everything else in engine/.

import type { Franchise, Player } from "./types";
import type { Tournament } from "./tournament";
import { RETENTION_COSTS } from "./retentions";
import { START_BUDGET } from "./franchises";
import { SQUAD_MAX } from "./rules";

/** Career statistics a player has accumulated across every season played. */
export interface PlayerRecord {
  playerId: string;
  matches: number;
  runs: number;
  ballsFaced: number;
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
  /** Rating drift earned by performance; added to the base rating. */
  formDelta: number;
}

export interface SeasonResult {
  season: number;
  championId: string;
  leagueLeaderId: string;
  humanPosition: number;
  humanWon: number;
  humanLost: number;
}

export interface Career {
  season: number;                       // 1-indexed; the season about to be played
  humanId: string;
  history: SeasonResult[];
  records: Record<string, PlayerRecord>;
  /** Squads carried into the coming season, after retention choices. */
  carried: Record<string, string[]>;    // franchiseId → retained player ids
  titles: Record<string, number>;       // franchiseId → titles won
}

export const MAX_CAREER_RETENTIONS = 3;

export function newCareer(humanId: string): Career {
  return { season: 1, humanId, history: [], records: {}, carried: {}, titles: {} };
}

function blankRecord(playerId: string): PlayerRecord {
  return {
    playerId, matches: 0, runs: 0, ballsFaced: 0,
    wickets: 0, runsConceded: 0, ballsBowled: 0, formDelta: 0,
  };
}

/**
 * Fold a completed season's scorecards into career records, then let form
 * drift each player's rating. Drift is deliberately gentle and bounded: a
 * good season nudges you, it does not rewrite you.
 */
export function recordSeason(career: Career, tournament: Tournament): Career {
  const records: Record<string, PlayerRecord> = { ...career.records };
  const all = [...tournament.matches, ...(tournament.playoffs
    ? [tournament.playoffs.qualifier1, tournament.playoffs.eliminator,
       tournament.playoffs.qualifier2, tournament.playoffs.final]
    : [])];

  for (const m of all) {
    for (const inn of [m.detail.first, m.detail.second]) {
      for (const b of inn.batting) {
        const r = (records[b.playerId] ??= blankRecord(b.playerId));
        r.matches++;
        r.runs += b.runs;
        r.ballsFaced += b.balls;
      }
      for (const b of inn.bowling) {
        const r = (records[b.playerId] ??= blankRecord(b.playerId));
        r.wickets += b.wickets;
        r.runsConceded += b.runs;
        r.ballsBowled += b.balls;
      }
    }
  }

  // Form: strike rate for batters, economy for bowlers, versus a neutral bar.
  for (const r of Object.values(records)) {
    let delta = 0;
    if (r.ballsFaced >= 60) {
      const sr = (r.runs / r.ballsFaced) * 100;
      delta += Math.max(-3, Math.min(3, (sr - 132) / 12));
    }
    if (r.ballsBowled >= 60) {
      const econ = (r.runsConceded / r.ballsBowled) * 6;
      delta += Math.max(-3, Math.min(3, (8.6 - econ) / 1.1));
    }
    // Drift accumulates but is capped, so nobody becomes a 130-rated freak.
    r.formDelta = Math.max(-8, Math.min(8, r.formDelta * 0.6 + delta));
  }

  return { ...career, records };
}

/** A player's effective rating this season, base plus accumulated form. */
export function effectiveRating(player: Player, career: Career): number {
  const delta = career.records[player.id]?.formDelta ?? 0;
  return Math.max(50, Math.min(100, Math.round(player.rating + delta)));
}

/** Apply career form to a whole pool, so the auction bids on real history. */
export function applyForm(players: Player[], career: Career): Player[] {
  return players.map((p) => {
    const rating = effectiveRating(p, career);
    return rating === p.rating ? p : { ...p, rating };
  });
}

export function closeSeason(
  career: Career,
  tournament: Tournament,
  franchises: Franchise[],
): Career {
  const withRecords = recordSeason(career, tournament);
  const row = tournament.table.findIndex((r) => r.franchiseId === career.humanId);
  const humanRow = tournament.table[row];

  return {
    ...withRecords,
    history: [
      ...withRecords.history,
      {
        season: career.season,
        championId: tournament.championId,
        leagueLeaderId: tournament.leagueLeaderId,
        humanPosition: row + 1,
        humanWon: humanRow?.won ?? 0,
        humanLost: humanRow?.lost ?? 0,
      },
    ],
    titles: {
      ...withRecords.titles,
      [tournament.championId]: (withRecords.titles[tournament.championId] ?? 0) + 1,
    },
    // Squads are cleared here; retention choices repopulate `carried`.
    carried: Object.fromEntries(franchises.map((f) => [f.id, []])),
  };
}

/** Cost of keeping N players into the next season. */
export function retentionCost(count: number): number {
  return RETENTION_COSTS.slice(0, count).reduce((a, b) => a + b, 0)
    + Math.max(0, count - RETENTION_COSTS.length) * 800;
}

/** Purse a franchise starts the next season with, given its retentions. */
export function purseAfterRetentions(count: number): number {
  return START_BUDGET - retentionCost(count);
}

/** Bots keep their best players, up to the cap and what they can afford. */
export function autoRetain(franchise: Franchise, career: Career): string[] {
  return [...franchise.squad]
    .sort((a, b) => effectiveRating(b, career) - effectiveRating(a, career))
    .slice(0, MAX_CAREER_RETENTIONS)
    .map((p) => p.id);
}

/** A player's career line, e.g. "412 runs @ 138.2 · 18 wkts @ 7.9". */
export function careerLine(record: PlayerRecord | undefined): string {
  if (!record || record.matches === 0) return "no matches yet";
  const parts: string[] = [];
  if (record.ballsFaced > 0) {
    parts.push(`${record.runs} runs @ ${((record.runs / record.ballsFaced) * 100).toFixed(1)}`);
  }
  if (record.ballsBowled > 0) {
    parts.push(`${record.wickets} wkts @ ${((record.runsConceded / record.ballsBowled) * 6).toFixed(1)}`);
  }
  return parts.join(" · ") || `${record.matches} matches`;
}

/** Squad slots still to fill at auction after retentions. */
export function slotsToFill(retainedCount: number): number {
  return SQUAD_MAX - retainedCount;
}
