// Between seasons: choose who to keep. This is where career mode earns its
// keep — a player you bought cheap and who then scored 400 runs is suddenly
// expensive to keep and painful to lose.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useGameStore } from "../store/gameStore";
import {
  MAX_CAREER_RETENTIONS, careerLine, effectiveRating, purseAfterRetentions, retentionCost,
} from "../engine/career";
import { money } from "../components/format";
import { SQUAD_MAX } from "../engine/rules";
import Portrait from "../components/Portrait";
import Stars from "../components/Stars";
import TradeWindow from "./TradeWindow";
import { AnimatePresence } from "motion/react";

export default function SeasonEnd({ onClose }: { onClose: () => void }) {
  const auction = useGameStore((s) => s.auction);
  const career = useGameStore((s) => s.career)!;
  const humanId = useGameStore((s) => s.humanId);
  const advanceSeason = useGameStore((s) => s.advanceSeason);
  const quitCareer = useGameStore((s) => s.quitCareer);

  const me = auction.franchises.find((f) => f.id === humanId)!;
  const [keep, setKeep] = useState<string[]>([]);
  const [trading, setTrading] = useState(false);

  const squad = useMemo(
    () => [...me.squad].sort((a, b) => effectiveRating(b, career) - effectiveRating(a, career)),
    [me.squad, career],
  );

  const toggle = (id: string) =>
    setKeep((k) =>
      k.includes(id) ? k.filter((x) => x !== id) : k.length < MAX_CAREER_RETENTIONS ? [...k, id] : k,
    );

  const cost = retentionCost(keep.length);
  const purse = purseAfterRetentions(keep.length);
  const lastSeason = career.history[career.history.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/92 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="my-6 w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          End of season {career.season}
        </p>
        <h2 className="mt-1 text-2xl font-black">Who do you keep?</h2>
        {lastSeason && (
          <p className="mt-1 text-sm text-slate-400">
            You finished <b className="text-slate-200">#{lastSeason.humanPosition}</b> with{" "}
            {lastSeason.humanWon}W {lastSeason.humanLost}L.
            {lastSeason.championId === humanId && " And you won the title."}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Keep up to {MAX_CAREER_RETENTIONS}. Each one costs more than the last and comes out of next
          season's purse — everyone else goes back into the auction.
        </p>

        <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-sm">
          <span className="font-bold">{keep.length}/{MAX_CAREER_RETENTIONS} kept</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-400">retention cost {money(cost)}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="font-mono font-bold text-amber-400">{money(purse)} purse</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-400">{SQUAD_MAX - keep.length} slots to fill</span>
        </div>

        <ul className="mt-3 max-h-[45vh] space-y-1 overflow-y-auto">
          {squad.map((p) => {
            const chosen = keep.includes(p.id);
            const eff = effectiveRating(p, career);
            const drift = eff - p.rating;
            const record = career.records[p.id];
            return (
              <li key={p.id}>
                <button
                  onClick={() => toggle(p.id)}
                  disabled={!chosen && keep.length >= MAX_CAREER_RETENTIONS}
                  className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition ${
                    chosen ? "bg-amber-500/15 ring-1 ring-amber-500/50" : "bg-slate-900/70 hover:bg-slate-800/70"
                  } disabled:opacity-40`}
                >
                  <Portrait player={p} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {p.name}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-500">{p.role}</span>
                      {drift !== 0 && (
                        <span className={`ml-1.5 text-[10px] font-bold ${drift > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {drift > 0 ? "▲" : "▼"}{Math.abs(drift)}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{careerLine(record)}</p>
                  </div>
                  <Stars rating={eff} size={11} />
                  <span className="w-8 text-right font-mono text-xs text-amber-400">{eff}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setTrading(true)}
          className="mt-4 w-full rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
        >
          ⇄ Open the transfer window
        </button>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => { advanceSeason(keep); onClose(); }}
            className="flex-1 rounded-xl bg-amber-500 py-3 font-black text-slate-950 hover:bg-amber-400"
          >
            Start season {career.season + 1}
          </button>
          <button
            onClick={() => { quitCareer(); onClose(); }}
            className="rounded-xl border border-slate-700 px-5 font-bold text-slate-300 hover:bg-slate-800"
          >
            End career
          </button>
        </div>
      </motion.div>
      <AnimatePresence>
        {trading && <TradeWindow onClose={() => setTrading(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
