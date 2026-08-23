// Wire protocol shared by the room Durable Object and the browser client.

import type { AuctionState } from "../../src/engine/types";

export interface RoomSettings {
  difficulty: "easy" | "normal" | "hard";
  /** Seconds on each lot. Humans need longer than bots. */
  lotSeconds: number;
}

export const DEFAULT_SETTINGS: RoomSettings = { difficulty: "normal", lotSeconds: 10 };

export interface LeaderboardEntry {
  name: string;
  franchise: string;
  points: number;
  won: number;
  squadStrength: number;
  at: number;
}

export interface Seat {
  franchiseId: string;
  name: string;          // display name of the human, or the bot personality
  isHuman: boolean;
  connected: boolean;
}

export interface ChatEntry {
  id: string;
  franchiseId: string | null;   // null = a spectator
  name: string;
  text: string;
  at: number;
}

export interface ReactionEvent {
  franchiseId: string | null;
  emoji: string;
  at: number;
}

export const REACTIONS = ["🔥", "😱", "😂", "👏", "💸", "🤝"] as const;

export type ClientMessage =
  | { type: "join"; name: string; token?: string; spectate?: boolean }
  | { type: "chat"; text: string }
  | { type: "react"; emoji: string }
  | { type: "start" }
  | { type: "settings"; settings: Partial<RoomSettings> }
  | { type: "bid" }
  | { type: "pass" }
  | { type: "rtm_offer"; useCard: boolean }
  | { type: "rtm_raise"; raise: boolean }
  | { type: "rtm_decide"; match: boolean };

export type ServerMessage =
  | { type: "welcome"; token: string; franchiseId: string | null; roomCode: string; isHost: boolean; spectating: boolean }
  | {
      type: "state";
      auction: AuctionState;
      seats: Seat[];
      hostId: string | null;
      spectators: number;
      settings: RoomSettings;
    }
  | { type: "leaderboard"; entries: LeaderboardEntry[] }
  | { type: "chat"; entry: ChatEntry }
  | { type: "chat_history"; entries: ChatEntry[] }
  | { type: "react"; event: ReactionEvent }
  | { type: "commentary"; text: string; at: number }
  | { type: "error"; message: string };

/** Unambiguous room codes — no O/0/I/1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(random: () => number): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}
