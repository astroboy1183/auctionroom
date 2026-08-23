// Post-auction talking points, all derived from bidHistory — the stuff people
// actually argue about afterwards.

import type { AuctionState, Bid, Franchise, Player } from "./types";
import { ratingValue } from "./bots";

export interface Highlight {
  player: Player;
  franchise: Franchise;
  price: number;
  /** price ÷ a neutral market value; <1 is a bargain, >1 an overpay. */
  ratio: number;
}

export interface Contested {
  player: Player;
  bids: number;
  price: number;
}

export interface Analytics {
  steal: Highlight | null;
  overpay: Highlight | null;
  mostContested: Contested | null;
  biggestSale: Highlight | null;
  totalSpend: number;
  soldCount: number;
  unsoldCount: number;
  fastestSpender: { franchise: Franchise; spent: number } | null;
}

function finalPriceFor(history: Bid[], playerId: string): number | null {
  const bids = history.filter((b) => b.playerId === playerId);
  return bids.length ? bids[bids.length - 1].amount : null;
}

export function analyse(state: AuctionState, startBudget: number): Analytics {
  const sold: Highlight[] = [];
  for (const f of state.franchises) {
    for (const p of f.squad) {
      // Retained players were never auctioned — they have no price to judge.
      if (f.retained.includes(p.id)) continue;
      const price = finalPriceFor(state.bidHistory, p.id);
      if (price === null) continue;
      sold.push({ player: p, franchise: f, price, ratio: price / Math.max(30, ratingValue(p.rating)) });
    }
  }

  const byRatio = [...sold].sort((a, b) => a.ratio - b.ratio);
  const byPrice = [...sold].sort((a, b) => b.price - a.price);

  const counts = new Map<string, number>();
  for (const b of state.bidHistory) counts.set(b.playerId, (counts.get(b.playerId) ?? 0) + 1);
  let mostContested: Contested | null = null;
  for (const [playerId, bids] of counts) {
    const hit = sold.find((s) => s.player.id === playerId);
    if (!hit) continue;
    if (!mostContested || bids > mostContested.bids) {
      mostContested = { player: hit.player, bids, price: hit.price };
    }
  }

  const spends = state.franchises
    .map((f) => ({ franchise: f, spent: startBudget - f.budget }))
    .sort((a, b) => b.spent - a.spent);

  return {
    steal: byRatio[0] ?? null,
    overpay: byRatio[byRatio.length - 1] ?? null,
    mostContested,
    biggestSale: byPrice[0] ?? null,
    totalSpend: spends.reduce((n, s) => n + s.spent, 0),
    soldCount: sold.length,
    unsoldCount: state.unsold.length,
    fastestSpender: spends[0] ?? null,
  };
}
