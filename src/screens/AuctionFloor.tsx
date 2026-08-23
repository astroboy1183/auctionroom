// The main screen, laid out as a broadcast overlay: every control hugs an
// edge so the middle of the frame belongs to the 3D auction hall.

import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "../store/gameStore";
import { useAuctionDriver } from "../hooks/useAuctionDriver";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { hushAuctioneer, whoosh } from "../lib/audio";
import { canBid } from "../engine/rules";
import { nextBidAmount } from "../engine/bids";
import { ACCEL_SECONDS, LOT_SECONDS } from "../engine/auction";
import TeamRail from "../components/TeamRail";
import LowerThird from "../components/LowerThird";
import BidHud from "../components/BidHud";
import BidTicker from "../components/BidTicker";
import TargetStrip from "../components/TargetStrip";
import RtmModal from "../components/RtmModal";
import SoldBanner from "../components/SoldBanner";
import SquadDrawer from "../components/SquadDrawer";

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
  const skipping = useGameStore((s) => s.skipping);
  const setSkipping = useGameStore((s) => s.setSkipping);
  const outbid = useGameStore((s) => s.outbid);
  const clearOutbid = useGameStore((s) => s.clearOutbid);
  const shortlist = useGameStore((s) => s.shortlist);
  // The alert clears itself; there is no tick during rtm/sold to re-render it.
  useEffect(() => {
    if (!outbid) return;
    const id = setTimeout(clearOutbid, 2600);
    return () => clearTimeout(id);
  }, [outbid, clearOutbid]);
  const [squadOpen, setSquadOpen] = useState(false);

  const player = auction.currentPlayer;
  const human = auction.franchises.find((f) => f.id === humanId)!;
  if (!player) return null;

  const set = auction.sets.find((s) => s.id === player.setId);
  const bidCheck = canBid(auction, humanId);
  const nextAmount = nextBidAmount(auction.currentBid, player.basePrice);
  const lotLen = auction.accelerated ? ACCEL_SECONDS : LOT_SECONDS;
  const remaining = auction.pool.length - auction.poolIndex;

  return (
    <div className={`relative min-h-screen text-slate-100 ${view3d ? "" : "bg-slate-950"}`}>
      {view3d ? (
        <Suspense fallback={<div className="fixed inset-0 -z-10 bg-slate-950" />}>
          <Hall />
        </Suspense>
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-900 via-slate-950 to-black" />
      )}

      {/* ---- top bar: set name, count, view/sound toggles ---- */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 py-2.5 sm:px-5">
        <motion.div
          key={set?.id ?? "accel"}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md bg-slate-950/60 px-2.5 py-1.5 backdrop-blur-md"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
            {auction.accelerated ? "⚡ Accelerated Round" : `Set ${set?.order}`}
          </p>
          <p className="text-sm font-bold leading-tight">
            {auction.accelerated ? "Final calls" : set?.name}
          </p>
        </motion.div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <span className="rounded-md bg-slate-950/60 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-md">
            {remaining} to go
          </span>
          <button
            onClick={toggleView3d}
            title={view3d ? "switch to 2D view" : "switch to 3D hall"}
            className={`rounded-md bg-slate-950/60 px-2 py-1 text-base leading-none backdrop-blur-md hover:bg-slate-800/70 ${view3d ? "" : "opacity-40"}`}
          >
            🏟
          </button>
          <button
            onClick={() => { if (soundOn) hushAuctioneer(); toggleSound(); }}
            title={soundOn ? "mute" : "unmute"}
            className="rounded-md bg-slate-950/60 px-2 py-1 text-base leading-none backdrop-blur-md hover:bg-slate-800/70"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {/* ---- left rail: the eight franchises ---- */}
      <aside className="pointer-events-auto fixed left-0 top-16 z-20 hidden w-[170px] flex-col gap-1 px-2 sm:flex">
        {auction.franchises.map((f) => (
          <TeamRail
            key={f.id}
            franchise={f}
            isLeading={auction.currentBidderId === f.id}
            passed={auction.passed.includes(f.id)}
            outbidKey={f.id === humanId && outbid ? outbid.at : undefined}
          />
        ))}
        <button
          onClick={() => setSquadOpen(true)}
          className="mt-1 rounded-md bg-slate-950/55 py-1.5 text-[11px] font-bold text-slate-300 backdrop-blur-md hover:bg-slate-800/70"
        >
          My Squad →
        </button>
      </aside>

      {/* mobile: franchises collapse to a scrolling strip under the header */}
      <div className="pointer-events-auto fixed inset-x-0 top-14 z-20 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:hidden">
        {auction.franchises.map((f) => (
          <div key={f.id} className="w-[120px] shrink-0">
            <TeamRail
              franchise={f}
              isLeading={auction.currentBidderId === f.id}
              passed={auction.passed.includes(f.id)}
            />
          </div>
        ))}
        <button
          onClick={() => setSquadOpen(true)}
          className="w-[86px] shrink-0 rounded-md bg-slate-950/55 text-[11px] font-bold text-slate-300 backdrop-blur-md"
        >
          My Squad →
        </button>
      </div>

      {/* ---- right: targets + recent bids ---- */}
      <div className="pointer-events-none fixed right-3 top-16 z-20 hidden w-[238px] space-y-2 lg:block">
        <TargetStrip auction={auction} shortlist={shortlist} budget={human.budget} />
        <div className="rounded-lg bg-slate-950/55 p-2.5 backdrop-blur-md">
          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Bidding</p>
          <BidTicker auction={auction} />
        </div>
      </div>

      {/* ---- outbid alert ---- */}
      <AnimatePresence>
        {outbid && (
          <motion.div
            key={outbid.at}
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="pointer-events-none fixed bottom-40 left-1/2 z-30 -translate-x-1/2 rounded-full bg-red-950/85 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-red-200 shadow-lg backdrop-blur-md sm:bottom-32"
          >
            Outbid by <span style={{ color: outbid.color }}>{outbid.by}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- bottom: lower-third + money HUD ---- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-stretch gap-2 px-3 pb-3 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:pb-4">
        <div className="w-full sm:max-w-md">
          <LowerThird player={player} ceiling={shortlist[player.id]} />
        </div>
        <BidHud
          auction={auction}
          humanId={humanId}
          lotLen={lotLen}
          canBidNow={bidCheck.ok}
          bidBlockedReason={bidCheck.reason === "not in bidding phase" ? "…" : bidCheck.reason}
          nextAmount={nextAmount}
          humanPassed={auction.passed.includes(humanId)}
          skipping={skipping}
          ceiling={shortlist[player.id]}
          onBid={() => dispatch({ type: "BID", franchiseId: humanId })}
          onPass={() => { whoosh(); dispatch({ type: "PASS", franchiseId: humanId }); }}
          onSkip={() => {
            whoosh();
            dispatch({ type: "PASS", franchiseId: humanId });
            setSkipping(true);
          }}
        />
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
