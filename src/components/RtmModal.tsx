// The Right to Match drama, staged: offer → optional single raise → decide.
// Human stages show buttons; bot stages show a suspense line while the
// driver thinks (useAuctionDriver answers them after a beat).

import { motion } from "motion/react";
import type { AuctionState } from "../engine/types";
import { useGameStore } from "../store/gameStore";
import { nextIncrement } from "../engine/bids";
import { money } from "./format";

export default function RtmModal({ auction }: { auction: AuctionState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const offer = auction.rtmOffer;
  if (!offer || !auction.currentPlayer) return null;

  const player = auction.currentPlayer;
  const former = auction.franchises.find((f) => f.id === offer.formerFranchiseId)!;
  const winner = auction.franchises.find((f) => f.id === offer.winningFranchiseId)!;
  const actor = offer.stage === "raise" ? winner : former;
  const raised = offer.amount + nextIncrement(offer.amount);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-md rounded-2xl border border-violet-500/40 bg-slate-900 p-6 text-center shadow-2xl"
      >
        <p className="text-xs font-black uppercase tracking-widest text-violet-400">Right to Match</p>
        <h3 className="mt-2 text-2xl font-black">{player.name}</h3>
        <p className="mt-1 text-sm text-slate-400">
          <span style={{ color: winner.color }}>{winner.name}</span> won at{" "}
          <span className="font-bold text-slate-200">{money(offer.amount)}</span>
        </p>

        {offer.stage === "offer" && (
          actor.isHuman ? (
            <>
              <p className="mt-4 text-sm">
                {player.name} is one of yours. Use an RTM card? ({former.rtmCards} left)
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={() => dispatch({ type: "RTM_OFFER_RESPONSE", useCard: true })}
                  className="rounded-lg bg-violet-500 px-5 py-2 font-bold text-white hover:bg-violet-400">
                  Use RTM
                </button>
                <button onClick={() => dispatch({ type: "RTM_OFFER_RESPONSE", useCard: false })}
                  className="rounded-lg bg-slate-700 px-5 py-2 font-bold hover:bg-slate-600">
                  Let him go
                </button>
              </div>
            </>
          ) : (
            <Suspense text={`${former.name} are eyeing an RTM card…`} color={former.color} />
          )
        )}

        {offer.stage === "raise" && (
          actor.isHuman ? (
            <>
              <p className="mt-4 text-sm">
                <span style={{ color: former.color }}>{former.name}</span> will match. One final
                raise to <span className="font-bold">{money(raised)}</span>?
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={() => dispatch({ type: "RTM_RAISE", raise: true })}
                  className="rounded-lg bg-amber-500 px-5 py-2 font-bold text-slate-950 hover:bg-amber-400">
                  Raise to {money(raised)}
                </button>
                <button onClick={() => dispatch({ type: "RTM_RAISE", raise: false })}
                  className="rounded-lg bg-slate-700 px-5 py-2 font-bold hover:bg-slate-600">
                  Stay at {money(offer.amount)}
                </button>
              </div>
            </>
          ) : (
            <Suspense text={`${winner.name} may raise one last time…`} color={winner.color} />
          )
        )}

        {offer.stage === "decide" && (
          actor.isHuman ? (
            <>
              <p className="mt-4 text-sm">
                {offer.raiseUsed ? "They raised. " : ""}Match at{" "}
                <span className="font-bold">{money(offer.amount)}</span> to bring {player.name} home?
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={() => dispatch({ type: "RTM_DECIDE", match: true })}
                  className="rounded-lg bg-violet-500 px-5 py-2 font-bold text-white hover:bg-violet-400">
                  Match {money(offer.amount)}
                </button>
                <button onClick={() => dispatch({ type: "RTM_DECIDE", match: false })}
                  className="rounded-lg bg-slate-700 px-5 py-2 font-bold hover:bg-slate-600">
                  Decline
                </button>
              </div>
            </>
          ) : (
            <Suspense text={`${former.name} are deciding whether to match ${money(offer.amount)}…`} color={former.color} />
          )
        )}
      </motion.div>
    </motion.div>
  );
}

function Suspense({ text, color }: { text: string; color: string }) {
  return (
    <motion.p
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.4 }}
      className="mt-5 text-sm font-medium" style={{ color }}
    >
      {text}
    </motion.p>
  );
}
