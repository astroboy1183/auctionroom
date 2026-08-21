// Phase-driven screen switch: lobby → auction floor → results.

import { useGameStore } from "./store/gameStore";
import Lobby from "./screens/Lobby";
import AuctionFloor from "./screens/AuctionFloor";
import Results from "./screens/Results";

export default function App() {
  const phase = useGameStore((s) => s.auction.phase);
  if (phase === "lobby") return <Lobby />;
  if (phase === "finished") return <Results />;
  return <AuctionFloor />;
}
