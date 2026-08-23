// Pre-auction planning: browse the full pool, flag your targets and commit a
// ceiling to each. During the auction those ceilings are what the HUD holds
// you to — the plan exists to be broken, visibly.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import playersJson from "../data/players.json";
import { SETS } from "../engine/sets";
import { START_BUDGET } from "../engine/franchises";
import { useGameStore } from "../store/gameStore";
import { money } from "../components/format";
import Stars from "../components/Stars";
import type { Player, Role } from "../engine/types";

const players = playersJson as Player[];
const ROLE_STYLE: Record<Role, string> = {
  BAT: "bg-amber-500/15 text-amber-400",
  BOWL: "bg-sky-500/15 text-sky-400",
  AR: "bg-emerald-500/15 text-emerald-400",
  WK: "bg-fuchsia-500/15 text-fuchsia-400",
};
/** Ladder of sensible ceilings, in lakhs. */
const STEPS = [100, 200, 400, 600, 900, 1200, 1600, 2000, 2500, 3000, 4000, 5000];

export default function ShortlistPlanner({ onClose }: { onClose: () => void }) {
  const shortlist = useGameStore((s) => s.shortlist);
  const setTarget = useGameStore((s) => s.setTarget);
  const removeTarget = useGameStore((s) => s.removeTarget);
  const clearShortlist = useGameStore((s) => s.clearShortlist);
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [onlyTargets, setOnlyTargets] = useState(false);

  const committed = useMemo(
    () => Object.values(shortlist).reduce((a, b) => a + b, 0),
    [shortlist],
  );
  const count = Object.keys(shortlist).length;
  const over = committed > START_BUDGET;

  const defaultCeiling = (p: Player) =>
    STEPS.find((s) => s >= Math.round(p.basePrice * (1 + (p.rating - 60) / 12))) ?? 5000;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 18 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
      >
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-lg font-black">Plan your auction</h2>
            <p className="text-xs text-slate-400">
              Flag targets and set your ceiling. You'll be reminded when they come up.
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded bg-amber-500 px-4 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-400">
            Done
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2 text-xs">
          {(["ALL", "BAT", "BOWL", "AR", "WK"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded px-2 py-1 font-bold ${roleFilter === r ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:bg-slate-800"}`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setOnlyTargets((v) => !v)}
            className={`rounded px-2 py-1 font-bold ${onlyTargets ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:bg-slate-800"}`}
          >
            ★ targets only
          </button>
          <span className={`ml-auto font-mono font-bold ${over ? "text-red-400" : "text-slate-300"}`}>
            {count} targets · {money(committed)} committed
          </span>
          {count > 0 && (
            <button onClick={clearShortlist} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-800">
              clear
            </button>
          )}
        </div>

        {over && (
          <p className="bg-red-950/60 px-4 py-1.5 text-xs font-bold text-red-300">
            Your ceilings total more than your {money(START_BUDGET)} purse — you can't win them all.
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {SETS.map((set) => {
            const inSet = players.filter(
              (p) =>
                p.setId === set.id &&
                (roleFilter === "ALL" || p.role === roleFilter) &&
                (!onlyTargets || shortlist[p.id] !== undefined),
            );
            if (inSet.length === 0) return null;
            return (
              <section key={set.id} className="mt-4">
                <h3 className="sticky top-0 bg-slate-900 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Set {set.order} · {set.name}
                </h3>
                <ul className="divide-y divide-slate-800/70">
                  {inSet.map((p) => {
                    const target = shortlist[p.id];
                    return (
                      <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <button
                          onClick={() =>
                            target === undefined ? setTarget(p.id, defaultCeiling(p)) : removeTarget(p.id)
                          }
                          className={`w-6 shrink-0 text-lg leading-none ${target !== undefined ? "text-amber-400" : "text-slate-700 hover:text-slate-500"}`}
                          title={target !== undefined ? "remove target" : "add target"}
                        >
                          {target !== undefined ? "★" : "☆"}
                        </button>
                        <span className={`w-11 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${ROLE_STYLE[p.role]}`}>
                          {p.role}
                        </span>
                        <span className="truncate font-medium">
                          {p.name}
                          {p.overseas && <span className="ml-1 text-[10px]">✈</span>}
                        </span>
                        <Stars rating={p.rating} size={11} className="hidden shrink-0 sm:inline-flex" />
                        <span className="ml-auto shrink-0 text-xs text-slate-500">{money(p.basePrice)}</span>
                        {target !== undefined ? (
                          <select
                            value={target}
                            onChange={(e) => setTarget(p.id, Number(e.target.value))}
                            className="w-24 shrink-0 rounded bg-slate-800 px-1 py-0.5 text-xs font-mono font-bold text-amber-300"
                          >
                            {STEPS.filter((s) => s >= p.basePrice).map((s) => (
                              <option key={s} value={s}>{money(s)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="w-24 shrink-0" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
