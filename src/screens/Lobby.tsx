// Pick your franchise, pick a difficulty, start the auction.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useGameStore, type Difficulty } from "../store/gameStore";
import { money } from "../components/format";
import { START_BUDGET } from "../engine/franchises";
import HallBackdrop from "../components/HallBackdrop";
import ShortlistPlanner from "./ShortlistPlanner";

const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "bots keep their wallets shut" },
  { id: "normal", label: "Normal", blurb: "a proper bidding war" },
  { id: "hard", label: "Hard", blurb: "the bots came to spend" },
];

export default function Lobby() {
  const startGame = useGameStore((s) => s.startGame);
  const [picked, setPicked] = useState("hyd");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [planning, setPlanning] = useState(false);
  const targets = Object.keys(useGameStore((s) => s.shortlist)).length;
  const FRANCHISES = useGameStore((s) => s.preview);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-slate-100">
      <HallBackdrop mode="idle" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-slate-950/70 p-6 backdrop-blur-md"
      >
        <h1 className="text-center text-5xl font-black tracking-tight">
          Auction<span className="text-amber-400">Room</span>
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          100 cricketers. {money(START_BUDGET)} purse, less retentions. 7 rival bots.
        </p>

        <h2 className="mt-8 text-xs font-black uppercase tracking-widest text-slate-500">Your franchise</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FRANCHISES.map((f) => (
            <button
              key={f.id}
              onClick={() => setPicked(f.id)}
              className={`rounded-xl border p-3 text-left transition ${
                picked === f.id
                  ? "border-transparent bg-slate-800 ring-2"
                  : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
              }`}
              style={picked === f.id ? { "--tw-ring-color": f.color } as React.CSSProperties : undefined}
            >
              <span className="flex items-center gap-2 font-bold">
                <span className="h-3 w-3 rounded-full" style={{ background: f.color }} />
                {f.name}
              </span>
              <span className="mt-1 block text-[10px] leading-tight text-slate-400">
                Retained: {f.squad.map((p) => p.name).join(", ")}
              </span>
              <span className="mt-0.5 block text-[10px] font-mono text-slate-500">
                purse {money(f.budget)}
              </span>
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-xs font-black uppercase tracking-widest text-slate-500">Difficulty</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`rounded-xl border p-3 text-center transition ${
                difficulty === d.id
                  ? "border-amber-500/60 bg-slate-800"
                  : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
              }`}
            >
              <span className="block font-bold">{d.label}</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">{d.blurb}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setPlanning(true)}
          className="mt-6 w-full rounded-xl border border-slate-700 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800/60"
        >
          📋 Plan your auction {targets > 0 && <span className="text-amber-400">· {targets} targets</span>}
        </button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onMouseEnter={() => void import("../scene/Hall")}
          onClick={() => startGame(picked, difficulty)}
          className="mt-3 w-full rounded-xl bg-amber-500 py-3.5 text-lg font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
        >
          Start Auction
        </motion.button>
        <p className="mt-3 text-center text-[10px] text-slate-600">
          Fictional franchises · unofficial fan game · players shown with public role/stat info only
        </p>
      </motion.div>
      <AnimatePresence>
        {planning && <ShortlistPlanner onClose={() => setPlanning(false)} />}
      </AnimatePresence>
    </div>
  );
}
