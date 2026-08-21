// Final scores side by side, winner declared, share text — CLAUDE.md §9.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useGameStore } from "../store/gameStore";
import { finalScores } from "../engine/scoring";
import { START_BUDGET } from "../engine/franchises";
import { unfilledNeeds, overseasCount } from "../engine/rules";
import { money } from "../components/format";
import type { Role } from "../engine/types";

const ROLE_ORDER: Role[] = ["BAT", "BOWL", "AR", "WK"];

export default function Results() {
  const auction = useGameStore((s) => s.auction);
  const humanId = useGameStore((s) => s.humanId);
  const reset = useGameStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const scores = useMemo(() => finalScores(auction.franchises, START_BUDGET), [auction]);
  const winner = auction.franchises.find((f) => f.id === scores[0].franchiseId)!;
  const humanRank = scores.findIndex((s) => s.franchiseId === humanId) + 1;

  const share = () => {
    const lines = [
      `🏏 AuctionRoom — ${winner.name} win the auction!`,
      ...scores.map((s, i) => {
        const f = auction.franchises.find((x) => x.id === s.franchiseId)!;
        return `${i + 1}. ${f.name}${f.id === humanId ? " (me)" : ""} — ${s.total} pts, ${f.squad.length} players, spent ${money(s.spent)}`;
      }),
      `I finished #${humanRank}. Play at ${location.origin}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-6xl">🏆</p>
          <h1 className="mt-2 text-4xl font-black">
            <span style={{ color: winner.color }}>{winner.name}</span> win the auction!
          </h1>
          <p className="mt-2 text-slate-400">
            {winner.id === humanId
              ? "That's you. Take a bow, chairman."
              : `You finished #${humanRank} of 4.`}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={share}
              className="rounded-lg bg-amber-500 px-5 py-2 font-bold text-slate-950 hover:bg-amber-400">
              {copied ? "Copied ✓" : "Share result"}
            </button>
            <button onClick={reset}
              className="rounded-lg border border-slate-700 px-5 py-2 font-bold hover:bg-slate-900">
              Play again
            </button>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scores.map((s, rank) => {
            const f = auction.franchises.find((x) => x.id === s.franchiseId)!;
            const needs = unfilledNeeds(f.squad);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rank * 0.1 }}
                className={`rounded-2xl border bg-slate-900/70 p-4 ${rank === 0 ? "border-amber-500/50" : "border-slate-800"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-slate-500">#{rank + 1}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: f.color }} />
                  <span className="truncate font-black">{f.name}</span>
                  {f.id === humanId && <span className="rounded bg-slate-700 px-1 text-[10px] font-black text-amber-300">YOU</span>}
                </div>
                <p className="mt-1 font-mono text-3xl font-black" style={{ color: rank === 0 ? "#f59e0b" : undefined }}>
                  {s.total}<span className="text-sm text-slate-500"> pts</span>
                </p>
                <p className="text-xs text-slate-400">
                  Σ ratings {s.base}
                  {s.penalty > 0 && <span className="text-red-400"> − {s.penalty} missing roles</span>}
                  {s.bonus > 0 && <span className="text-emerald-400"> + {s.bonus} balance</span>}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {f.squad.length}/15 · ✈ {overseasCount(f.squad)}/6 · spent {money(s.spent)} · left {money(f.budget)}
                </p>
                {Object.keys(needs).length > 0 && (
                  <p className="mt-1 text-xs font-bold text-red-400">
                    short: {Object.entries(needs).map(([r, n]) => `${n} ${r}`).join(", ")}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  {ROLE_ORDER.map((role) => {
                    const inRole = f.squad.filter((p) => p.role === role);
                    if (inRole.length === 0) return null;
                    return (
                      <div key={role}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{role}</p>
                        <ul className="text-xs leading-5">
                          {inRole.map((p) => (
                            <li key={p.id} className="flex justify-between gap-2">
                              <span className="truncate">{p.name}{p.overseas ? " ✈" : ""}</span>
                              <span className="font-mono text-slate-500">{p.rating}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
