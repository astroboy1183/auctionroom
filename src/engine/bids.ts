// Bid increment ladder — CLAUDE.md §5. Upper rungs keep big-money wars
// moving now that 8 franchises carry ₹120 Cr each.
// <100 → +10 · <500 → +25 · <1000 → +50 · <2000 → +100 · ≥2000 → +200

export function nextIncrement(currentBid: number): number {
  if (currentBid < 100) return 10;
  if (currentBid < 500) return 25;
  if (currentBid < 1000) return 50;
  if (currentBid < 2000) return 100;
  return 200;
}

/** The amount the next bid would be: base price opens, then the ladder. */
export function nextBidAmount(currentBid: number | null, basePrice: number): number {
  return currentBid === null ? basePrice : currentBid + nextIncrement(currentBid);
}
