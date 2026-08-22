// Pick your franchise, pick a difficulty, start the auction.

import { useState } from "react";
import { motion } from "motion/react";
import { makeDefaultFranchises } from "../engine/franchises";
import { useGameStore, type Difficulty } from "../store/gameStore";
import { money } from "../components/format";
import { START_BUDGET } from "../engine/franchises";
import HallBackdrop from "../components/HallBackdrop";

const FRANCHISES = makeDefaultFranchises();
const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "bots keep their wallets shut" },
  { id: "normal", label: "Normal", blurb: "a proper bidding war" },
  { id: "hard", label: "Hard", blurb: "the bots came to spend" },
];

export default function Lobby() {
  const startGame = useGameStore((s) => s.startGame);
  const [picked, setPicked] = useState("hyd");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

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
          100 cricketers. {money(START_BUDGET)} purse. 7 rival bots. Build the best squad.
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

        <motion.button
          whileTap={{ scale: 0.97 }}
          onMouseEnter={() => void import("../scene/Hall")}
          onClick={() => startGame(picked, difficulty)}
          className="mt-8 w-full rounded-xl bg-amber-500 py-3.5 text-lg font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
        >
          Start Auction
        </motion.button>
        <p className="mt-3 text-center text-[10px] text-slate-600">
          Fictional franchises · unofficial fan game · players shown with public role/stat info only
        </p>
      </motion.div>
    </div>
  );
}
