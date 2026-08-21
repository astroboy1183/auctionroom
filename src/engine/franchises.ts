// Default franchises. Fictional names only — never real IPL branding.

import type { Franchise } from "./types";
import { RTM_CARDS_START } from "./rtm";

export const START_BUDGET = 9000; // ₹90 Cr in lakhs

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

export function makeDefaultFranchises(humanId: string = "hyd"): Franchise[] {
  return [
    franchise("hyd", "Hyderabad Hawks", "#f59e0b", humanId === "hyd"),
    franchise("mum", "Mumbai Mavericks", "#3b82f6", humanId === "mum"),
    franchise("del", "Delhi Dynamos", "#ef4444", humanId === "del"),
    franchise("che", "Chennai Chargers", "#10b981", humanId === "che"),
  ];
}
