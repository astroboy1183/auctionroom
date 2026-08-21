import { describe, it, expect } from "vitest";
import { nextIncrement, nextBidAmount } from "../src/engine/bids";

describe("bid increment ladder (CLAUDE.md §5)", () => {
  it("+10 below 100", () => {
    expect(nextIncrement(30)).toBe(10);
    expect(nextIncrement(90)).toBe(10);
    expect(nextIncrement(99)).toBe(10);
  });
  it("+25 from 100 to under 500", () => {
    expect(nextIncrement(100)).toBe(25);
    expect(nextIncrement(475)).toBe(25);
    expect(nextIncrement(499)).toBe(25);
  });
  it("+50 from 500, +100 from 1000, +200 from 2000", () => {
    expect(nextIncrement(500)).toBe(50);
    expect(nextIncrement(500) + 500).toBe(550);
    expect(nextIncrement(999)).toBe(50);
    expect(nextIncrement(1000)).toBe(100);
    expect(nextIncrement(1900)).toBe(100);
    expect(nextIncrement(2000)).toBe(200);
    expect(nextIncrement(3600)).toBe(200);
  });
  it("first bid opens at base price, later bids climb the ladder", () => {
    expect(nextBidAmount(null, 200)).toBe(200);
    expect(nextBidAmount(90, 30)).toBe(100);
    expect(nextBidAmount(100, 30)).toBe(125);
  });
});
