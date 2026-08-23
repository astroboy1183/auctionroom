// Multiplayer client: one WebSocket to the room's Durable Object. The server
// is the only authority — we send intents and render whatever state arrives,
// so this hook deliberately holds no game logic.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuctionState } from "../engine/types";
import type { ClientMessage, Seat, ServerMessage } from "../../worker/src/protocol";

const WORKER_URL = import.meta.env.VITE_ROOMS_URL ?? "https://auctionroom-rooms.jayanthapalla.workers.dev";

export type RoomStatus = "connecting" | "open" | "closed" | "error";

export interface RoomConnection {
  status: RoomStatus;
  auction: AuctionState | null;
  seats: Seat[];
  franchiseId: string | null;
  isHost: boolean;
  error: string | null;
  send: (msg: ClientMessage) => void;
}

function tokenKey(code: string): string {
  return `auctionroom:token:${code}`;
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/room`, { method: "POST" });
  if (!res.ok) throw new Error("could not create a room");
  const { code } = (await res.json()) as { code: string };
  return code;
}

export function useRoom(code: string | null, name: string): RoomConnection {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!code) return;
    const url = `${WORKER_URL.replace(/^http/, "ws")}/api/room/${code}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("open");
      // A stored token reclaims the same franchise after a refresh or a drop.
      const token = sessionStorage.getItem(tokenKey(code)) ?? undefined;
      ws.send(JSON.stringify({ type: "join", name, token } satisfies ClientMessage));
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        sessionStorage.setItem(tokenKey(code), msg.token);
        setFranchiseId(msg.franchiseId);
        setIsHost(msg.isHost);
      } else if (msg.type === "state") {
        setAuction(msg.auction);
        setSeats(msg.seats);
      } else if (msg.type === "error") {
        setError(msg.message);
      }
    };

    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [code, name]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { status, auction, seats, franchiseId, isHost, error, send };
}
