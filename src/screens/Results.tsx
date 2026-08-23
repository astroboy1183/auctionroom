// Final scores side by side, winner declared, share text — CLAUDE.md §9.

import { useEffect, useMemo, useState } from "react";
import { fanfare } from "../lib/audio";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "../store/gameStore";
import { finalScores } from "../engine/scoring";
import { playTournament, matchesFor } from "../engine/tournament";
import { analyse } from "../engine/analytics";
import { playerOfTheMatch } from "../engine/match";
import Scorecard from "../components/Scorecard";
import SeasonEnd from "./SeasonEnd";
import type { MatchResult } from "../engine/tournament";
import { START_BUDGET } from "../engine/franchises";
import { unfilledNeeds, overseasCount, SQUAD_MAX, OVERSEAS_MAX } from "../engine/rules";
import { money } from "../components/format";
import HallBackdrop from "../components/HallBackdrop";
import type { Role } from "../engine/types";

const ROLE_ORDER: Role[] = ["BAT", "BOWL", "AR", "WK"];

export default function Results() {
  const auction = useGameStore((s) => s.auction);
  const humanId = useGameStore((s) => s.humanId);
  const reset = useGameStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const scores = useMemo(() => finalScores(auction.franchises, START_BUDGET), [auction]);
  // The squad you built now has to actually win matches.
  const tournament = useMemo(
    () => playTournament(auction.franchises, auction.rngSeed),
    [auction.franchises, auction.rngSeed],
  );
  const [tab, setTab] = useState<"table" | "squads" | "auction">("table");
  const stats = useMemo(() => analyse(auction, START_BUDGET), [auction]);
  const startGame = useGameStore((s) => s.startGame);
  const [seedCopied, setSeedCopied] = useState(false);
  const [openMatch, setOpenMatch] = useState<MatchResult | null>(null);
  const career = useGameStore((s) => s.career);
  const [seasonEnd, setSeasonEnd] = useState(false);
  const soundOn = useGameStore((s) => s.soundOn);
  useEffect(() => {
    if (soundOn) fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const winner = auction.franchises.find((f) => f.id === tournament.championId)!;
  const leader = auction.franchises.find((f) => f.id === tournament.leagueLeaderId)!;
  const po = tournament.playoffs;
  const humanRank = tournament.table.findIndex((r) => r.franchiseId === humanId) + 1;
  const humanRow = tournament.table.find((r) => r.franchiseId === humanId);
  const byId = (id: string) => auction.franchises.find((f) => f.id === id)!;

  const share = () => {
    const lines = [
      `🏏 AuctionRoom — ${winner.name} win the title!`,
      ...tournament.table.map((r, i) => {
        const f = byId(r.franchiseId);
        return `${i + 1}. ${f.name}${f.id === humanId ? " (me)" : ""} — ${r.won}W ${r.lost}L, ${r.points} pts`;
      }),
      `I finished #${humanRank} of ${tournament.table.length}. Play at ${location.origin}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative min-h-screen px-4 py-10 text-slate-100">
      <HallBackdrop mode="podium" />
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl rounded-2xl bg-slate-950/70 p-6 text-center backdrop-blur-md"
        >
          <p className="text-6xl">🏆</p>
          <h1 className="mt-2 text-4xl font-black">
            <span style={{ color: winner.color }}>{winner.name}</span> win the title!
          </h1>
          <p className="mt-2 text-slate-400">
            {winner.id === humanId
              ? "Your squad went all the way. Take a bow, chairman."
              : `You finished #${humanRank} of ${tournament.table.length}${humanRow ? ` — ${humanRow.won} wins, ${humanRow.lost} losses` : ""}.`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tournament.matches.length} league matches, then the playoffs
            {leader.id !== winner.id && (
              <> · <span style={{ color: leader.color }}>{leader.name}</span> topped the table</>
            )}
          </p>
          {career && (
            <p className="mt-2 text-xs font-black uppercase tracking-widest text-amber-400">
              Season {career.season}
              {career.titles[humanId] ? ` · ${career.titles[humanId]} title${career.titles[humanId] > 1 ? "s" : ""}` : ""}
            </p>
          )}
          <div className="mt-4 flex justify-center gap-3">
            {career && (
              <button
                onClick={() => setSeasonEnd(true)}
                className="rounded-lg bg-emerald-500 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-400"
              >
                Continue to season {career.season + 1} →
              </button>
            )}
            <button onClick={share}
              className="rounded-lg bg-amber-500 px-5 py-2 font-bold text-slate-950 hover:bg-amber-400">
              {copied ? "Copied ✓" : "Share result"}
            </button>
            <button onClick={reset}
              className="rounded-lg border border-slate-700 px-5 py-2 font-bold hover:bg-slate-900">
              Play again
            </button>
          </div>
        </motion.div>

        <div className="mx-auto mt-8 flex w-fit gap-1 rounded-lg bg-slate-950/70 p-1 backdrop-blur-md">
          {(["table", "auction", "squads"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded px-4 py-1.5 text-sm font-bold ${tab === k ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:bg-slate-800/70"}`}
            >
              {k === "table" ? "Points table" : k === "auction" ? "Auction report" : "Squads"}
            </button>
          ))}
        </div>

        {tab === "table" && (
          <div className="mx-auto mt-6 max-w-3xl overflow-x-auto rounded-2xl bg-slate-950/75 p-4 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2">#</th>
                  <th>Franchise</th>
                  <th className="text-center">P</th>
                  <th className="text-center">W</th>
                  <th className="text-center">L</th>
                  <th className="text-center">Pts</th>
                  <th className="text-right">Net runs</th>
                  <th className="text-right">Squad</th>
                </tr>
              </thead>
              <tbody>
                {tournament.table.map((r, i) => {
                  const f = byId(r.franchiseId);
                  const me = f.id === humanId;
                  return (
                    <motion.tr
                      key={r.franchiseId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`border-b border-slate-900 ${me ? "bg-amber-500/10" : ""}`}
                    >
                      <td className="py-2 font-black text-slate-500">{i + 1}</td>
                      <td className="font-bold">
                        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: f.color }} />
                        {f.name}
                        {i === 0 && " 🏆"}
                        {me && <span className="ml-1.5 rounded bg-slate-700 px-1 text-[9px] font-black text-amber-300">YOU</span>}
                      </td>
                      <td className="text-center text-slate-400">{r.played}</td>
                      <td className="text-center font-bold text-emerald-400">{r.won}</td>
                      <td className="text-center text-slate-400">{r.lost}</td>
                      <td className="text-center font-mono font-black">{r.points}</td>
                      <td className={`text-right font-mono text-xs ${r.runRate >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {r.runRate > 0 ? "+" : ""}{r.runRate}
                      </td>
                      <td className="text-right font-mono text-xs text-slate-400">
                        {Math.round(r.strength.overall)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>

            {po && (
              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Playoffs — click any match for the full scorecard
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["Qualifier 1", po.qualifier1, "winner to the final"],
                    ["Eliminator", po.eliminator, "loser goes home"],
                    ["Qualifier 2", po.qualifier2, "last route in"],
                    ["Final", po.final, "for the title"],
                  ] as const).map(([label, m, note]) => {
                    const w = byId(m.winnerId);
                    const isFinal = label === "Final";
                    return (
                      <button
                        key={label}
                        onClick={() => setOpenMatch(m)}
                        className={`rounded-lg p-2.5 text-left transition hover:brightness-125 ${isFinal ? "bg-amber-500/10 ring-1 ring-amber-500/40" : "bg-slate-900/70"}`}
                      >
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          {label} · {note}
                        </p>
                        <p className="mt-0.5 text-sm">
                          <span className="text-slate-400">{byId(m.homeId).name.split(" ")[1]}</span>
                          <span className="mx-1 font-mono text-slate-500">{m.homeLine}</span>
                          <span className="text-slate-600">v</span>
                          <span className="mx-1 font-mono text-slate-500">{m.awayLine}</span>
                          <span className="text-slate-400">{byId(m.awayId).name.split(" ")[1]}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-bold" style={{ color: w.color }}>
                          {isFinal && "🏆 "}{w.name} won by {m.margin}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {humanRow && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Your league matches — click for the scorecard
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchesFor(tournament, humanId).map((m, i) => {
                    const oppId = m.homeId === humanId ? m.awayId : m.homeId;
                    const mine = m.homeId === humanId ? m.homeScore : m.awayScore;
                    const theirs = m.homeId === humanId ? m.awayScore : m.homeScore;
                    const won = m.winnerId === humanId;
                    return (
                      <button
                        key={i}
                        onClick={() => setOpenMatch(m)}
                        className={`rounded px-2 py-1 text-[11px] font-semibold transition hover:brightness-125 ${won ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                        title={`${m.homeLine} v ${m.awayLine} — won by ${m.margin}${
                          playerOfTheMatch(m.detail) ? ` · ${playerOfTheMatch(m.detail)!.name} ${playerOfTheMatch(m.detail)!.line}` : ""
                        }`}
                      >
                        {won ? "W" : "L"} {mine}–{theirs} v {byId(oppId).name.split(" ")[1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "auction" && (
          <div className="mx-auto mt-6 max-w-3xl space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Steal of the auction", h: stats.steal, tone: "text-emerald-400" },
                { label: "Worst overpay", h: stats.overpay, tone: "text-red-400" },
                { label: "Biggest sale", h: stats.biggestSale, tone: "text-amber-400" },
              ].map(({ label, h, tone }) =>
                h ? (
                  <div key={label} className="rounded-xl bg-slate-950/75 p-4 backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-black">{h.player.name}</p>
                    <p className="text-xs" style={{ color: h.franchise.color }}>{h.franchise.name}</p>
                    <p className={`mt-1 font-mono text-xl font-black ${tone}`}>{money(h.price)}</p>
                    <p className="text-[10px] text-slate-500">
                      {h.ratio < 1 ? `${Math.round((1 - h.ratio) * 100)}% under` : `${Math.round((h.ratio - 1) * 100)}% over`} market
                    </p>
                  </div>
                ) : null,
              )}
              {stats.mostContested && (
                <div className="rounded-xl bg-slate-950/75 p-4 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Most contested lot</p>
                  <p className="mt-1 text-lg font-black">{stats.mostContested.player.name}</p>
                  <p className="text-xs text-slate-400">{stats.mostContested.bids} bids</p>
                  <p className="mt-1 font-mono text-xl font-black text-violet-400">{money(stats.mostContested.price)}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-950/75 p-4 text-sm backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">The room</p>
              <p className="mt-1 text-slate-300">
                {stats.soldCount} sold · {stats.unsoldCount} went unsold · {money(stats.totalSpend)} changed hands
                {stats.fastestSpender && (
                  <> · biggest spender <span style={{ color: stats.fastestSpender.franchise.color }}>
                    {stats.fastestSpender.franchise.name}</span> ({money(stats.fastestSpender.spent)})</>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seed</span>
                <code className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-amber-300">{auction.rngSeed}</code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(String(auction.rngSeed));
                    setSeedCopied(true);
                    setTimeout(() => setSeedCopied(false), 1800);
                  }}
                  className="rounded bg-slate-800 px-2 py-1 text-xs font-bold hover:bg-slate-700"
                >
                  {seedCopied ? "Copied ✓" : "Copy"}
                </button>
                <button
                  onClick={() => startGame(humanId, "normal", auction.rngSeed)}
                  className="rounded bg-slate-800 px-2 py-1 text-xs font-bold hover:bg-slate-700"
                >
                  Replay this auction
                </button>
                <span className="text-[10px] text-slate-500">same pool, same bots, same everything</span>
              </div>
            </div>
          </div>
        )}

        <div className={`mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${tab === "squads" ? "" : "hidden"}`}>
          {scores.map((s, rank) => {
            const f = auction.franchises.find((x) => x.id === s.franchiseId)!;
            const needs = unfilledNeeds(f.squad);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rank * 0.1 }}
                className={`rounded-2xl border bg-slate-950/75 p-4 backdrop-blur-md ${rank === 0 ? "border-amber-500/50" : "border-slate-800"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-slate-500">#{rank + 1}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: f.color }} />
                  <span className="truncate font-black">{f.name}</span>
                  {f.id === humanId && <span className="rounded bg-slate-700 px-1 text-[10px] font-black text-amber-300">YOU</span>}
                </div>
                <p className="mt-1 font-mono text-3xl font-black" style={{ color: rank === 0 ? "#f59e0b" : undefined }}>
                  {s.total}<span className="text-sm text-slate-500"> pts</span>
                </p>
                <p className="text-xs text-slate-400">
                  Σ ratings {s.base}
                  {s.penalty > 0 && <span className="text-red-400"> − {s.penalty} missing roles</span>}
                  {s.bonus > 0 && <span className="text-emerald-400"> + {s.bonus} balance</span>}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {f.squad.length}/{SQUAD_MAX} · ✈ {overseasCount(f.squad)}/{OVERSEAS_MAX} · spent {money(s.spent)} · left {money(f.budget)}
                </p>
                {Object.keys(needs).length > 0 && (
                  <p className="mt-1 text-xs font-bold text-red-400">
                    short: {Object.entries(needs).map(([r, n]) => `${n} ${r}`).join(", ")}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  {ROLE_ORDER.map((role) => {
                    const inRole = f.squad.filter((p) => p.role === role);
                    if (inRole.length === 0) return null;
                    return (
                      <div key={role}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{role}</p>
                        <ul className="text-xs leading-5">
                          {inRole.map((p) => (
                            <li key={p.id} className="flex justify-between gap-2">
                              <span className="truncate">
                                {p.name}{p.overseas ? " ✈" : ""}
                                {f.retained.includes(p.id) && (
                                  <span className="ml-1 text-[9px] font-bold text-violet-400">RET</span>
                                )}
                              </span>
                              <span className="font-mono text-slate-500">{p.rating}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {seasonEnd && career && <SeasonEnd onClose={() => setSeasonEnd(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {openMatch && (
          <Scorecard
            match={openMatch}
            franchises={auction.franchises}
            onClose={() => setOpenMatch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
