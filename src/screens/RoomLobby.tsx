// Multiplayer waiting room: share the code, watch people take seats, and the
// host starts when everyone's in. Empty seats stay bots, so a room of two can
// still run a full eight-franchise auction.

import { motion } from "motion/react";
import type { RoomSettings, Seat } from "../../worker/src/protocol";
import type { AuctionState } from "../engine/types";
import { money } from "../components/format";

interface Props {
  roomCode: string;
  seats: Seat[];
  auction: AuctionState | null;
  franchiseId: string | null;
  isHost: boolean;
  settings: RoomSettings;
  onSettings: (s: Partial<RoomSettings>) => void;
  onStart: () => void;
  onLeave: () => void;
}

export default function RoomLobby({
  roomCode, seats, auction, franchiseId, isHost, settings, onSettings, onStart, onLeave,
}: Props) {
  const humans = seats.filter((s) => s.isHuman).length;
  const shareUrl = `${location.origin}/?room=${roomCode}`;
  const watchUrl = `${shareUrl}&spectate=1`;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 text-slate-100">
      <div className="fixed inset-0 -z-20 bg-gradient-to-b from-slate-900 via-slate-950 to-black" />
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-slate-950/70 p-6 backdrop-blur-md"
      >
        <h1 className="text-center text-3xl font-black">
          Auction<span className="text-amber-400">Room</span>
        </h1>

        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Room code</p>
          <p className="font-mono text-3xl font-black tracking-[0.25em] text-amber-300 sm:text-4xl sm:tracking-[0.35em]">
            {roomCode}
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
              className="rounded bg-slate-800 px-3 py-1 text-xs font-bold hover:bg-slate-700"
            >
              Copy invite link
            </button>
            <button
              onClick={() => void navigator.clipboard.writeText(watchUrl)}
              className="rounded bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400 hover:bg-slate-700"
              title="For people who just want to watch"
            >
              Copy watch link
            </button>
          </div>
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-500">
          Seats · {humans} human{humans === 1 ? "" : "s"}, {seats.length - humans} bots
        </p>
        <ul className="mt-2 space-y-1.5">
          {seats.map((s) => {
            const f = auction?.franchises.find((x) => x.id === s.franchiseId);
            const mine = s.franchiseId === franchiseId;
            return (
              <li
                key={s.franchiseId}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${mine ? "bg-amber-500/10 ring-1 ring-amber-500/40" : "bg-slate-900/60"}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f?.color ?? "#64748b" }} />
                <span className="truncate font-bold">{f?.name ?? s.franchiseId}</span>
                <span className={`hidden truncate text-xs sm:inline ${s.isHuman ? "text-slate-300" : "italic text-slate-500"}`}>
                  {s.name}
                </span>
                {mine && <span className="rounded bg-slate-700 px-1 text-[9px] font-black text-amber-300">YOU</span>}
                {s.isHuman && (
                  <span className={`ml-auto text-[10px] font-bold ${s.connected ? "text-emerald-400" : "text-red-400"}`}>
                    {s.connected ? "● online" : "○ away"}
                  </span>
                )}
                {f && <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-slate-500 sm:inline">{money(f.budget)}</span>}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 rounded-xl border border-slate-800 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Room settings {!isHost && <span className="text-slate-600">· host only</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {(["easy", "normal", "hard"] as const).map((d) => (
              <button
                key={d}
                disabled={!isHost}
                onClick={() => onSettings({ difficulty: d })}
                className={`rounded px-2.5 py-1 font-bold capitalize ${
                  settings.difficulty === d ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                } ${isHost ? "hover:brightness-110" : "opacity-60"}`}
              >
                {d}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-slate-400">
              Clock
              <input
                type="range" min={6} max={30} step={1}
                disabled={!isHost}
                value={settings.lotSeconds}
                onChange={(e) => onSettings({ lotSeconds: Number(e.target.value) })}
                className="w-24 accent-amber-500 disabled:opacity-50"
                aria-label="Seconds per lot"
              />
              <span className="w-8 font-mono font-bold text-slate-200">{settings.lotSeconds}s</span>
            </label>
          </div>
        </div>

        {isHost ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="mt-6 w-full rounded-xl bg-amber-500 py-3.5 text-lg font-black text-slate-950 hover:bg-amber-400"
          >
            Start Auction
          </motion.button>
        ) : (
          <p className="mt-6 text-center text-sm text-slate-400">
            Waiting for the host to start…
          </p>
        )}
        <button onClick={onLeave} className="mt-2 w-full text-xs text-slate-500 hover:text-slate-300">
          Leave room
        </button>
      </motion.div>
    </div>
  );
}
