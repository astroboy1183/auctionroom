// The eight franchises. Fictional names only — never real IPL branding.

import type { Franchise } from "./types";
import { RTM_CARDS_START } from "./rtm";

export const START_BUDGET = 12000; // ₹120 Cr in lakhs

function franchise(id: string, name: string, color: string, isHuman: boolean): Franchise {
  return {
    id,
    name,
    color,
    budget: START_BUDGET,
    squad: [],
    isHuman,
    rtmCards: RTM_CARDS_START,
    formerPlayerIds: [],
  };
}

const ROSTER: [string, string, string][] = [
  ["hyd", "Hyderabad Hawks",    "#f59e0b"],
  ["mum", "Mumbai Mavericks",   "#3b82f6"],
  ["del", "Delhi Dynamos",      "#ef4444"],
  ["che", "Chennai Chargers",   "#10b981"],
  ["ben", "Bengaluru Blasters", "#ec4899"],
  ["kol", "Kolkata Krakens",    "#7c3aed"],
  ["pun", "Punjab Panthers",    "#14b8a6"],
  ["jai", "Jaipur Jaguars",     "#06b6d4"],
];

export function makeDefaultFranchises(humanId: string = "hyd"): Franchise[] {
  return ROSTER.map(([id, name, color]) => franchise(id, name, color, id === humanId));
}
