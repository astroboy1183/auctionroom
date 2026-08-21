// The player on the block: name, role, tags, base price, star rating.

import { motion } from "motion/react";
import type { Player, Role } from "../engine/types";
import { money } from "./format";

const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter", BOWL: "Bowler", AR: "All-Rounder", WK: "Keeper",
};
const ROLE_STYLE: Record<Role, string> = {
  BAT: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  BOWL: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  AR: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  WK: "bg-fuchsia-500/15 text-fuchsia-400 ring-fuchsia-500/30",
};

function Stars({ rating }: { rating: number }) {
  const stars = Math.round(((rating - 60) / 40) * 5 * 2) / 2; // 60→0★ .. 100→5★
  return (
    <span className="text-amber-400" title={`rating ${rating}`}>
      {Array.from({ length: 5 }, (_, i) =>
        stars >= i + 1 ? "★" : stars >= i + 0.5 ? "⯨" : "☆",
      ).join("")}
      <span className="ml-1.5 font-mono text-xs text-slate-400">{rating}</span>
    </span>
  );
}

export default function PlayerCard({ player }: { player: Player }) {
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/80 to-slate-900 p-5 text-center shadow-xl"
    >
      <div className="flex items-center justify-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${ROLE_STYLE[player.role]}`}>
          {ROLE_LABEL[player.role]}
        </span>
        {player.overseas && (
          <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/30">
            ✈ Overseas
          </span>
        )}
      </div>
      <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{player.name}</h2>
      <div className="mt-2"><Stars rating={player.rating} /></div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {player.tags.map((t) => (
          <span key={t} className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
            {t}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-400">
        Base price <span className="font-bold text-slate-200">{money(player.basePrice)}</span>
      </p>
    </motion.div>
  );
}
