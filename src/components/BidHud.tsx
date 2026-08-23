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
  skipping: boolean;
  /** Your pre-auction ceiling for this player, if you set one. */
  ceiling?: number;
  onBid: () => void;
  onPass: () => void;
  onSkip: () => void;
}

export default function BidHud({
  auction, humanId, lotLen, canBidNow, bidBlockedReason, nextAmount, humanPassed, skipping,
  ceiling, onBid, onPass, onSkip,
}: Props) {
  const overPlan = ceiling !== undefined && nextAmount > ceiling;
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

      <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          disabled={!canBidNow}
          onClick={onBid}
          className={`rounded-lg px-4 py-3 text-base font-black text-slate-950 shadow-lg enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-800/80 disabled:text-slate-500 ${
            overPlan ? "bg-red-500 shadow-red-500/25" : "bg-amber-500 shadow-amber-500/25"
          }`}
        >
          {leading ? "You lead" : canBidNow ? `BID ${money(nextAmount)}` : (bidBlockedReason ?? "…")}
        </motion.button>
        <button
          disabled={humanPassed || leading}
          onClick={onPass}
          title="Sit this player out — you can't re-enter the bidding"
          className="rounded-lg border border-slate-700/80 px-3.5 text-sm font-bold text-slate-300 enabled:hover:bg-slate-800/70 disabled:opacity-35"
        >
          {humanPassed ? "Out ✓" : "Pass"}
        </button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          disabled={leading || skipping}
          onClick={onSkip}
          title="Skip: sit out and fast-forward to the result"
          className="rounded-lg border border-slate-700/80 px-3 text-sm font-bold text-slate-400 enabled:hover:bg-slate-800/70 disabled:opacity-35"
        >
          {skipping ? "⏩…" : "⏩"}
        </motion.button>
      </div>
      {humanPassed && !skipping && (
        <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          You're out of this lot
        </p>
      )}
      {!humanPassed && overPlan && !leading && (
        <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-red-400">
          Over your {money(ceiling!)} plan
        </p>
      )}
    </div>
  );
}
