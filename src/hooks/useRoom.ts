// Multiplayer client: one WebSocket to the room's Durable Object. The server
// is the only authority — we send intents and render whatever state arrives,
// so this hook deliberately holds no game logic.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuctionState } from "../engine/types";
import type { ChatEntry, ClientMessage, ReactionEvent, Seat, ServerMessage } from "../../worker/src/protocol";

const WORKER_URL = import.meta.env.VITE_ROOMS_URL ?? "https://auctionroom-rooms.jayanthapalla.workers.dev";

export type RoomStatus = "connecting" | "open" | "closed" | "error";

export interface RoomConnection {
  status: RoomStatus;
  auction: AuctionState | null;
  seats: Seat[];
  franchiseId: string | null;
  isHost: boolean;
  spectating: boolean;
  spectators: number;
  chat: ChatEntry[];
  reactions: ReactionEvent[];
  /** Latest line from the LLM commentator, or null when unavailable. */
  commentary: { text: string; at: number } | null;
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

export function useRoom(code: string | null, name: string, spectate = false): RoomConnection {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [spectating, setSpectating] = useState(false);
  const [spectators, setSpectators] = useState(0);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [commentary, setCommentary] = useState<{ text: string; at: number } | null>(null);
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
      ws.send(JSON.stringify({ type: "join", name, token, spectate } satisfies ClientMessage));
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        if (msg.token) sessionStorage.setItem(tokenKey(code), msg.token);
        setFranchiseId(msg.franchiseId);
        setIsHost(msg.isHost);
        setSpectating(msg.spectating);
      } else if (msg.type === "state") {
        setAuction(msg.auction);
        setSeats(msg.seats);
        setSpectators(msg.spectators);
      } else if (msg.type === "chat_history") {
        setChat(msg.entries);
      } else if (msg.type === "chat") {
        setChat((c) => [...c, msg.entry].slice(-60));
      } else if (msg.type === "react") {
        // Reactions are transient: they float up and expire.
        setReactions((r) => [...r, msg.event].slice(-12));
        setTimeout(() => setReactions((r) => r.filter((x) => x !== msg.event)), 2600);
      } else if (msg.type === "commentary") {
        setCommentary({ text: msg.text, at: msg.at });
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
  }, [code, name, spectate]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return {
    status, auction, seats, franchiseId, isHost, spectating, spectators,
    chat, reactions, commentary, error, send,
  };
}
