// Online play. The room DO owns the auction; this screen mirrors it and
// forwards the local player's intents. It reuses the solo AuctionFloor by
// pushing server state into the same store the solo game reads from.

import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { useRoom } from "../hooks/useRoom";
import RoomLobby from "./RoomLobby";
import AuctionFloor from "./AuctionFloor";
import Results from "./Results";
import RoomChat from "../components/RoomChat";
import CommentaryBar from "../components/CommentaryBar";

interface Props {
  roomCode: string;
  name: string;
  spectate?: boolean;
  onLeave: () => void;
}

export default function MultiplayerGame({ roomCode, name, spectate, onLeave }: Props) {
  const room = useRoom(roomCode, name, spectate);

  // Mirror authoritative state into the store so every existing component
  // (rail, HUD, hall, results) works unchanged.
  useEffect(() => {
    if (!room.auction) return;
    useGameStore.setState({ auction: room.auction });
  }, [room.auction]);

  useEffect(() => {
    // Spectators ride along on the first seat's view; they simply can't act.
    const view = room.franchiseId ?? room.auction?.franchises[0]?.id;
    if (view) useGameStore.setState({ humanId: view });
  }, [room.franchiseId, room.auction]);

  // Intents go to the server instead of the local reducer.
  useEffect(() => {
    const original = useGameStore.getState().dispatch;
    useGameStore.setState({
      dispatch: (event) => {
        switch (event.type) {
          case "BID": room.send({ type: "bid" }); break;
          case "PASS": room.send({ type: "pass" }); break;
          case "RTM_OFFER_RESPONSE": room.send({ type: "rtm_offer", useCard: event.useCard }); break;
          case "RTM_RAISE": room.send({ type: "rtm_raise", raise: event.raise }); break;
          case "RTM_DECIDE": room.send({ type: "rtm_decide", match: event.match }); break;
          default: break; // TICK / NEXT_PLAYER are the server's business
        }
      },
    });
    return () => useGameStore.setState({ dispatch: original });
  }, [room]);

  if (room.status === "error" || room.error) {
    return (
      <Centered>
        <p className="text-lg font-bold text-red-400">{room.error ?? "Could not reach the room."}</p>
        <button onClick={onLeave} className="mt-4 rounded bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700">
          Back
        </button>
      </Centered>
    );
  }

  if (!room.auction) {
    return (
      <Centered>
        <p className="animate-pulse text-slate-400">
          {room.status === "connecting" ? "Joining room…" : "Reconnecting…"}
        </p>
      </Centered>
    );
  }

  if (room.auction.phase === "lobby") {
    return (
      <RoomLobby
        roomCode={roomCode}
        seats={room.seats}
        auction={room.auction}
        franchiseId={room.franchiseId}
        isHost={room.isHost}
        settings={room.settings}
        onSettings={(settings) => room.send({ type: "settings", settings })}
        onStart={() => room.send({ type: "start" })}
        onLeave={onLeave}
      />
    );
  }

  return (
    <>
      {room.status !== "open" && (
        <div className="fixed inset-x-0 top-0 z-50 bg-red-900/90 py-1 text-center text-xs font-bold">
          Connection lost — reconnecting. The auction carries on without you.
        </div>
      )}
      {room.spectating && (
        <div className="fixed inset-x-0 top-0 z-40 bg-slate-800/90 py-1 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
          👁 Spectating — you can chat, but not bid
        </div>
      )}
      {room.auction.phase === "finished" ? <Results /> : <AuctionFloor />}

      <div className="pointer-events-none fixed inset-x-0 top-14 z-30 px-3">
        <CommentaryBar commentary={room.commentary} />
      </div>

      <div className="fixed bottom-3 left-3 z-40 sm:bottom-auto sm:left-auto sm:right-3 sm:top-[22rem]">
        <RoomChat
          chat={room.chat}
          reactions={room.reactions}
          franchises={room.auction.franchises}
          onSend={(text) => room.send({ type: "chat", text })}
          onReact={(emoji) => room.send({ type: "react", emoji })}
        />
      </div>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
      {children}
    </div>
  );
}
