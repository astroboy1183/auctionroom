// Auction set definitions — CLAUDE.md §7. Order is fixed; players shuffle
// within a set (seeded — Phase 1). Counts below must match players.json,
// enforced by tests/data.test.ts.

import type { AuctionSet } from "./types";

export const SETS: AuctionSet[] = [
  { id: "S1",  name: "Marquee",          order: 1 },
  { id: "S2",  name: "Batters I",        order: 2 },
  { id: "S3",  name: "Fast Bowlers I",   order: 3 },
  { id: "S4",  name: "All-Rounders I",   order: 4 },
  { id: "S5",  name: "Wicketkeepers I",  order: 5 },
  { id: "S6",  name: "Spinners I",       order: 6 },
  { id: "S7",  name: "Batters II",       order: 7 },
  { id: "S8",  name: "Fast Bowlers II",  order: 8 },
  { id: "S9",  name: "All-Rounders II",  order: 9 },
  { id: "S10", name: "Wicketkeepers II", order: 10 },
  { id: "S11", name: "Spinners II",      order: 11 },
  { id: "S12", name: "Uncapped & Rest",  order: 12 },
];

export const SET_SIZES: Record<string, number> = {
  S1: 8, S2: 9, S3: 9, S4: 8, S5: 6, S6: 7,
  S7: 9, S8: 9, S9: 8, S10: 5, S11: 6, S12: 16,
};

export const POOL_SIZE = 100;
