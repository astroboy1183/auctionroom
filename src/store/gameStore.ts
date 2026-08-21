// Zustand store holding AuctionState. Phase 0: initial state only; the
// engine reducer (Phase 1) will drive all transitions via applyEvent.

import { create } from "zustand";
import type { AuctionState, Franchise } from "../engine/types";
import { SETS } from "../engine/sets";

const START_BUDGET = 9000; // ₹90 Cr in lakhs
const START_RTM_CARDS = 2;

export const DEFAULT_FRANCHISES: Franchise[] = [
  { id: "hyd", name: "Hyderabad Hawks",  color: "#f59e0b", budget: START_BUDGET, squad: [], isHuman: true,  rtmCards: START_RTM_CARDS, formerPlayerIds: [] },
  { id: "mum", name: "Mumbai Mavericks", color: "#3b82f6", budget: START_BUDGET, squad: [], isHuman: false, rtmCards: START_RTM_CARDS, formerPlayerIds: [] },
  { id: "del", name: "Delhi Dynamos",    color: "#ef4444", budget: START_BUDGET, squad: [], isHuman: false, rtmCards: START_RTM_CARDS, formerPlayerIds: [] },
  { id: "che", name: "Chennai Chargers", color: "#eab308", budget: START_BUDGET, squad: [], isHuman: false, rtmCards: START_RTM_CARDS, formerPlayerIds: [] },
];

export const initialAuctionState: AuctionState = {
  phase: "lobby",
  sets: SETS,
  pool: [],
  poolIndex: 0,
  currentPlayer: null,
  currentBid: null,
  currentBidderId: null,
  bidHistory: [],
  franchises: DEFAULT_FRANCHISES,
  timer: 10,
  rtmOffer: null,
  accelerated: false,
  rngSeed: 0,
};

interface GameStore {
  auction: AuctionState;
  setAuction: (next: AuctionState) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  auction: initialAuctionState,
  setAuction: (next) => set({ auction: next }),
}));
