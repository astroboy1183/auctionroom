// Watches auction transitions and gives them a voice: the crowd bed, bid
// tones, the closing clock, the gavel, an auctioneer who works the room —
// and eight franchise voices calling their own bids from the benches.

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import {
  blip, clockTick, crowdSwell, hammer, hushAuctioneer, moneySpeech, motif,
  paddle, speak, speakTeam, startCrowd, sting, stopCrowd, teamVoice,
} from "../lib/audio";
import type { Role } from "../engine/types";

const ROLE_WORD: Record<Role, string> = {
  BAT: "batter", BOWL: "bowler", AR: "all rounder", WK: "wicketkeeper",
};

/** Short things a franchise shouts when it puts a bid in. */
const TEAM_CALLS = [
  (m: string) => m,
  (m: string) => `${m}!`,
  () => "We're in.",
  () => "Ours.",
  () => "Bid.",
  (m: string) => `We'll go ${m}.`,
  () => "Still here.",
  () => "Yes.",
];

/** Host colour commentary, used sparingly between the essential calls. */
const HOST_LINES = [
  "The bidding is lively here.",
  "Somebody wants him badly.",
  "That is serious money.",
  "The purse strings are loosening.",
  "A real tussle developing.",
];

export function useSoundEffects() {
  const auction = useGameStore((s) => s.auction);
  const soundOn = useGameStore((s) => s.soundOn);
  const humanId = useGameStore((s) => s.humanId);
  const prev = useRef({
    playerId: auction.currentPlayer?.id,
    setId: auction.currentPlayer?.setId,
    bid: auction.currentBid,
    phase: auction.phase,
    timer: auction.timer,
  });
  const lastHostAside = useRef(0);

  // The crowd murmurs while the auction lives, and files out at the end.
  useEffect(() => {
    const active = soundOn && auction.phase !== "lobby" && auction.phase !== "finished";
    if (active) startCrowd();
    else stopCrowd();
    return stopCrowd;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn, auction.phase === "lobby" || auction.phase === "finished"]);

  useEffect(() => {
    const p = prev.current;
    const player = auction.currentPlayer;
    prev.current = {
      playerId: player?.id,
      setId: player?.setId,
      bid: auction.currentBid,
      phase: auction.phase,
      timer: auction.timer,
    };
    if (!soundOn) return;

    // A new man on the block — and a motif when a whole new set opens.
    if (auction.phase === "bidding" && player && player.id !== p.playerId) {
      const stars = player.rating >= 92 ? "A marquee name. " : "";
      if (player.setId !== p.setId && !auction.accelerated) {
        motif();
        const set = auction.sets.find((s) => s.id === player.setId);
        if (set) {
          speak(`We move to the ${set.name} set. First up, ${player.name}, ${ROLE_WORD[player.role]}. Base price ${moneySpeech(player.basePrice)}. Who will start me?`);
          return;
        }
      }
      speak(`${stars}Next up, ${player.name}, ${ROLE_WORD[player.role]}. Base price ${moneySpeech(player.basePrice)}.`);
      return;
    }

    // Bids land: your paddle rings out, rivals knock; the tone climbs with
    // the money so a long war audibly escalates.
    if (auction.currentBid !== null && auction.currentBid !== p.bid) {
      const rung = auction.bidHistory.filter((b) => b.playerId === player?.id).length;
      const bidderIdx = auction.franchises.findIndex((f) => f.id === auction.currentBidderId);
      const bidder = auction.franchises[bidderIdx];
      if (auction.currentBidderId === humanId) paddle();
      else blip(rung);

      // The bench calls its own number — rate-limited inside speakTeam.
      if (bidder && !bidder.isHuman) {
        const call = TEAM_CALLS[(bidderIdx + rung) % TEAM_CALLS.length];
        speakTeam(call(moneySpeech(auction.currentBid)), teamVoice(bidderIdx));
      }

      const before = Math.floor((p.bid ?? 0) / 1000);
      const after = Math.floor(auction.currentBid / 1000);
      if (after > before) {
        crowdSwell(Math.min(1, after / 4));
        if (after >= 2) speak(`${moneySpeech(auction.currentBid)}!`, false);
      } else if (rung >= 5 && Date.now() - lastHostAside.current > 9000) {
        // the host works the room during a long war
        lastHostAside.current = Date.now();
        speak(HOST_LINES[rung % HOST_LINES.length], false);
      }
    }

    // The clock tightens at the death.
    if (auction.phase === "bidding" && auction.timer !== p.timer && auction.currentBid !== null) {
      if (auction.timer === 2) speak("Going once…");
      else if (auction.timer === 1) speak("Going twice…");
      if (auction.timer <= 3 && auction.timer >= 0) clockTick(3 - auction.timer);
    }

    // Phase moments.
    if (auction.phase !== p.phase) {
      if (auction.phase === "sold") {
        hammer();
        crowdSwell(0.7);
        const idx = auction.franchises.findIndex((f) => f.id === auction.currentBidderId);
        const winner = auction.franchises[idx];
        if (winner && auction.currentBid !== null) {
          speak(`Sold! To the ${winner.name}, for ${moneySpeech(auction.currentBid)}.`);
          if (!winner.isHuman) {
            setTimeout(() => speakTeam("Got him!", teamVoice(idx), 0), 1500);
          }
        }
      } else if (auction.phase === "unsold" && player) {
        speak(`No takers. ${player.name} goes unsold.`);
      } else if (auction.phase === "rtm") {
        sting();
        const idx = auction.franchises.findIndex((f) => f.id === auction.rtmOffer?.formerFranchiseId);
        const former = auction.franchises[idx];
        speak(`Right to match! ${former ? former.name : "A franchise"} may bring him home.`);
        if (former && !former.isHuman) {
          setTimeout(() => speakTeam("He's one of ours.", teamVoice(idx), 0), 2200);
        }
      } else if (auction.phase === "finished") {
        hushAuctioneer();
      }
    }
  }, [auction, soundOn, humanId]);
}
