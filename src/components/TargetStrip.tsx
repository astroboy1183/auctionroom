// "Your next targets" — how far away each shortlisted player is, and what
// you said you'd pay. The point is to feel your plan approaching.

import { motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import { money } from "./format";

interface Props {
  auction: AuctionState;
  shortlist: Record<string, number>;
  budget: number;
}

export default function TargetStrip({ auction, shortlist, budget }: Props) {
  // Upcoming shortlisted players, in the order they will come up.
  const upcoming = auction.pool
    .slice(auction.poolIndex + 1)
    .map((p, i) => ({ player: p, lotsAway: i + 1 }))
    .filter(({ player }) => shortlist[player.id] !== undefined)
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-950/55 p-2.5 backdrop-blur-md">
      <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
        Your targets
      </p>
      <ul className="space-y-1 text-xs">
        {upcoming.map(({ player, lotsAway }) => {
          const ceiling = shortlist[player.id];
          const affordable = budget >= ceiling;
          return (
            <motion.li
              key={player.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline gap-2 whitespace-nowrap"
            >
              <span
                className={`shrink-0 rounded px-1 font-mono text-[10px] font-bold ${
                  lotsAway === 1 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}
              >
                {lotsAway === 1 ? "NEXT" : `+${lotsAway}`}
              </span>
              <span className="truncate text-slate-200">{player.name}</span>
              <span
                className={`ml-auto shrink-0 font-mono ${affordable ? "text-amber-400" : "text-red-400"}`}
                title={affordable ? "your ceiling" : "you can no longer afford your ceiling"}
              >
                {money(ceiling)}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
