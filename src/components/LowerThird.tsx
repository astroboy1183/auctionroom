// The player on the block, as a broadcast lower-third rather than a card
// that blocks the hall. Sits along the bottom edge; the room shows above it.

import { motion } from "motion/react";
import type { Player, Role } from "../engine/types";
import { money } from "./format";

const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter", BOWL: "Bowler", AR: "All-Rounder", WK: "Keeper",
};
const ROLE_COLOR: Record<Role, string> = {
  BAT: "#f59e0b", BOWL: "#38bdf8", AR: "#34d399", WK: "#e879f9",
};

function Stars({ rating }: { rating: number }) {
  const stars = Math.round(((rating - 60) / 40) * 5 * 2) / 2;
  return (
    <span className="text-amber-400" title={`rating ${rating}`}>
      {Array.from({ length: 5 }, (_, i) => (stars >= i + 1 ? "★" : stars >= i + 0.5 ? "⯨" : "☆")).join("")}
    </span>
  );
}

export default function LowerThird({ player }: { player: Player }) {
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
      className="pointer-events-none overflow-hidden rounded-lg bg-gradient-to-r from-slate-950/92 via-slate-950/85 to-slate-950/40 backdrop-blur-md"
      style={{ borderLeft: `4px solid ${ROLE_COLOR[player.role]}` }}
    >
      <div className="px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <span style={{ color: ROLE_COLOR[player.role] }}>{ROLE_LABEL[player.role]}</span>
          {player.overseas && <span className="text-indigo-300">✈ Overseas</span>}
          <Stars rating={player.rating} />
          <span className="font-mono text-slate-500">{player.rating}</span>
        </div>
        <h2 className="mt-0.5 text-2xl font-black leading-none tracking-tight sm:text-3xl">
          {player.name}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          {player.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">{t}</span>
          ))}
          <span className="text-slate-500">base {money(player.basePrice)}</span>
        </div>
      </div>
    </motion.div>
  );
}
