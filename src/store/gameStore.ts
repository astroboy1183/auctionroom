// Zustand store: holds AuctionState and funnels every change through the
// pure engine reducer. React never mutates auction state directly.

import { create } from "zustand";
import type { AuctionEvent, AuctionState, Franchise, Player } from "../engine/types";
import { applyEvent } from "../engine/auction";
import { createInitialState } from "../engine/simulate";
import { makeDefaultFranchises } from "../engine/franchises";
import { attachBotPersonalities } from "../engine/bots";
import { assignFormerPlayers } from "../engine/rtm";
import { applyRetentions, auctionPool } from "../engine/retentions";
import playersJson from "../data/players.json";

const allPlayers = playersJson as Player[];
/** Only the 100 auction lots ever reach the engine; retained players are
 * handed straight to the franchises. */
const players = auctionPool(allPlayers);

export type Difficulty = "easy" | "normal" | "hard";
const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.7, normal: 1.0, hard: 1.3 };

interface GameStore {
  auction: AuctionState;
  humanId: string;
  difficulty: Difficulty;
  soundOn: boolean;
  view3d: boolean;
  skipping: boolean;
  /** Set when a rival takes the lead away from the human; drives the alert. */
  outbid: { by: string; color: string; at: number } | null;
  /** Pre-auction plan: playerId → the most you intend to pay, in lakhs. */
  shortlist: Record<string, number>;
  /** Fixed for the session so the lobby can show real retentions, and the
   *  squad you picked is the squad you get. */
  lobbySeed: number;
  /** Franchises with retentions applied — what the lobby previews. */
  preview: Franchise[];
  /** Set while playing an online room; null in solo play. */
  roomCode: string | null;
  playerName: string;
  dispatch: (event: AuctionEvent) => void;
  startGame: (humanId: string, difficulty: Difficulty) => void;
  toggleSound: () => void;
  toggleView3d: () => void;
  setSkipping: (v: boolean) => void;
  flagOutbid: (by: string, color: string) => void;
  clearOutbid: () => void;
  setTarget: (playerId: string, maxBid: number) => void;
  removeTarget: (playerId: string) => void;
  clearShortlist: () => void;
  setRoom: (code: string | null, name?: string) => void;
  reset: () => void;
}

const fresh = () => createInitialState(players, makeDefaultFranchises());

// One seed per page load: the lobby previews these retentions and the auction
// then uses the same ones, so what you picked is what you get.
const LOBBY_SEED = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

export const useGameStore = create<GameStore>((set, get) => ({
  auction: fresh(),
  humanId: "hyd",
  difficulty: "normal",
  soundOn: true,
  view3d: true,
  skipping: false,
  outbid: null,
  shortlist: {},
  lobbySeed: LOBBY_SEED,
  roomCode: null,
  playerName: "",
  preview: applyRetentions(makeDefaultFranchises(), allPlayers, LOBBY_SEED + 3),
  dispatch: (event) => set((s) => ({ auction: applyEvent(s.auction, event) })),
  startGame: (humanId, difficulty) =>
    set(() => {
      // UI-side seeding is allowed to use the clock; the engine only ever
      // sees the resulting number (CLAUDE.md §4). Retentions reuse the lobby
      // seed so the previewed squads are the ones actually dealt.
      const { lobbySeed } = get();
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      let franchises = makeDefaultFranchises(humanId);
      franchises = applyRetentions(franchises, allPlayers, lobbySeed + 3);
      franchises = attachBotPersonalities(franchises, DIFFICULTY_MULT[difficulty], seed + 2);
      franchises = assignFormerPlayers(franchises, players, seed + 1);
      const lobby = createInitialState(players, franchises);
      return { humanId, difficulty, skipping: false, outbid: null, auction: applyEvent(lobby, { type: "START", seed }) };
    }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleView3d: () => set((s) => ({ view3d: !s.view3d })),
  setSkipping: (v) => set({ skipping: v }),
  flagOutbid: (by, color) => set({ outbid: { by, color, at: Date.now() } }),
  clearOutbid: () => set({ outbid: null }),
  setTarget: (playerId, maxBid) =>
    set((s) => ({ shortlist: { ...s.shortlist, [playerId]: maxBid } })),
  removeTarget: (playerId) =>
    set((s) => {
      const next = { ...s.shortlist };
      delete next[playerId];
      return { shortlist: next };
    }),
  clearShortlist: () => set({ shortlist: {} }),
  setRoom: (code, name) => set((s) => ({ roomCode: code, playerName: name ?? s.playerName })),
  // Must clear transient per-lot UI state too, or "Play again" can start the
  // next auction still in fast-forward.
  reset: () => set({ auction: fresh(), skipping: false, outbid: null }),
}));
