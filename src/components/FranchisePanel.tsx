// One franchise's live status: budget bar, squad count, needs, RTM cards.
// Flashes like a raised paddle when it takes the lead (CLAUDE.md §9).

import { motion } from "motion/react";
import type { Franchise } from "../engine/types";
import { unfilledNeeds, overseasCount, SQUAD_MAX } from "../engine/rules";
import { START_BUDGET } from "../engine/franchises";
import { money } from "./format";

interface Props {
  franchise: Franchise;
  isLeading: boolean;
  passed: boolean;
}

export default function FranchisePanel({ franchise: f, isLeading, passed }: Props) {
  const needs = unfilledNeeds(f.squad);
  const needsText = Object.entries(needs).map(([r, n]) => `${n} ${r}`).join(" · ");

  return (
    <motion.div
      animate={
        isLeading
          ? { scale: 1.02, boxShadow: `0 0 0 2px ${f.color}, 0 0 24px ${f.color}55` }
          : { scale: 1, boxShadow: "0 0 0 1px rgb(51 65 85 / 0.6)" }
      }
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`rounded-xl bg-slate-900/70 p-3 backdrop-blur-sm ${passed ? "opacity-45" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-sm font-bold">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
          <span className="truncate">{f.name}</span>
          {f.isHuman && <span className="rounded bg-slate-700 px-1 text-[10px] font-black text-amber-300">YOU</span>}
        </span>
        {isLeading && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="shrink-0 text-xs font-black" style={{ color: f.color }}
          >
            ● BID
          </motion.span>
        )}
        {passed && <span className="shrink-0 text-[10px] font-bold uppercase text-slate-500">out</span>}
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-800">
        <motion.div
          className="h-full rounded"
          style={{ background: f.color }}
          animate={{ width: `${(f.budget / START_BUDGET) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono font-bold text-slate-200">{money(f.budget)}</span>
        <span>{f.squad.length}/{SQUAD_MAX} · ✈{overseasCount(f.squad)}/6 · RTM {"▮".repeat(f.rtmCards) || "–"}</span>
      </div>
      {needsText && (
        <div className="mt-1 truncate text-[10px] text-red-400/80" title={`still needs ${needsText}`}>
          needs {needsText}
        </div>
      )}
      {f.botPersonality && (
        <div className="mt-0.5 text-[10px] italic text-slate-500">{f.botPersonality.name}</div>
      )}
    </motion.div>
  );
}
