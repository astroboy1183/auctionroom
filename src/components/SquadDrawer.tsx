// Slide-over: your roster grouped by role, spend, and what's still missing.

import { motion } from "motion/react";
import type { Franchise, Role } from "../engine/types";
import { unfilledNeeds, MIN_ROLES } from "../engine/rules";
import { START_BUDGET } from "../engine/franchises";
import { money } from "./format";

const ROLE_ORDER: Role[] = ["BAT", "BOWL", "AR", "WK"];
const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batters", BOWL: "Bowlers", AR: "All-Rounders", WK: "Keepers",
};

export default function SquadDrawer({ franchise: f, onClose }: { franchise: Franchise; onClose: () => void }) {
  const needs = unfilledNeeds(f.squad);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-slate-800 bg-slate-900 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <span className="h-3 w-3 rounded-full" style={{ background: f.color }} />
            {f.name}
          </h2>
          <button onClick={onClose} className="rounded bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700">✕</button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {f.squad.length}/15 players · spent {money(START_BUDGET - f.budget)} · {money(f.budget)} left
        </p>

        {ROLE_ORDER.map((role) => {
          const inRole = f.squad.filter((p) => p.role === role);
          const short = needs[role] ?? 0;
          return (
            <section key={role} className="mt-5">
              <h3 className="flex items-baseline justify-between border-b border-slate-800 pb-1 text-sm font-bold">
                {ROLE_LABEL[role]}
                <span className={`text-xs ${short ? "text-red-400" : "text-slate-500"}`}>
                  {inRole.length}/{MIN_ROLES[role]} min{short ? ` — need ${short} more` : " ✓"}
                </span>
              </h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {inRole.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.overseas && <span className="text-[10px]">✈️</span>}
                    <span className="ml-auto font-mono text-xs text-amber-400">{p.rating}</span>
                  </li>
                ))}
                {inRole.length === 0 && <li className="italic text-slate-600">none yet</li>}
              </ul>
            </section>
          );
        })}
      </motion.aside>
    </motion.div>
  );
}
