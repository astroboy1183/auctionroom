// The last few bids, newest first — the room's chatter.

import { AnimatePresence, motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import { money } from "./format";

export default function BidTicker({ auction }: { auction: AuctionState }) {
  const current = auction.currentPlayer;
  if (!current) return null;
  const bids = auction.bidHistory.filter((b) => b.playerId === current.id).slice(-5).reverse();
  const name = (id: string) => auction.franchises.find((f) => f.id === id)?.name ?? id;
  const color = (id: string) => auction.franchises.find((f) => f.id === id)?.color ?? "#fff";

  return (
    <div className="flex h-24 flex-col gap-1 overflow-hidden text-xs">
      <AnimatePresence initial={false}>
        {bids.map((b, i) => (
          <motion.div
            key={`${b.playerId}-${b.amount}`}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: i === 0 ? 1 : 0.55, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color(b.franchiseId) }} />
            <span className="truncate text-slate-300">{name(b.franchiseId)}</span>
            <span className="ml-auto shrink-0 whitespace-nowrap font-mono font-bold text-slate-100">
              {money(b.amount)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      {bids.length === 0 && <span className="italic text-slate-600">no bids yet…</span>}
    </div>
  );
}
