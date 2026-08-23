// Trash talk. Collapsible so it never competes with the bid button, with a
// row of one-tap reactions for when there's no time to type — which, with a
// ten-second clock, is most of the time.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REACTIONS, type ChatEntry, type ReactionEvent } from "../../worker/src/protocol";
import type { Franchise } from "../engine/types";

interface Props {
  chat: ChatEntry[];
  reactions: ReactionEvent[];
  franchises: Franchise[];
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
}

export default function RoomChat({ chat, reactions, franchises, onSend, onReact }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef(chat.length);

  useEffect(() => {
    if (open) {
      seen.current = chat.length;
      setUnread(0);
      endRef.current?.scrollIntoView({ block: "end" });
    } else {
      setUnread(chat.length - seen.current);
    }
  }, [chat, open]);

  const colorOf = (id: string | null) =>
    franchises.find((f) => f.id === id)?.color ?? "#94a3b8";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      {/* floating reactions from everyone in the room */}
      <div className="pointer-events-none relative h-0 w-full">
        <AnimatePresence>
          {reactions.map((r, i) => (
            <motion.span
              key={`${r.at}-${i}`}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 1, y: -70, scale: 1.25 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              className="absolute right-0 text-2xl"
              style={{ right: `${(i % 5) * 26}px` }}
            >
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-950/70 p-1 backdrop-blur-md">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="rounded px-1.5 py-0.5 text-lg leading-none transition hover:scale-125 hover:bg-slate-800"
          >
            {e}
          </button>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative rounded px-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
        >
          💬
          {unread > 0 && !open && (
            <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-[9px] font-black text-slate-950">
              {unread}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            className="w-64 overflow-hidden rounded-lg bg-slate-950/80 backdrop-blur-md"
          >
            <div className="max-h-48 overflow-y-auto px-2.5 py-2 text-xs">
              {chat.length === 0 && <p className="italic text-slate-600">Say something…</p>}
              {chat.map((c) => (
                <p key={c.id} className="mb-1 leading-snug">
                  <span className="font-bold" style={{ color: colorOf(c.franchiseId) }}>
                    {c.name}
                    {c.franchiseId === null && <span className="text-slate-500"> (watching)</span>}
                  </span>
                  <span className="text-slate-300"> {c.text}</span>
                </p>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={submit} className="flex gap-1 border-t border-slate-800 p-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={240}
                placeholder="Message the room"
                className="w-full rounded bg-slate-900 px-2 py-1 text-xs outline-none ring-slate-700 focus:ring-1"
              />
              <button className="rounded bg-slate-700 px-2 text-xs font-bold hover:bg-slate-600">↵</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
