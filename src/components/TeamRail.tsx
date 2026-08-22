// Compact franchise rail — the broadcast "big board" reduced to a strip so
// the hall stays visible. Colour bar, short name, purse, slots; the leading
// team lights up like a raised paddle.

import { useEffect } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { Franchise } from "../engine/types";
import { SQUAD_MAX, overseasCount } from "../engine/rules";
import { START_BUDGET } from "../engine/franchises";
import { moneyCompact } from "./format";

interface Props {
  franchise: Franchise;
  isLeading: boolean;
  passed: boolean;
  /** Bumped when this franchise (the human) has just lost the lead. */
  outbidKey?: number;
}

/** "Hyderabad Hawks" → "Hawks" — the rail has no room for the city. */
function shortName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}

export default function TeamRail({ franchise: f, isLeading, passed, outbidKey }: Props) {
  const shake = useAnimationControls();

  // Fire the outbid shake without remounting: a key change here would restart
  // the inner leading-state spring and make the entry visibly pop.
  useEffect(() => {
    if (!outbidKey) return;
    void shake.start({
      x: [0, -5, 5, -4, 3, 0],
      backgroundColor: ["rgba(2,6,23,0)", "rgba(127,29,29,0.8)", "rgba(2,6,23,0)"],
      transition: { duration: 0.55 },
    });
  }, [outbidKey, shake]);

  return (
    <motion.div animate={shake} className="rounded-md">
    <motion.div
      animate={
        isLeading
          ? { boxShadow: `inset 3px 0 0 ${f.color}, 0 0 20px ${f.color}44`, opacity: 1 }
          : { boxShadow: `inset 3px 0 0 ${f.color}66`, opacity: passed ? 0.4 : 0.9 }
      }
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="rounded-md bg-slate-950/55 px-2 py-1.5 backdrop-blur-md"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="truncate text-[13px] font-bold leading-tight">{shortName(f.name)}</span>
        {f.isHuman && <span className="text-[9px] font-black text-amber-400">YOU</span>}
        {isLeading && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="ml-auto text-[10px] font-black" style={{ color: f.color }}
          >
            ●
          </motion.span>
        )}
        {passed && !isLeading && <span className="ml-auto text-[9px] uppercase text-slate-600">out</span>}
      </div>
      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-slate-800/80">
        <motion.div
          className="h-full rounded-full"
          style={{ background: f.color }}
          animate={{ width: `${(f.budget / START_BUDGET) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="mt-0.5 flex items-baseline justify-between text-[10px] leading-tight text-slate-400">
        <span className="font-mono font-semibold text-slate-200">{moneyCompact(f.budget)}</span>
        <span>
          {f.squad.length}/{SQUAD_MAX}
          {overseasCount(f.squad) > 0 && <span className="ml-1 text-slate-500">✈{overseasCount(f.squad)}</span>}
        </span>
      </div>
    </motion.div>
    </motion.div>
  );
}
