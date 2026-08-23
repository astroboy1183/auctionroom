// Phase-driven screen switch. A ?room=CODE in the URL (or a room joined from
// the lobby) hands control to the multiplayer client; otherwise this is the
// solo game running entirely in the browser.

import { useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import Lobby from "./screens/Lobby";
import AuctionFloor from "./screens/AuctionFloor";
import Results from "./screens/Results";
import MultiplayerGame from "./screens/MultiplayerGame";

export default function App() {
  const phase = useGameStore((s) => s.auction.phase);
  const roomCode = useGameStore((s) => s.roomCode);
  const playerName = useGameStore((s) => s.playerName);
  const setRoom = useGameStore((s) => s.setRoom);
  const spectate = new URLSearchParams(location.search).get("spectate") === "1";

  // Deep link: /?room=ABC123 drops you straight into that room.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code) {
      const stored = sessionStorage.getItem("auctionroom:name") ?? "";
      setRoom(code.toUpperCase(), stored || "Player");
    }
  }, [setRoom]);

  if (roomCode) {
    return (
      <MultiplayerGame
        roomCode={roomCode}
        name={playerName || "Player"}
        spectate={spectate}
        onLeave={() => {
          setRoom(null);
          history.replaceState(null, "", location.pathname);
          useGameStore.getState().reset();
        }}
      />
    );
  }

  if (phase === "lobby") return <Lobby />;
  if (phase === "finished") return <Results />;
  return <AuctionFloor />;
}
