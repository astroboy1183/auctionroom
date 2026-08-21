// Phase 0 gate page: proves the data pipeline — all 100 players from JSON,
// grouped by auction set. Replaced by the real screens in Phase 3.

import playersJson from "./data/players.json";
import { SETS } from "./engine/sets";
import type { Player, Role } from "./engine/types";

const players = playersJson as Player[];

const ROLE_STYLES: Record<Role, string> = {
  BAT: "bg-amber-500/15 text-amber-400",
  BOWL: "bg-sky-500/15 text-sky-400",
  AR: "bg-emerald-500/15 text-emerald-400",
  WK: "bg-fuchsia-500/15 text-fuchsia-400",
};

function price(l: number): string {
  return l >= 100 ? `₹${(l / 100).toFixed(l % 100 ? 2 : 0)} Cr` : `₹${l} L`;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">
          Auction<span className="text-amber-400">Room</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Phase 0 · {players.length} players · {SETS.length} sets ·{" "}
          {players.filter((p) => p.overseas).length} overseas
        </p>

        {SETS.map((set) => {
          const inSet = players.filter((p) => p.setId === set.id);
          return (
            <section key={set.id} className="mt-8">
              <h2 className="flex items-baseline gap-2 border-b border-slate-800 pb-1 text-lg font-bold">
                <span className="text-slate-500 text-sm">Set {set.order}</span>
                {set.name}
                <span className="ml-auto text-xs font-normal text-slate-500">
                  {inSet.length} players
                </span>
              </h2>
              <ul className="mt-2 divide-y divide-slate-900">
                {inSet.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold ${ROLE_STYLES[p.role]}`}>
                      {p.role}
                    </span>
                    <span className="font-medium">
                      {p.name}
                      {p.overseas && <span className="ml-1.5 text-xs" title="Overseas">✈️</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-slate-400">{price(p.basePrice)}</span>
                    <span className="w-10 shrink-0 text-right font-mono text-amber-400">{p.rating}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
