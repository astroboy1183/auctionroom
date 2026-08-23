// AuctionRoom — one Durable Object per room code. The DO is the single
// authority: it runs the same pure reducer the browser runs in solo play
// (src/engine/), drives the clock from an alarm, and plays every bot seat.
// Clients only send intents and render whatever state comes back.

import { DurableObject } from "cloudflare:workers";
import { comment, isWorthComment, type Moment } from "./commentary";
import { applyEvent, ACCEL_SECONDS, LOT_SECONDS } from "../../src/engine/auction";
import { createInitialState } from "../../src/engine/simulate";
import { makeDefaultFranchises } from "../../src/engine/franchises";
import { attachBotPersonalities, botAction, botRtmMatch, botRtmRaise, botRtmUseCard } from "../../src/engine/bots";
import { assignFormerPlayers } from "../../src/engine/rtm";
import { applyRetentions, auctionPool } from "../../src/engine/retentions";
import { canBid } from "../../src/engine/rules";
import { seedRng, shuffle, type Rng } from "../../src/engine/rng";
import type { AuctionState, Player } from "../../src/engine/types";
import playersJson from "../../src/data/players.json";
import {
  isValidRoomCode, makeRoomCode, REACTIONS,
  type ChatEntry, type ClientMessage, type Seat, type ServerMessage,
} from "./protocol";

const ALL_PLAYERS = playersJson as Player[];
const POOL = auctionPool(ALL_PLAYERS);

/** Wall-clock pacing, in ms. The engine itself owns no time (CLAUDE.md §4). */
const TICK_MS = 1000;
const SOLD_BANNER_MS = 2200;
const UNSOLD_BANNER_MS = 1400;
/** A human sitting on an RTM decision cannot stall the room forever. */
const RTM_HUMAN_TIMEOUT_MS = 15_000;
const RTM_BOT_THINK_MS = 1200;

export interface Env {
  ROOMS: DurableObjectNamespace<AuctionRoom>;
  /** Optional. Unset = no commentary; the auction is otherwise identical. */
  ANTHROPIC_API_KEY?: string;
}

interface Persisted {
  code: string;
  auction: AuctionState;
  seats: Seat[];
  tokens: Record<string, string>; // token → franchiseId
  hostToken: string | null;
  rng: Rng;
  rtmDeadline: number | null;
  chat: ChatEntry[];
  /** Per-room commentary call count, for the cost cap. */
  commentaryCalls: number;
}

/** Keep the backlog small: it ships with every join and lives in DO storage. */
const CHAT_HISTORY = 60;
const CHAT_MAX_LEN = 240;

interface Attachment {
  token: string;
  franchiseId: string | null; // null = spectator
  name: string;
}

export class AuctionRoom extends DurableObject<Env> {
  private state!: Persisted;
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Load once; every later mutation persists before it is broadcast.
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Persisted>("room");
      this.state = stored ?? this.blankRoom();
    });
  }

  private blankRoom(): Persisted {
    const seed = Math.floor(Date.now() % 0xffffffff);
    let franchises = makeDefaultFranchises("");
    franchises = applyRetentions(franchises, ALL_PLAYERS, seed + 3);
    franchises = assignFormerPlayers(franchises, POOL, seed + 1);
    franchises = attachBotPersonalities(franchises, 1, seed + 2);
    return {
      code: "",
      auction: createInitialState(POOL, franchises),
      seats: franchises.map((f) => ({
        franchiseId: f.id,
        name: f.botPersonality?.name ?? "Bot",
        isHuman: false,
        connected: false,
      })),
      tokens: {},
      hostToken: null,
      rng: seedRng(seed),
      rtmDeadline: null,
      chat: [],
      commentaryCalls: 0,
    };
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("room", this.state);
  }

  // ------------------------------------------------------------ connections

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    if (this.state.code === "") {
      this.state.code = code;
      await this.persist();
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ready;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return this.send(ws, { type: "error", message: "bad message" });
    }

    if (msg.type === "join") return this.onJoin(ws, msg);

    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return this.send(ws, { type: "error", message: "join first" });

    // Chat and reactions are open to spectators too.
    if (msg.type === "chat") return this.onChat(att, msg.text);
    if (msg.type === "react") return this.onReact(att, msg.emoji);
    if (!att.franchiseId) {
      return this.send(ws, { type: "error", message: "spectators cannot bid" });
    }

    switch (msg.type) {
      case "start":
        if (att.token !== this.state.hostToken) {
          return this.send(ws, { type: "error", message: "only the host can start" });
        }
        await this.startAuction();
        break;
      case "bid":
        await this.dispatch({ type: "BID", franchiseId: att.franchiseId });
        break;
      case "pass":
        await this.dispatch({ type: "PASS", franchiseId: att.franchiseId });
        break;
      case "rtm_offer":
        if (this.isRtmActor(att.franchiseId, "offer")) {
          await this.dispatch({ type: "RTM_OFFER_RESPONSE", useCard: msg.useCard });
        }
        break;
      case "rtm_raise":
        if (this.isRtmActor(att.franchiseId, "raise")) {
          await this.dispatch({ type: "RTM_RAISE", raise: msg.raise });
        }
        break;
      case "rtm_decide":
        if (this.isRtmActor(att.franchiseId, "decide")) {
          await this.dispatch({ type: "RTM_DECIDE", match: msg.match });
        }
        break;
    }
  }

  private async onChat(att: Attachment, raw: string): Promise<void> {
    const text = raw.trim().slice(0, CHAT_MAX_LEN);
    if (!text) return;
    const entry: ChatEntry = {
      id: crypto.randomUUID(),
      franchiseId: att.franchiseId,
      name: att.name,
      text,
      at: Date.now(),
    };
    this.state.chat = [...this.state.chat, entry].slice(-CHAT_HISTORY);
    await this.persist();
    this.broadcast({ type: "chat", entry });
  }

  /** Reactions are ephemeral: broadcast, never stored. */
  private onReact(att: Attachment, emoji: string): void {
    if (!(REACTIONS as readonly string[]).includes(emoji)) return;
    this.broadcast({ type: "react", event: { franchiseId: att.franchiseId, emoji, at: Date.now() } });
  }

  private isRtmActor(franchiseId: string, stage: string): boolean {
    const o = this.state.auction.rtmOffer;
    if (!o || o.stage !== stage) return false;
    return stage === "raise" ? o.winningFranchiseId === franchiseId : o.formerFranchiseId === franchiseId;
  }

  private async onJoin(
    ws: WebSocket,
    msg: { name: string; token?: string; spectate?: boolean },
  ): Promise<void> {
    const name = msg.name.slice(0, 20) || "Player";

    // Spectators watch without taking a seat — no token, no franchise.
    if (msg.spectate) {
      ws.serializeAttachment({ token: "", franchiseId: null, name } satisfies Attachment);
      this.send(ws, {
        type: "welcome", token: "", franchiseId: null,
        roomCode: this.state.code, isHost: false, spectating: true,
      });
      this.send(ws, { type: "chat_history", entries: this.state.chat });
      this.broadcastState();
      return;
    }

    // Reconnecting with a known token reclaims the same seat.
    let franchiseId = msg.token ? this.state.tokens[msg.token] : undefined;
    let token = msg.token;

    if (!franchiseId) {
      const free = this.state.seats.find((s) => !s.isHuman);
      // A full room still lets you in — as a spectator.
      if (!free) {
        ws.serializeAttachment({ token: "", franchiseId: null, name } satisfies Attachment);
        this.send(ws, {
          type: "welcome", token: "", franchiseId: null,
          roomCode: this.state.code, isHost: false, spectating: true,
        });
        this.send(ws, { type: "chat_history", entries: this.state.chat });
        this.broadcastState();
        return;
      }
      token = crypto.randomUUID();
      franchiseId = free.franchiseId;
      this.state.tokens[token] = franchiseId;
      free.isHuman = true;
      free.name = name;
      this.state.auction = {
        ...this.state.auction,
        franchises: this.state.auction.franchises.map((f) =>
          f.id === franchiseId ? { ...f, isHuman: true, botPersonality: undefined } : f,
        ),
      };
      this.state.hostToken ??= token;
    }

    const seat = this.state.seats.find((s) => s.franchiseId === franchiseId)!;
    seat.connected = true;
    ws.serializeAttachment({ token: token!, franchiseId, name: seat.name } satisfies Attachment);
    await this.persist();

    this.send(ws, {
      type: "welcome",
      token: token!,
      franchiseId,
      roomCode: this.state.code,
      isHost: token === this.state.hostToken,
      spectating: false,
    });
    this.send(ws, { type: "chat_history", entries: this.state.chat });
    this.broadcastState();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ready;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.franchiseId) {
      const seat = this.state.seats.find((s) => s.franchiseId === att.franchiseId);
      // The seat is held, not freed: the auction never pauses, but the token
      // lets them reclaim it on reconnect.
      if (seat) seat.connected = false;
      await this.persist();
      this.broadcastState();
    }
  }

  // ------------------------------------------------------------- game loop

  private async startAuction(): Promise<void> {
    if (this.state.auction.phase !== "lobby") return;
    const seed = Math.floor(Date.now() % 0xffffffff);
    this.state.auction = applyEvent(this.state.auction, { type: "START", seed });
    await this.persist();
    this.broadcastState();
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  /**
   * Kick off a commentary call without awaiting it — the auction clock must
   * never wait on an API round-trip. waitUntil keeps the DO alive for it.
   */
  private fireCommentary(m: Moment): void {
    if (!this.env.ANTHROPIC_API_KEY || !isWorthComment(m)) return;
    const snapshot = this.state.auction;
    this.state.commentaryCalls++;
    const calls = this.state.commentaryCalls;
    this.ctx.waitUntil(
      comment(m, snapshot, { apiKey: this.env.ANTHROPIC_API_KEY, callsSoFar: calls - 1 })
        .then((text) => {
          if (text) this.broadcast({ type: "commentary", text, at: Date.now() });
        })
        .catch(() => { /* commentary is never worth a thrown error */ }),
    );
  }

  /** Interesting transitions worth a line from the commentator. */
  private momentFor(before: AuctionState, after: AuctionState): Moment | null {
    const byId = (id: string | null) => after.franchises.find((f) => f.id === id);
    if (after.phase === "sold" && before.phase !== "sold" && after.currentPlayer) {
      const buyer = byId(after.currentBidderId);
      if (!buyer) return null;
      return {
        kind: "sold",
        player: after.currentPlayer.name,
        buyer,
        price: after.currentBid ?? 0,
        contested: after.bidHistory.filter((b) => b.playerId === after.currentPlayer!.id).length,
      };
    }
    if (after.phase === "rtm" && before.phase !== "rtm" && after.rtmOffer && after.currentPlayer) {
      const former = byId(after.rtmOffer.formerFranchiseId);
      const winner = byId(after.rtmOffer.winningFranchiseId);
      if (!former || !winner) return null;
      return { kind: "rtm", player: after.currentPlayer.name, former, winner, price: after.rtmOffer.amount };
    }
    if (after.phase === "finished" && before.phase !== "finished") {
      const champion = [...after.franchises].sort(
        (a, b) => b.squad.reduce((n, p) => n + p.rating, 0) - a.squad.reduce((n, p) => n + p.rating, 0),
      )[0];
      return { kind: "finished", champion };
    }
    if (
      after.phase === "bidding" &&
      after.currentPlayer &&
      before.currentPlayer &&
      after.currentPlayer.setId !== before.currentPlayer.setId
    ) {
      const set = after.sets.find((s) => s.id === after.currentPlayer!.setId);
      if (set) return { kind: "set", setName: set.name };
    }
    return null;
  }

  private async dispatch(event: Parameters<typeof applyEvent>[1]): Promise<void> {
    const before = this.state.auction;
    const after = applyEvent(before, event);
    if (after === before) return; // rejected by the engine; nothing to say
    this.state.auction = after;
    const moment = this.momentFor(before, after);
    if (moment) this.fireCommentary(moment);
    if (after.phase === "rtm" && before.phase !== "rtm") {
      this.state.rtmDeadline = Date.now() + RTM_HUMAN_TIMEOUT_MS;
    }
    await this.persist();
    this.broadcastState();
    await this.scheduleNext();
  }

  /** The next wake-up depends on what the auction is waiting for. */
  private async scheduleNext(): Promise<void> {
    const { phase } = this.state.auction;
    if (phase === "finished" || phase === "lobby") {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const delay =
      phase === "sold" ? SOLD_BANNER_MS :
      phase === "unsold" ? UNSOLD_BANNER_MS :
      phase === "rtm" ? RTM_BOT_THINK_MS :
      TICK_MS;
    await this.ctx.storage.setAlarm(Date.now() + delay);
  }

  async alarm(): Promise<void> {
    await this.ready;
    const a = this.state.auction;
    const before = a;

    switch (a.phase) {
      case "bidding": {
        // One bot may act per tick — enough to feel like a room reacting,
        // few enough that a war stays readable.
        let order;
        [order, this.state.rng] = shuffle(a.franchises, this.state.rng);
        for (const f of order) {
          if (f.isHuman || !canBid(this.state.auction, f.id).ok) continue;
          let move;
          [move, this.state.rng] = botAction(this.state.auction, f.id, this.state.rng);
          if (move === "bid") {
            this.state.auction = applyEvent(this.state.auction, { type: "BID", franchiseId: f.id });
            break;
          }
        }
        if (this.state.auction.phase === "bidding") {
          this.state.auction = applyEvent(this.state.auction, { type: "TICK" });
        }
        break;
      }
      case "sold":
      case "unsold":
        this.state.auction = applyEvent(this.state.auction, { type: "NEXT_PLAYER" });
        break;
      case "rtm": {
        const o = this.state.auction.rtmOffer!;
        const actorId = o.stage === "raise" ? o.winningFranchiseId : o.formerFranchiseId;
        const actor = this.state.auction.franchises.find((f) => f.id === actorId)!;
        const expired = this.state.rtmDeadline !== null && Date.now() > this.state.rtmDeadline;
        if (actor.isHuman && !expired) break; // still their call

        if (actor.isHuman && expired) {
          // Timed out — take the safe option so the room keeps moving.
          this.state.auction = applyEvent(
            this.state.auction,
            o.stage === "offer" ? { type: "RTM_OFFER_RESPONSE", useCard: false }
            : o.stage === "raise" ? { type: "RTM_RAISE", raise: false }
            : { type: "RTM_DECIDE", match: false },
          );
        } else {
          let v: boolean;
          if (o.stage === "offer") {
            [v, this.state.rng] = botRtmUseCard(this.state.auction, this.state.rng);
            this.state.auction = applyEvent(this.state.auction, { type: "RTM_OFFER_RESPONSE", useCard: v });
          } else if (o.stage === "raise") {
            [v, this.state.rng] = botRtmRaise(this.state.auction, this.state.rng);
            this.state.auction = applyEvent(this.state.auction, { type: "RTM_RAISE", raise: v });
          } else {
            [v, this.state.rng] = botRtmMatch(this.state.auction, this.state.rng);
            this.state.auction = applyEvent(this.state.auction, { type: "RTM_DECIDE", match: v });
          }
        }
        if (this.state.auction.phase === "rtm") {
          this.state.rtmDeadline = Date.now() + RTM_HUMAN_TIMEOUT_MS;
        }
        break;
      }
      default:
        return;
    }

    const moment = this.momentFor(before, this.state.auction);
    if (moment) this.fireCommentary(moment);

    await this.persist();
    this.broadcastState();
    await this.scheduleNext();
  }

  // ------------------------------------------------------------ broadcast

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }

  private broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        /* dropped */
      }
    }
  }

  private broadcastState(): void {
    let spectators = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att && !att.franchiseId) spectators++;
    }
    this.broadcast({
      type: "state",
      auction: this.state.auction,
      seats: this.state.seats,
      hostId: this.state.hostToken ? this.state.tokens[this.state.hostToken] ?? null : null,
      spectators,
    });
  }
}

// --------------------------------------------------------------- worker

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    // Create a room: returns a fresh code.
    if (url.pathname === "/api/room" && request.method === "POST") {
      const code = makeRoomCode(Math.random);
      return Response.json({ code }, { headers: CORS });
    }

    // Join a room over WebSocket: /api/room/ABC123/ws
    const m = url.pathname.match(/^\/api\/room\/([A-Za-z0-9]{6})\/ws$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!isValidRoomCode(code)) {
        return new Response("bad room code", { status: 400, headers: CORS });
      }
      const stub = env.ROOMS.getByName(code);
      return stub.fetch(new Request(`https://room/?code=${code}`, request));
    }

    return new Response("not found", { status: 404, headers: CORS });
  },
};
