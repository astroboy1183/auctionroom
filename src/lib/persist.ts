// Save / resume. AuctionState is a plain serialisable object, so this is a
// stringify — no special casing beyond a version stamp so an old save from a
// previous build is discarded rather than crashing the game.

import type { AuctionState } from "../engine/types";

const KEY = "auctionroom:save:v3";

export interface SavedGame {
  version: 3;
  savedAt: number;
  auction: AuctionState;
  humanId: string;
  shortlist: Record<string, number>;
}

export function saveGame(save: Omit<SavedGame, "version" | "savedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...save, version: 3, savedAt: Date.now() }));
  } catch {
    /* quota or private mode — saving is a convenience, never a requirement */
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGame;
    if (parsed.version !== 3 || !parsed.auction) return null;
    if (parsed.auction.phase === "lobby" || parsed.auction.phase === "finished") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
