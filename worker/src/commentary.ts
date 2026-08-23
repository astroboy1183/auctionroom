// LLM colour commentary for the auction room.
//
// Runs on Haiku 4.5: the job is short, reactive, punchy text, not reasoning,
// and it costs about ₹2 worth of tokens per full auction (D-033).
//
// Everything here is defensive by design. Commentary is a garnish — if the
// key is missing, the budget is spent, or the API is slow, the auction must
// carry on exactly as if this file did not exist.

import Anthropic from "@anthropic-ai/sdk";
import type { AuctionState, Franchise } from "../../src/engine/types";

/** Haiku 4.5 — chosen for cost and latency on short reactive text. */
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 90;
/** A slow call must never hold up the next lot. */
const TIMEOUT_MS = 4000;
/** One room can't loop forever on someone else's key. */
export const MAX_CALLS_PER_ROOM = 40;

const SYSTEM = `You are the colour commentator at a fictional cricket auction, sitting beside the auctioneer.

Rules:
- ONE sentence. Under 22 words. No preamble, no sign-off.
- React to what just happened. Never list numbers back that the viewer can already see.
- Dry, knowing, a little wry. Think a seasoned broadcaster, not a hype man.
- Refer to franchises by name. Never invent players, prices, or facts you weren't given.
- No emoji, no exclamation marks unless something genuinely absurd happened.
- If nothing is interesting, say something short about the state of the room.

Never break character or mention being an AI.`;

function money(lakhs: number): string {
  return lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2).replace(/\.00$/, "")} Cr` : `₹${lakhs}L`;
}

/** Compact board state — only what a commentator could see at a glance. */
function boardSummary(state: AuctionState): string {
  return state.franchises
    .map((f) => `${f.name}: ${money(f.budget)} left, ${f.squad.length}/12`)
    .join("; ");
}

export type Moment =
  | { kind: "sold"; player: string; buyer: Franchise; price: number; contested: number }
  | { kind: "unsold"; player: string }
  | { kind: "rtm"; player: string; former: Franchise; winner: Franchise; price: number }
  | { kind: "set"; setName: string }
  | { kind: "finished"; champion: Franchise };

function promptFor(m: Moment, state: AuctionState): string | null {
  const board = boardSummary(state);
  switch (m.kind) {
    case "sold":
      return `${m.player} just sold to ${m.buyer.name} for ${money(m.price)} after ${m.contested} bids. Board: ${board}`;
    case "unsold":
      return `${m.player} found no takers at all. Board: ${board}`;
    case "rtm":
      return `${m.former.name} used Right to Match on ${m.player} at ${money(m.price)}, snatching him from ${m.winner.name}. Board: ${board}`;
    case "set":
      return `The ${m.setName} set is about to begin. Board: ${board}`;
    case "finished":
      return `The auction is over. ${m.champion.name} assembled the strongest squad. Board: ${board}`;
    default:
      return null;
  }
}

/**
 * Only the moments worth interrupting for. Commenting on all 100 lots would
 * bury the auctioneer and burn 3x the tokens for less effect.
 */
export function isWorthComment(m: Moment): boolean {
  switch (m.kind) {
    case "sold":
      return m.price >= 800 || m.contested >= 8; // ₹8 Cr+, or a real scrap
    case "unsold":
      return false; // handled by the auctioneer already
    case "rtm":
    case "set":
    case "finished":
      return true;
  }
}

export interface CommentaryDeps {
  apiKey?: string;
  /** Calls already made in this room, for the per-room cap. */
  callsSoFar: number;
}

/**
 * Returns a line of commentary, or null for every failure mode — no key, cap
 * reached, timeout, API error, empty response. Callers should treat null as
 * "no commentary this time" and move on.
 */
export async function comment(
  m: Moment,
  state: AuctionState,
  deps: CommentaryDeps,
): Promise<string | null> {
  if (!deps.apiKey) return null;
  if (deps.callsSoFar >= MAX_CALLS_PER_ROOM) return null;
  if (!isWorthComment(m)) return null;

  const prompt = promptFor(m, state);
  if (!prompt) return null;

  try {
    const client = new Anthropic({ apiKey: deps.apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text.slice(0, 220) || null;
  } catch {
    // Commentary is never worth failing an auction over.
    return null;
  }
}
