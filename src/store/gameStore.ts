// Zustand store: holds AuctionState and funnels every change through the
// pure engine reducer. React never mutates auction state directly.

import { create } from "zustand";
import type { AuctionEvent, AuctionState } from "../engine/types";
import { applyEvent } from "../engine/auction";
import { createInitialState } from "../engine/simulate";
import { makeDefaultFranchises } from "../engine/franchises";
import playersJson from "../data/players.json";
import type { Player } from "../engine/types";

const players = playersJson as Player[];

interface GameStore {
  auction: AuctionState;
  dispatch: (event: AuctionEvent) => void;
  reset: () => void;
}

const fresh = () => createInitialState(players, makeDefaultFranchises());

export const useGameStore = create<GameStore>((set) => ({
  auction: fresh(),
  dispatch: (event) => set((s) => ({ auction: applyEvent(s.auction, event) })),
  reset: () => set({ auction: fresh() }),
}));
