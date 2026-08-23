// Cross-room leaderboard: the best human results across every online auction
// ever played on this deployment.

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { fetchLeaderboard } from "../hooks/useRoom";
import type { LeaderboardEntry } from "../../worker/src/protocol";

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    void fetchLeaderboard().then(setEntries);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <div className="flex items-center">
          <h3 className="text-lg font-black">🏅 Hall of fame</h3>
          <button onClick={onClose} className="ml-auto rounded bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700">
            ✕
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Best results from online rooms.</p>

        {entries === null && <p className="mt-6 animate-pulse text-center text-sm text-slate-500">Loading…</p>}
        {entries?.length === 0 && (
          <p className="mt-6 text-center text-sm italic text-slate-500">
            Nobody's finished an online season yet. Be first.
          </p>
        )}

        <ol className="mt-3 space-y-1">
          {entries?.slice(0, 20).map((e, i) => (
            <li key={`${e.name}-${e.at}`} className="flex items-baseline gap-2 rounded-lg bg-slate-950/60 px-3 py-2 text-sm">
              <span className="w-5 font-black text-slate-500">{i + 1}</span>
              <span className="truncate font-bold">{e.name}</span>
              <span className="truncate text-xs text-slate-500">{e.franchise}</span>
              <span className="ml-auto shrink-0 font-mono text-xs text-slate-400">{e.won}W</span>
              <span className="w-8 shrink-0 text-right font-mono font-black text-amber-400">{e.points}</span>
            </li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}
