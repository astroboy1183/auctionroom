// Watches auction transitions and gives them a voice: the crowd bed, bid
// blips (a paddle thwack when it's you), big-money swells, the final
// seconds' clock, the gavel, and the auctioneer calling the room.

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import {
  blip, clockTick, crowdSwell, hammer, hushAuctioneer, moneySpeech, motif,
  paddle, speak, startCrowd, sting, stopCrowd,
} from "../lib/audio";
import type { Role } from "../engine/types";

const ROLE_WORD: Record<Role, string> = {
  BAT: "batter", BOWL: "bowler", AR: "all rounder", WK: "wicketkeeper",
};

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
      if (player.setId !== p.setId && !auction.accelerated) {
        motif();
        const set = auction.sets.find((s) => s.id === player.setId);
        if (set) {
          speak(`We move to the ${set.name} set. First up, ${player.name}, ${ROLE_WORD[player.role]}, base price ${moneySpeech(player.basePrice)}.`);
          return;
        }
      }
      speak(`Next up. ${player.name}. ${ROLE_WORD[player.role]}. Base price ${moneySpeech(player.basePrice)}.`);
      return;
    }

    // Bids land: your paddle thwacks, rivals blip; big money moves the room.
    if (auction.currentBid !== null && auction.currentBid !== p.bid) {
      if (auction.currentBidderId === humanId) paddle();
      else blip();
      const before = Math.floor((p.bid ?? 0) / 1000);
      const after = Math.floor(auction.currentBid / 1000);
      if (after > before) {
        crowdSwell(Math.min(1, after / 4));
        if (after >= 2) speak(`${moneySpeech(auction.currentBid)}!`, false);
      }
    }

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
        crowdSwell(0.7);
        const winner = auction.franchises.find((f) => f.id === auction.currentBidderId);
        if (winner && auction.currentBid !== null) {
          speak(`Sold! To the ${winner.name}, for ${moneySpeech(auction.currentBid)}.`);
        }
      } else if (auction.phase === "unsold" && player) {
        speak(`No takers. ${player.name} goes unsold.`);
      } else if (auction.phase === "rtm") {
        sting();
        speak("Right to match!");
      } else if (auction.phase === "finished") {
        hushAuctioneer();
      }
    }
  }, [auction, soundOn, humanId]);
}
