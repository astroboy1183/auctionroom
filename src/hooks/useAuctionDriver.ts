// The real-time driver: feeds TICKs to the engine, runs bot decision cycles
// between ticks, answers bot-side RTM stages after a beat of suspense, and
// advances past sold/unsold interstitials. The engine itself owns no timers.

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import { botAction, botRtmMatch, botRtmRaise, botRtmUseCard } from "../engine/bots";
import { shuffle, seedRng, type Rng } from "../engine/rng";

const TICK_MS = 1000;
const SKIP_TICK_MS = 130; // fast-forward when the human skips a lot
const BOT_CYCLE_MS = 420;
const SKIP_BOT_CYCLE_MS = 70;
/** One bid per cycle — the original, deliberately restored (D-042). Bursts
 *  were quicker but flattened the back-and-forth of a war. */
const MAX_BIDS_PER_CYCLE = 1;
const RTM_SUSPENSE_MS = 1100;
const SOLD_BANNER_MS = 1900;
const UNSOLD_BANNER_MS = 1100;

export function useAuctionDriver() {
  const phase = useGameStore((s) => s.auction.phase);
  const rngRef = useRef<Rng>(seedRng(Date.now() >>> 0));

  // Clock + bot bidding while a lot is open.
  const skipping = useGameStore((s) => s.skipping);
  useEffect(() => {
    if (phase !== "bidding") return;
    // Skipping doesn't change the auction — only how fast we feed it time,
    // so bots still fight it out, just at speed.
    const tick = setInterval(() => {
      useGameStore.getState().dispatch({ type: "TICK" });
    }, skipping ? SKIP_TICK_MS : TICK_MS);
    const bots = setInterval(() => {
      const { auction, dispatch } = useGameStore.getState();
      if (auction.phase !== "bidding") return;
      let order;
      [order, rngRef.current] = shuffle(auction.franchises, rngRef.current);
      let placed = 0;
      for (const f of order) {
        if (f.isHuman || placed >= MAX_BIDS_PER_CYCLE) continue;
        // Re-read: each dispatch changes the price the next bot is judging.
        const current = useGameStore.getState().auction;
        if (current.phase !== "bidding") break;
        let move;
        [move, rngRef.current] = botAction(current, f.id, rngRef.current);
        if (move === "bid") {
          dispatch({ type: "BID", franchiseId: f.id });
          placed++;
        }
      }
    }, skipping ? SKIP_BOT_CYCLE_MS : BOT_CYCLE_MS);
    return () => {
      clearInterval(tick);
      clearInterval(bots);
    };
  }, [phase, skipping]);

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
    const { skipping: fast, setSkipping } = useGameStore.getState();
    const t = setTimeout(
      () => {
        setSkipping(false); // the skip ends with the lot
        useGameStore.getState().dispatch({ type: "NEXT_PLAYER" });
      },
      fast ? 450 : phase === "sold" ? SOLD_BANNER_MS : UNSOLD_BANNER_MS,
    );
    return () => clearTimeout(t);
  }, [phase]);
}
