// The real-time driver: feeds TICKs to the engine, runs bot decision cycles
// between ticks, answers bot-side RTM stages after a beat of suspense, and
// advances past sold/unsold interstitials. The engine itself owns no timers.

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import { botAction, botRtmMatch, botRtmRaise, botRtmUseCard } from "../engine/bots";
import { shuffle, seedRng, type Rng } from "../engine/rng";

const TICK_MS = 1000;
const BOT_CYCLE_MS = 420;
const RTM_SUSPENSE_MS = 1100;
const SOLD_BANNER_MS = 1900;
const UNSOLD_BANNER_MS = 1100;

export function useAuctionDriver() {
  const phase = useGameStore((s) => s.auction.phase);
  const rngRef = useRef<Rng>(seedRng(Date.now() >>> 0));

  // Clock + bot bidding while a lot is open.
  useEffect(() => {
    if (phase !== "bidding") return;
    const tick = setInterval(() => {
      useGameStore.getState().dispatch({ type: "TICK" });
    }, TICK_MS);
    const bots = setInterval(() => {
      const { auction, dispatch } = useGameStore.getState();
      if (auction.phase !== "bidding") return;
      let order;
      [order, rngRef.current] = shuffle(auction.franchises, rngRef.current);
      for (const f of order) {
        if (f.isHuman) continue;
        let move;
        [move, rngRef.current] = botAction(auction, f.id, rngRef.current);
        if (move === "bid") {
          dispatch({ type: "BID", franchiseId: f.id });
          break; // one bid per cycle keeps the war readable
        }
        if (move === "pass") dispatch({ type: "PASS", franchiseId: f.id });
      }
    }, BOT_CYCLE_MS);
    return () => {
      clearInterval(tick);
      clearInterval(bots);
    };
  }, [phase]);

  // Bot-side RTM stages resolve after a beat; human stages wait for the modal.
  const rtmStage = useGameStore((s) => s.auction.rtmOffer?.stage);
  useEffect(() => {
    if (phase !== "rtm" || !rtmStage) return;
    const { auction } = useGameStore.getState();
    const offer = auction.rtmOffer!;
    const actorId = rtmStage === "raise" ? offer.winningFranchiseId : offer.formerFranchiseId;
    const actor = auction.franchises.find((f) => f.id === actorId)!;
    if (actor.isHuman) return; // RtmModal drives it
    const t = setTimeout(() => {
      const { auction: a, dispatch } = useGameStore.getState();
      if (a.phase !== "rtm" || a.rtmOffer?.stage !== rtmStage) return;
      let v: boolean;
      if (rtmStage === "offer") {
        [v, rngRef.current] = botRtmUseCard(a, rngRef.current);
        dispatch({ type: "RTM_OFFER_RESPONSE", useCard: v });
      } else if (rtmStage === "raise") {
        [v, rngRef.current] = botRtmRaise(a, rngRef.current);
        dispatch({ type: "RTM_RAISE", raise: v });
      } else {
        [v, rngRef.current] = botRtmMatch(a, rngRef.current);
        dispatch({ type: "RTM_DECIDE", match: v });
      }
    }, RTM_SUSPENSE_MS);
    return () => clearTimeout(t);
  }, [phase, rtmStage]);

  // Sold/unsold interstitials auto-advance.
  useEffect(() => {
    if (phase !== "sold" && phase !== "unsold") return;
    const t = setTimeout(
      () => useGameStore.getState().dispatch({ type: "NEXT_PLAYER" }),
      phase === "sold" ? SOLD_BANNER_MS : UNSOLD_BANNER_MS,
    );
    return () => clearTimeout(t);
  }, [phase]);
}
