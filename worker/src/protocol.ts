// Wire protocol shared by the room Durable Object and the browser client.

import type { AuctionState } from "../../src/engine/types";

export interface Seat {
  franchiseId: string;
  name: string;          // display name of the human, or the bot personality
  isHuman: boolean;
  connected: boolean;
}

export type ClientMessage =
  | { type: "join"; name: string; token?: string }
  | { type: "start" }
  | { type: "bid" }
  | { type: "pass" }
  | { type: "rtm_offer"; useCard: boolean }
  | { type: "rtm_raise"; raise: boolean }
  | { type: "rtm_decide"; match: boolean };

export type ServerMessage =
  | { type: "welcome"; token: string; franchiseId: string; roomCode: string; isHost: boolean }
  | { type: "state"; auction: AuctionState; seats: Seat[]; hostId: string | null }
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
