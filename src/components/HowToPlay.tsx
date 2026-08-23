// First-run explainer. The game has accumulated real rules — soft-lock
// reserves, three-stage RTM, retentions, shortlist ceilings, the accelerated
// round — and none of them are guessable. Shown automatically once, then
// available from the lobby.

import { useState } from "react";
import { motion } from "motion/react";
import { MIN_ROLES, OVERSEAS_MAX, SQUAD_MAX } from "../engine/rules";
import { START_BUDGET } from "../engine/franchises";
import { money } from "./format";

const SEEN_KEY = "auctionroom:seen-howto:v1";

export function hasSeenHowTo(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked — don't nag
  }
}

export function markHowToSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Page {
  title: string;
  body: React.ReactNode;
}

const PAGES: Page[] = [
  {
    title: "You run a cricket franchise",
    body: (
      <>
        <p>
          100 cricketers come up for auction one at a time. You have{" "}
          <b>{money(START_BUDGET)}</b> — less whatever your retained players cost — and you're
          bidding against seven rival franchises.
        </p>
        <p className="mt-2">
          Each lot runs on a <b>10-second clock</b> that resets on every bid. When it expires, the
          highest bidder wins the player.
        </p>
      </>
    ),
  },
  {
    title: "Your squad has hard rules",
    body: (
      <>
        <p>
          Maximum <b>{SQUAD_MAX} players</b>, at most <b>{OVERSEAS_MAX} overseas</b>. You must
          finish with at least <b>{MIN_ROLES.BAT} batters, {MIN_ROLES.BOWL} bowlers,{" "}
          {MIN_ROLES.AR} all-rounder and {MIN_ROLES.WK} keeper</b>.
        </p>
        <p className="mt-2">
          That's 8 of your 12 slots already spoken for — every luxury buy costs you a required one.
          The game won't let you spend into a corner: if a bid would leave you unable to fill your
          minimum, the BID button locks.
        </p>
      </>
    ),
  },
  {
    title: "Bowling depth wins matches",
    body: (
      <>
        <p>
          After the auction your squad plays a full season, simulated ball by ball. No bowler may
          bowl more than <b>4 of the 20 overs</b> — so you need <b>five real bowlers</b>.
        </p>
        <p className="mt-2">
          Carry only four and one of your batters has to bowl the other four overs. They will get
          hit. Skimping on bowling is the most common way to lose a season you thought you'd won.
        </p>
      </>
    ),
  },
  {
    title: "Right to Match",
    body: (
      <>
        <p>
          Three of your former players are in the auction. If a rival wins one, you get an{" "}
          <b>RTM card</b> offer: pay their winning price and take the player instead.
        </p>
        <p className="mt-2">
          They then get <b>one</b> final raise, and you decide whether to match that. You have two
          cards for the whole auction.
        </p>
      </>
    ),
  },
  {
    title: "Plan, then survive contact",
    body: (
      <>
        <p>
          Before you start, use <b>Plan your auction</b> to flag targets and set a ceiling on each.
          You'll be warned when a target is coming up, and the BID button turns <b>red</b> once you
          break your own plan.
        </p>
        <p className="mt-2 text-slate-400">
          Controls: <b>Space</b> bids · <b>P</b> passes (binding for that lot) · <b>S</b> skips.
          ⏭ hands the rest of the auction to your assistant.
        </p>
      </>
    ),
  },
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const finish = () => {
    markHowToSeen();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          How to play · {page + 1} of {PAGES.length}
        </p>
        <h3 className="mt-1 text-2xl font-black">{PAGES[page].title}</h3>
        <div className="mt-3 text-sm leading-relaxed text-slate-300">{PAGES[page].body}</div>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex gap-1.5">
            {PAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === page ? "bg-amber-400" : "bg-slate-700"}`}
              />
            ))}
          </div>
          <button onClick={finish} className="ml-auto text-xs text-slate-500 hover:text-slate-300">
            Skip
          </button>
          {page > 0 && (
            <button
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-bold hover:bg-slate-800"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (last ? finish() : setPage((p) => p + 1))}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-black text-slate-950 hover:bg-amber-400"
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
