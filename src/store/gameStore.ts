// Zustand store: holds AuctionState and funnels every change through the
// pure engine reducer. React never mutates auction state directly.

import { create } from "zustand";
import type { AuctionEvent, AuctionState, Player } from "../engine/types";
import { applyEvent } from "../engine/auction";
import { createInitialState } from "../engine/simulate";
import { makeDefaultFranchises } from "../engine/franchises";
import { attachBotPersonalities } from "../engine/bots";
import { assignFormerPlayers } from "../engine/rtm";
import playersJson from "../data/players.json";

const players = playersJson as Player[];

export type Difficulty = "easy" | "normal" | "hard";
const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.7, normal: 1.0, hard: 1.3 };

interface GameStore {
  auction: AuctionState;
  humanId: string;
  difficulty: Difficulty;
  soundOn: boolean;
  view3d: boolean;
  dispatch: (event: AuctionEvent) => void;
  startGame: (humanId: string, difficulty: Difficulty) => void;
  toggleSound: () => void;
  toggleView3d: () => void;
  reset: () => void;
}

const fresh = () => createInitialState(players, makeDefaultFranchises());

export const useGameStore = create<GameStore>((set) => ({
  auction: fresh(),
  humanId: "hyd",
  difficulty: "normal",
  soundOn: true,
  view3d: true,
  dispatch: (event) => set((s) => ({ auction: applyEvent(s.auction, event) })),
  startGame: (humanId, difficulty) =>
    set(() => {
      // UI-side seeding is allowed to use the clock; the engine only ever
      // sees the resulting number (CLAUDE.md §4).
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      let franchises = makeDefaultFranchises(humanId);
      franchises = attachBotPersonalities(franchises, DIFFICULTY_MULT[difficulty], seed + 2);
      franchises = assignFormerPlayers(franchises, players, seed + 1);
      const lobby = createInitialState(players, franchises);
      return { humanId, difficulty, auction: applyEvent(lobby, { type: "START", seed }) };
    }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleView3d: () => set((s) => ({ view3d: !s.view3d })),
  reset: () => set({ auction: fresh() }),
}));
