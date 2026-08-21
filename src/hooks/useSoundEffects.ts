// Watches auction transitions and gives them a voice: bid blips, the final
// seconds' clock, the gavel, and the auctioneer calling the room.

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import { blip, clockTick, hammer, hushAuctioneer, moneySpeech, speak } from "../lib/audio";
import type { Role } from "../engine/types";

const ROLE_WORD: Record<Role, string> = {
  BAT: "batter", BOWL: "bowler", AR: "all rounder", WK: "wicketkeeper",
};

export function useSoundEffects() {
  const auction = useGameStore((s) => s.auction);
  const soundOn = useGameStore((s) => s.soundOn);
  const prev = useRef({
    playerId: auction.currentPlayer?.id,
    bid: auction.currentBid,
    phase: auction.phase,
    timer: auction.timer,
  });

  useEffect(() => {
    const p = prev.current;
    const player = auction.currentPlayer;
    prev.current = {
      playerId: player?.id,
      bid: auction.currentBid,
      phase: auction.phase,
      timer: auction.timer,
    };
    if (!soundOn) return;

    // A new man on the block.
    if (auction.phase === "bidding" && player && player.id !== p.playerId) {
      speak(`Next up. ${player.name}. ${ROLE_WORD[player.role]}. Base price ${moneySpeech(player.basePrice)}.`);
      return;
    }

    // Bids land with a blip.
    if (auction.currentBid !== null && auction.currentBid !== p.bid) blip();

    // The clock gets loud at the death.
    if (auction.phase === "bidding" && auction.timer !== p.timer && auction.currentBid !== null) {
      if (auction.timer === 2) speak("Going once…");
      else if (auction.timer === 1) speak("Going twice…");
      if (auction.timer <= 3 && auction.timer >= 0) clockTick();
    }

    // Phase moments.
    if (auction.phase !== p.phase) {
      if (auction.phase === "sold") {
        hammer();
        const winner = auction.franchises.find((f) => f.id === auction.currentBidderId);
        if (winner && auction.currentBid !== null) {
          speak(`Sold! To the ${winner.name}, for ${moneySpeech(auction.currentBid)}.`);
        }
      } else if (auction.phase === "unsold" && player) {
        speak(`No takers. ${player.name} goes unsold.`);
      } else if (auction.phase === "rtm") {
        speak("Right to match!");
      } else if (auction.phase === "finished") {
        hushAuctioneer();
      }
    }
  }, [auction, soundOn]);
}
