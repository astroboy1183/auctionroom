// Bid increment ladder — CLAUDE.md §5.
// below 100L → +10L; 100–499L → +25L; 500L and above → +50L.

export function nextIncrement(currentBid: number): number {
  if (currentBid < 100) return 10;
  if (currentBid < 500) return 25;
  return 50;
}

/** The amount the next bid would be: base price opens, then the ladder. */
export function nextBidAmount(currentBid: number | null, basePrice: number): number {
  return currentBid === null ? basePrice : currentBid + nextIncrement(currentBid);
}
