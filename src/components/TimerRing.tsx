// The lot clock: an SVG ring that drains each second and turns hostile in
// the final three — the "going once / going twice" state (CLAUDE.md §7).

import { motion } from "motion/react";

interface Props {
  timer: number;
  total: number;
  hasBid: boolean;
}

export default function TimerRing({ timer, total, hasBid }: Props) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, timer) / total;
  const closing = timer <= 3;
  const color = closing ? "#ef4444" : timer <= 6 ? "#f59e0b" : "#34d399";
  const call = hasBid && timer === 2 ? "going once…" : hasBid && timer === 1 ? "going twice…" : null;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r={R} fill="none" stroke="#1e293b" strokeWidth="7" />
        <motion.circle
          cx="52" cy="52" r={R} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          animate={{ strokeDashoffset: C * (1 - frac) }}
          transition={{ duration: 0.9, ease: "linear" }}
        />
      </svg>
      <motion.span
        key={timer}
        initial={{ scale: closing ? 1.5 : 1.15, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-3xl font-black ${closing ? "text-red-400" : "text-slate-100"}`}
      >
        {Math.max(0, timer)}
      </motion.span>
      {call && (
        <motion.span
          key={call}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-5 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-red-400"
        >
          {call}
        </motion.span>
      )}
    </div>
  );
}
