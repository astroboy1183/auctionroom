// The hammer moment: SOLD (with a dropping gavel) or UNSOLD interstitial.

import { motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import { money } from "./format";

export default function SoldBanner({ auction }: { auction: AuctionState }) {
  const sold = auction.phase === "sold";
  const winner = auction.franchises.find((f) => f.id === auction.currentBidderId);
  const player = auction.currentPlayer;
  if (!player) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="text-center">
        <motion.div
          initial={{ rotate: -70, y: -60, opacity: 0 }}
          animate={{ rotate: 0, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.1 }}
          className="text-7xl"
        >
          🔨
        </motion.div>
        <motion.h2
          initial={{ scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.28 }}
          className={`mt-2 text-6xl font-black tracking-tight ${sold ? "text-amber-400" : "text-slate-500"}`}
        >
          {sold ? "SOLD" : "UNSOLD"}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-lg text-slate-200"
        >
          {sold && winner ? (
            <>
              {player.name} → <span className="font-bold" style={{ color: winner.color }}>{winner.name}</span>{" "}
              for <span className="font-black">{money(auction.currentBid!)}</span>
            </>
          ) : (
            <>{player.name} finds no takers</>
          )}
        </motion.p>
      </div>
    </motion.div>
  );
}
