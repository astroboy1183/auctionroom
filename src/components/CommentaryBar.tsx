// The commentator's line, styled as a broadcast caption. Appears when a line
// arrives and fades out on its own — it is never load-bearing, so an absent
// commentator simply means an empty strip.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface Props {
  commentary: { text: string; at: number } | null;
}

const VISIBLE_MS = 8000;

export default function CommentaryBar({ commentary }: Props) {
  const [shown, setShown] = useState<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (!commentary) return;
    setShown(commentary);
    const id = setTimeout(() => setShown(null), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [commentary]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.at}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="pointer-events-none mx-auto max-w-lg rounded-lg border-l-4 border-sky-400 bg-slate-950/80 px-3 py-2 backdrop-blur-md"
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400">
            In the commentary box
          </p>
          <p className="mt-0.5 text-sm italic leading-snug text-slate-200">"{shown.text}"</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
