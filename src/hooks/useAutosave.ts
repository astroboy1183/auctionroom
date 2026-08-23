// Autosave the solo game between lots, so a closed tab isn't a lost auction.
// Saving on lot boundaries rather than every tick keeps writes rare and means
// a resumed game always starts cleanly on a fresh player.

import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { clearSave, saveGame } from "../lib/persist";

export function useAutosave(enabled: boolean) {
  const phase = useGameStore((s) => s.auction.phase);
  const poolIndex = useGameStore((s) => s.auction.poolIndex);

  useEffect(() => {
    if (!enabled) return;
    if (phase === "finished") {
      clearSave();
      return;
    }
    if (phase !== "bidding") return;
    const { auction, humanId, shortlist } = useGameStore.getState();
    saveGame({ auction, humanId, shortlist });
  }, [enabled, phase, poolIndex]);
}
