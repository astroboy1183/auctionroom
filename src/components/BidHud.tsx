// The money HUD: timer ring, the standing bid, who owns it, and the
// BID/PASS controls — one compact block pinned to the bottom-right so the
// centre of the screen belongs to the auction hall.

import { motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import TimerRing from "./TimerRing";
import { money } from "./format";

interface Props {
  auction: AuctionState;
  humanId: string;
  lotLen: number;
  canBidNow: boolean;
  bidBlockedReason?: string;
  nextAmount: number;
  humanPassed: boolean;
  onBid: () => void;
  onPass: () => void;
}

export default function BidHud({
  auction, humanId, lotLen, canBidNow, bidBlockedReason, nextAmount, humanPassed, onBid, onPass,
}: Props) {
  const leader = auction.franchises.find((f) => f.id === auction.currentBidderId);
  const leading = auction.currentBidderId === humanId;

  return (
    <div className="pointer-events-auto w-full rounded-xl bg-slate-950/70 p-3 backdrop-blur-md sm:w-auto">
      <div className="flex items-center gap-4">
        <TimerRing timer={auction.timer} total={lotLen} hasBid={auction.currentBid !== null} />
        <div className="min-w-[130px]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            {leader ? "Leading bid" : "Opens at"}
          </p>
          <motion.p
            key={auction.currentBid ?? -1}
            initial={{ scale: 1.3, color: leader?.color ?? "#f59e0b" }}
            animate={{ scale: 1, color: "#f8fafc" }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="font-mono text-3xl font-black leading-none"
          >
            {money(auction.currentBid ?? auction.currentPlayer!.basePrice)}
          </motion.p>
          <p className="mt-1 h-4 text-xs font-bold" style={{ color: leader?.color }}>
            {leader ? `${leader.name}${leading ? " (you)" : ""}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          disabled={!canBidNow}
          onClick={onBid}
          className="rounded-lg bg-amber-500 px-4 py-3 text-base font-black text-slate-950 shadow-lg shadow-amber-500/25 enabled:hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800/80 disabled:text-slate-500"
        >
          {leading ? "You lead" : canBidNow ? `BID ${money(nextAmount)}` : (bidBlockedReason ?? "…")}
        </motion.button>
        <button
          disabled={humanPassed || leading}
          onClick={onPass}
          className="rounded-lg border border-slate-700/80 px-4 font-bold text-slate-300 enabled:hover:bg-slate-800/70 disabled:opacity-35"
        >
          {humanPassed ? "Out" : "Pass"}
        </button>
      </div>
    </div>
  );
}
