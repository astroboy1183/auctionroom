// The main screen — CLAUDE.md §9. Player card center, franchise panels,
// BID/PASS, ticker, timer ring, set banner, RTM modal, sold interstitials.

import { Suspense, lazy, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "../store/gameStore";
import { useAuctionDriver } from "../hooks/useAuctionDriver";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { hushAuctioneer, whoosh } from "../lib/audio";
import { canBid } from "../engine/rules";
import { nextBidAmount } from "../engine/bids";
import { ACCEL_SECONDS, LOT_SECONDS } from "../engine/auction";
import PlayerCard from "../components/PlayerCard";
import FranchisePanel from "../components/FranchisePanel";
import TimerRing from "../components/TimerRing";
import BidTicker from "../components/BidTicker";
import RtmModal from "../components/RtmModal";
import SoldBanner from "../components/SoldBanner";
import SquadDrawer from "../components/SquadDrawer";
import { money } from "../components/format";

// The 3D hall is a heavy chunk; it loads lazily and only when enabled.
const Hall = lazy(() => import("../scene/Hall"));

export default function AuctionFloor() {
  useAuctionDriver();
  useSoundEffects();
  const auction = useGameStore((s) => s.auction);
  const humanId = useGameStore((s) => s.humanId);
  const dispatch = useGameStore((s) => s.dispatch);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const view3d = useGameStore((s) => s.view3d);
  const toggleView3d = useGameStore((s) => s.toggleView3d);
  const [squadOpen, setSquadOpen] = useState(false);

  const player = auction.currentPlayer;
  const human = auction.franchises.find((f) => f.id === humanId)!;
  if (!player) return null;

  const set = auction.sets.find((s) => s.id === player.setId);
  const bidCheck = canBid(auction, humanId);
  const amount = nextBidAmount(auction.currentBid, player.basePrice);
  const humanPassed = auction.passed.includes(humanId);
  const leader = auction.franchises.find((f) => f.id === auction.currentBidderId);
  const lotLen = auction.accelerated ? ACCEL_SECONDS : LOT_SECONDS;
  const remaining = auction.pool.length - auction.poolIndex;

  return (
    <div className={`min-h-screen text-slate-100 ${view3d ? "bg-transparent" : "bg-slate-950"}`}>
      {view3d && (
        <Suspense fallback={null}>
          <Hall />
        </Suspense>
      )}
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 lg:flex-row lg:px-4">
        {/* franchise panels — the broadcast big board (8 teams) */}
        <aside className="flex shrink-0 snap-x gap-2 overflow-x-auto pb-1 lg:grid lg:w-[380px] lg:grid-cols-2 lg:content-start lg:overflow-visible lg:pb-0">
          {auction.franchises.map((f) => (
            <div key={f.id} className="w-[46%] shrink-0 snap-start lg:w-auto">
              <FranchisePanel
                franchise={f}
                isLeading={auction.currentBidderId === f.id}
                passed={auction.passed.includes(f.id)}
              />
            </div>
          ))}
          <button
            onClick={() => setSquadOpen(true)}
            className="w-[46%] shrink-0 rounded-xl border border-slate-800 py-2 text-sm font-bold text-slate-300 hover:bg-slate-900 lg:col-span-2 lg:w-auto"
          >
            My Squad →
          </button>
        </aside>

        {/* the block */}
        <main className="flex-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
            <motion.span key={set?.id ?? "accel"} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              {auction.accelerated ? "⚡ Accelerated Round" : `Set ${set?.order} — ${set?.name}`}
            </motion.span>
            <span className="flex items-center gap-3">
              {remaining} to go
              <button
                onClick={toggleView3d}
                title={view3d ? "switch to 2D" : "switch to 3D hall"}
                className={`rounded px-1 text-base leading-none hover:bg-slate-800 ${view3d ? "" : "opacity-40"}`}
              >
                🏟
              </button>
              <button
                onClick={() => { if (soundOn) hushAuctioneer(); toggleSound(); }}
                title={soundOn ? "mute" : "unmute"}
                className="rounded px-1 text-base leading-none hover:bg-slate-800"
              >
                {soundOn ? "🔊" : "🔇"}
              </button>
            </span>
          </div>

          <div className="mt-3">
            <PlayerCard player={player} />
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 sm:gap-10">
            <TimerRing timer={auction.timer} total={lotLen} hasBid={auction.currentBid !== null} />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {leader ? "Leading bid" : "Opens at"}
              </p>
              <motion.p
                key={auction.currentBid ?? -1}
                initial={{ scale: 1.35, color: leader?.color ?? "#f59e0b" }}
                animate={{ scale: 1, color: "#f1f5f9" }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="font-mono text-4xl font-black"
              >
                {money(auction.currentBid ?? player.basePrice)}
              </motion.p>
              {leader && (
                <p className="mt-0.5 text-sm font-bold" style={{ color: leader.color }}>
                  {leader.name}{leader.id === humanId && " (you)"}
                </p>
              )}
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-md grid-cols-[1fr_auto] gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={!bidCheck.ok}
              onClick={() => dispatch({ type: "BID", franchiseId: humanId })}
              className="rounded-xl bg-amber-500 py-3.5 text-lg font-black text-slate-950 shadow-lg shadow-amber-500/20 enabled:hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {auction.currentBidderId === humanId
                ? "You lead"
                : bidCheck.ok
                  ? `BID ${money(amount)}`
                  : bidCheck.reason === "not in bidding phase" ? "…" : bidCheck.reason}
            </motion.button>
            <button
              disabled={humanPassed || auction.currentBidderId === humanId}
              onClick={() => { whoosh(); dispatch({ type: "PASS", franchiseId: humanId }); }}
              className="rounded-xl border border-slate-700 px-5 font-bold text-slate-300 enabled:hover:bg-slate-900 disabled:opacity-40"
            >
              {humanPassed ? "Out" : "Pass"}
            </button>
          </div>

          <div className="mx-auto mt-4 max-w-md rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 backdrop-blur-sm">
            <BidTicker auction={auction} />
          </div>
        </main>
      </div>

      <AnimatePresence>
        {squadOpen && <SquadDrawer franchise={human} onClose={() => setSquadOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {(auction.phase === "sold" || auction.phase === "unsold") && <SoldBanner auction={auction} />}
      </AnimatePresence>
      <AnimatePresence>
        {auction.phase === "rtm" && <RtmModal auction={auction} />}
      </AnimatePresence>
    </div>
  );
}
