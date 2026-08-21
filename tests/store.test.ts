import { describe, it, expect } from "vitest";
import { useGameStore } from "../src/store/gameStore";

describe("game store wiring", () => {
  it("startGame moves lobby → bidding with bots attached and RTM lists dealt", () => {
    const s = useGameStore.getState();
    s.startGame("del", "hard");
    const a = useGameStore.getState().auction;
    expect(a.phase).toBe("bidding");
    expect(a.currentPlayer).not.toBeNull();
    expect(a.pool).toHaveLength(100);
    const human = a.franchises.find((f) => f.id === "del")!;
    expect(human.isHuman).toBe(true);
    expect(human.botPersonality).toBeUndefined();
    const bots = a.franchises.filter((f) => !f.isHuman);
    expect(bots).toHaveLength(3);
    for (const b of bots) expect(b.botPersonality).toBeDefined();
    for (const f of a.franchises) expect(f.formerPlayerIds).toHaveLength(4);
  });

  it("dispatch routes through the reducer (human bid leads the lot)", () => {
    useGameStore.getState().startGame("hyd", "normal");
    useGameStore.getState().dispatch({ type: "BID", franchiseId: "hyd" });
    const a = useGameStore.getState().auction;
    expect(a.currentBidderId).toBe("hyd");
    expect(a.currentBid).toBe(a.currentPlayer!.basePrice);
    useGameStore.getState().reset();
    expect(useGameStore.getState().auction.phase).toBe("lobby");
  });
});
