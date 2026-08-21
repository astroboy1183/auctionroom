// Phase 1 gate page: run a full random-bidder auction headlessly and dump
// the transcript + final squads. Bots replace the random policy in Phase 2.

import { useState } from "react";
import playersJson from "../data/players.json";
import { simulateRandomAuction, type SimResult } from "../engine/simulate";
import { finalScores } from "../engine/scoring";
import { START_BUDGET } from "../engine/franchises";
import { overseasCount } from "../engine/rules";
import type { Player } from "../engine/types";

const players = playersJson as Player[];

export default function DebugAuction() {
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<SimResult | null>(null);

  const run = () => setResult(simulateRandomAuction(players, seed));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-black">AuctionRoom · debug simulator</h1>
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-slate-400">Seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="w-28 rounded bg-slate-800 px-2 py-1 font-mono"
          />
          <button
            onClick={run}
            className="rounded bg-amber-500 px-4 py-1.5 font-bold text-slate-950 hover:bg-amber-400"
          >
            Run full auction
          </button>
          {result && (
            <span className="text-sm text-slate-400">
              {result.events.toLocaleString()} events · {result.state.unsold.length} unsold
            </span>
          )}
        </div>

        {result && (
          <>
            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-1">Franchise</th>
                  <th>Squad</th>
                  <th>OS</th>
                  <th>Spent</th>
                  <th>Left</th>
                  <th>Missing</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {finalScores(result.state.franchises, START_BUDGET).map((s, i) => {
                  const f = result.state.franchises.find((x) => x.id === s.franchiseId)!;
                  return (
                    <tr key={s.franchiseId} className={i === 0 ? "text-amber-400 font-bold" : ""}>
                      <td className="py-1">{i === 0 && "🏆 "}{f.name}</td>
                      <td>{f.squad.length}</td>
                      <td>{overseasCount(f.squad)}</td>
                      <td>{s.spent}L</td>
                      <td>{f.budget}L</td>
                      <td>{Object.entries(s.missing).map(([r, n]) => `${r}−${n}`).join(" ") || "—"}</td>
                      <td className="text-right font-mono">{s.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <pre className="mt-6 max-h-96 overflow-auto rounded bg-slate-900 p-3 text-xs leading-5 text-slate-300">
              {result.log.join("\n")}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
