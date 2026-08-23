// Watch a match. The ground plays back the deliveries the engine already
// simulated — this adds no cricket, it shows the cricket that happened.

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MatchResult } from "../engine/tournament";
import type { BallEvent, Innings } from "../engine/match";
import { oversOf, scoreline } from "../engine/match";
import { FIELD_SETTING } from "../engine/field";
import type { Franchise } from "../engine/types";

const Ground = lazy(() => import("../scene/Ground"));

const BALL_MS = 2200;

interface Props {
  match: MatchResult;
  franchises: Franchise[];
  onClose: () => void;
}

type InnAndSide = { inn: Innings; battingId: string; bowlingId: string };

export default function WatchMatch({ match, franchises, onClose }: Props) {
  const byId = (id: string) => franchises.find((f) => f.id === id)!;
  const innings: InnAndSide[] = [
    { inn: match.detail.first, battingId: match.homeId, bowlingId: match.awayId },
    { inn: match.detail.second, battingId: match.awayId, bowlingId: match.homeId },
  ];

  const [side, setSide] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState(0);
  const raf = useRef<number>(0);
  const started = useRef(0);

  const current = innings[side];
  const timeline = current.inn.timeline;
  const ball: BallEvent | null = timeline[index] ?? null;

  // Drive the delivery animation, then advance to the next ball.
  useEffect(() => {
    if (!playing || !ball) return;
    started.current = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, ((now - started.current) * speed) / BALL_MS);
      setPhase(p);
      if (p >= 1) {
        if (index + 1 < timeline.length) setIndex((i) => i + 1);
        else if (side === 0) { setSide(1); setIndex(0); }
        else setPlaying(false);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, index, side, speed, ball, timeline.length]);

  const batting = byId(current.battingId);
  const bowling = byId(current.bowlingId);
  const target = side === 1 ? match.detail.first.runs + 1 : null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950"
    >
      <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">Walking out…</div>}>
        <div className="absolute inset-0">
          <Ground
            ball={ball}
            phase={phase}
            battingColor={batting.color}
            bowlingColor={bowling.color}
          />
        </div>
      </Suspense>

      {/* scoreboard */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="rounded-lg bg-slate-950/80 px-3 py-2 backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: batting.color }}>
            {batting.name}
          </p>
          <p className="font-mono text-2xl font-black">
            {ball ? `${ball.runsAfter}/${ball.wicketsAfter}` : scoreline(current.inn)}
            <span className="ml-2 text-sm text-slate-400">
              ({ball ? oversOf(index + 1) : oversOf(current.inn.balls)})
            </span>
          </p>
          {target !== null && ball && (
            <p className="text-[11px] text-amber-400">
              need {Math.max(0, target - ball.runsAfter)} from{" "}
              {Math.max(0, timeline.length - index - 1)} balls
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto rounded-lg bg-slate-950/80 px-3 py-2 text-sm font-bold backdrop-blur-md hover:bg-slate-800"
        >
          ✕ Close
        </button>
      </div>

      {/* the ball just bowled */}
      {ball && (
        <motion.div
          key={`${side}-${index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit rounded-lg bg-slate-950/85 px-4 py-2 text-center backdrop-blur-md"
        >
          <p className="text-xs text-slate-400">
            {ball.bowlerName} to {ball.strikerName}
          </p>
          <p className="text-lg font-black">
            {ball.outcome === "W" ? (
              <span className="text-red-400">OUT — {ball.dismissal}</span>
            ) : ball.outcome === 6 ? (
              <span className="text-violet-400">SIX</span>
            ) : ball.outcome === 4 ? (
              <span className="text-emerald-400">FOUR</span>
            ) : ball.outcome === 0 ? (
              <span className="text-slate-500">no run</span>
            ) : (
              <span>{ball.outcome} run{ball.outcome > 1 ? "s" : ""}</span>
            )}
            {ball.shot.fielder !== null && ball.outcome !== "W" && ball.outcome !== 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                to {FIELD_SETTING[ball.shot.fielder].name}
              </span>
            )}
          </p>
        </motion.div>
      )}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg bg-amber-500 px-5 py-2 font-black text-slate-950 hover:bg-amber-400"
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${
              speed === s ? "bg-slate-700 text-slate-100" : "bg-slate-950/70 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {s}×
          </button>
        ))}
        <button
          onClick={() => {
            const last = Math.max(0, timeline.length - 12);
            setIndex(last);
            setPlaying(true);
          }}
          className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-400 hover:bg-slate-800"
        >
          Final overs
        </button>
        <span className="ml-2 rounded bg-slate-950/70 px-2 py-1 text-[11px] text-slate-500">
          Innings {side + 1} · ball {index + 1}/{timeline.length}
        </span>
      </div>
    </motion.div>
  );
}
