// "Skip the rest": confirmation for handing the remaining lots to the sim.
// Worth a prompt rather than a bare button — it ends the auction for good.

import { motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import { lotsRemaining } from "../engine/autoplay";
import { unfilledNeeds, SQUAD_MAX } from "../engine/rules";
import { money } from "./format";

interface Props {
  auction: AuctionState;
  humanId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function FinishModal({ auction, humanId, onConfirm, onCancel }: Props) {
  const me = auction.franchises.find((f) => f.id === humanId)!;
  const needs = unfilledNeeds(me.squad);
  const needsText = Object.entries(needs).map(([r, n]) => `${n} ${r}`).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center"
      >
        <p className="text-3xl">⏭</p>
        <h3 className="mt-2 text-xl font-black">Skip the rest of the pool?</h3>
        <p className="mt-2 text-sm text-slate-400">
          The remaining <span className="font-bold text-slate-200">{lotsRemaining(auction)} lots</span> will
          be auctioned automatically. Your assistant keeps bidding for{" "}
          <span style={{ color: me.color }}>{me.name}</span> — respecting any ceilings you set — so your
          squad still gets finished.
        </p>

        <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-left text-xs">
          <p className="text-slate-400">
            Squad <span className="font-mono font-bold text-slate-200">{me.squad.length}/{SQUAD_MAX}</span>
            {" · "}purse <span className="font-mono font-bold text-slate-200">{money(me.budget)}</span>
          </p>
          {needsText && <p className="mt-1 font-bold text-amber-400">Still needs {needsText}</p>}
        </div>

        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={onConfirm}
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-black text-slate-950 hover:bg-amber-400"
          >
            Simulate to the end
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-5 py-2.5 font-bold text-slate-300 hover:bg-slate-800"
          >
            Keep bidding
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
