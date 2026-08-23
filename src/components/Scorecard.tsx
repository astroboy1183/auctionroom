// The full scorecard — the match engine has always produced this data and the
// UI used to throw it away. Batting and bowling figures for both innings,
// plus a playable final-overs view for close finishes.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MatchResult } from "../engine/tournament";
import type { BallEvent, Innings } from "../engine/match";
import { economy, finalOvers, oversOf, playerOfTheMatch, scoreline, strikeRate } from "../engine/match";
import type { Franchise } from "../engine/types";

interface Props {
  match: MatchResult;
  franchises: Franchise[];
  onClose: () => void;
  onWatch: () => void;
}

const PLAYBACK_MS = 420;

function outcomeLabel(o: BallEvent["outcome"]): string {
  return o === "W" ? "W" : String(o);
}

function outcomeStyle(o: BallEvent["outcome"]): string {
  if (o === "W") return "bg-red-500 text-white";
  if (o === 6) return "bg-violet-500 text-white";
  if (o === 4) return "bg-emerald-500 text-white";
  if (o === 0) return "bg-slate-800 text-slate-500";
  return "bg-slate-700 text-slate-200";
}

function InningsCard({ inn, name, color }: { inn: Innings; name: string; color: string }) {
  return (
    <div className="rounded-xl bg-slate-950/70 p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="font-black" style={{ color }}>{name}</h4>
        <span className="font-mono text-lg font-black">{scoreline(inn)}</span>
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-left text-[9px] uppercase tracking-wider text-slate-500">
            <th className="py-1">Batting</th>
            <th className="text-right">R</th>
            <th className="text-right">B</th>
            <th className="text-right">4s</th>
            <th className="text-right">6s</th>
            <th className="text-right">SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batting.map((c) => (
            <tr key={c.playerId} className="border-b border-slate-900/70">
              <td className="py-1 pr-2">
                <span className="truncate">{c.name}</span>
                {!c.out && <span className="ml-1 text-emerald-400">*</span>}
                {c.how && <span className="block text-[10px] italic text-slate-500">{c.how}</span>}
              </td>
              <td className="text-right font-mono font-bold">{c.runs}</td>
              <td className="text-right font-mono text-slate-400">{c.balls}</td>
              <td className="text-right font-mono text-slate-400">{c.fours}</td>
              <td className="text-right font-mono text-slate-400">{c.sixes}</td>
              <td className="text-right font-mono text-slate-400">{strikeRate(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-left text-[9px] uppercase tracking-wider text-slate-500">
            <th className="py-1">Bowling</th>
            <th className="text-right">O</th>
            <th className="text-right">R</th>
            <th className="text-right">W</th>
            <th className="text-right">Econ</th>
          </tr>
        </thead>
        <tbody>
          {inn.bowling.map((c) => (
            <tr key={c.playerId} className="border-b border-slate-900/70">
              <td className="py-1 pr-2 truncate">{c.name}</td>
              <td className="text-right font-mono text-slate-400">{oversOf(c.balls)}</td>
              <td className="text-right font-mono text-slate-400">{c.runs}</td>
              <td className="text-right font-mono font-bold">{c.wickets}</td>
              <td className="text-right font-mono text-slate-400">{economy(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Plays the closing overs back one ball at a time. */
function FinalOvers({ inn, target }: { inn: Innings; target: number }) {
  const balls = finalOvers(inn, 2);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (shown >= balls.length) { setPlaying(false); return; }
    const id = setTimeout(() => setShown((n) => n + 1), PLAYBACK_MS);
    return () => clearTimeout(id);
  }, [playing, shown, balls.length]);

  if (balls.length === 0) return null;
  const last = shown > 0 ? balls[shown - 1] : null;

  return (
    <div className="rounded-xl bg-slate-950/70 p-3">
      <div className="flex items-center gap-2">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          The closing overs
        </h4>
        <button
          onClick={() => { setShown(0); setPlaying(true); }}
          className="ml-auto rounded bg-amber-500 px-3 py-1 text-xs font-black text-slate-950 hover:bg-amber-400"
        >
          {playing ? "Playing…" : "▶ Watch"}
        </button>
        <button
          onClick={() => { setPlaying(false); setShown(balls.length); }}
          className="rounded bg-slate-800 px-2 py-1 text-xs font-bold hover:bg-slate-700"
        >
          Show all
        </button>
      </div>

      {last && (
        <div className="mt-2 text-center">
          <motion.p
            key={shown}
            initial={{ scale: 1.15, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-mono text-2xl font-black"
          >
            {last.runsAfter}/{last.wicketsAfter}
          </motion.p>
          <p className="text-[11px] text-slate-400">
            {last.strikerName} v {last.bowlerName} · need {Math.max(0, target - last.runsAfter)} more
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <AnimatePresence initial={false}>
          {balls.slice(0, shown).map((b, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${outcomeStyle(b.outcome)}`}
              title={`${b.over + 1}.${b.ball} — ${b.strikerName} v ${b.bowlerName}`}
            >
              {outcomeLabel(b.outcome)}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Scorecard({ match, franchises, onClose, onWatch }: Props) {
  const byId = (id: string) => franchises.find((f) => f.id === id)!;
  const home = byId(match.homeId);
  const away = byId(match.awayId);
  const winner = byId(match.winnerId);
  const potm = playerOfTheMatch(match.detail);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="my-4 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-4"
      >
        <div className="flex items-start gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Result</p>
            <h3 className="text-xl font-black">
              <span style={{ color: winner.color }}>{winner.name}</span> won by {match.margin}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {home.name} {match.homeLine} · {away.name} {match.awayLine}
            </p>
            {potm && (
              <p className="mt-1 text-xs">
                <span className="font-black text-amber-400">Player of the match</span>{" "}
                <span className="text-slate-200">{potm.name} — {potm.line}</span>
              </p>
            )}
          </div>
          <button
            onClick={onWatch}
            className="ml-auto rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400"
          >
            ▶ Watch on the ground
          </button>
          <button onClick={onClose} className="ml-2 rounded bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <FinalOvers inn={match.detail.second} target={match.detail.first.runs + 1} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <InningsCard inn={match.detail.first} name={home.name} color={home.color} />
          <InningsCard inn={match.detail.second} name={away.name} color={away.color} />
        </div>
      </motion.div>
    </motion.div>
  );
}
