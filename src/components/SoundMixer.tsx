// Per-channel sound control. One blunt mute wasn't enough once the room had
// an auctioneer, eight franchise voices, a crowd bed and effects all at once —
// the commonest ask is "keep the game sounds, lose the talking".

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { DEFAULT_MIX, getMix, setMix, type Mix } from "../lib/audio";

const KEY = "auctionroom:mix:v1";

export function loadMix(): Mix {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MIX;
    return { ...DEFAULT_MIX, ...(JSON.parse(raw) as Partial<Mix>) };
  } catch {
    return DEFAULT_MIX;
  }
}

function persist(mix: Mix): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mix));
  } catch {
    /* ignore */
  }
}

const CHANNELS: { key: keyof Mix; label: string; hint: string }[] = [
  { key: "master", label: "Overall", hint: "everything" },
  { key: "voice", label: "Voices", hint: "auctioneer and franchises" },
  { key: "effects", label: "Effects", hint: "bids, gavel, clock" },
  { key: "crowd", label: "Crowd", hint: "room ambience" },
];

export default function SoundMixer({ onClose }: { onClose: () => void }) {
  const [mix, setLocal] = useState<Mix>(() => getMix());

  useEffect(() => {
    setMix(mix);
    persist(mix);
  }, [mix]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <div className="flex items-center">
          <h3 className="text-lg font-black">Sound</h3>
          <button onClick={onClose} className="ml-auto rounded bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {CHANNELS.map(({ key, label, hint }) => (
            <label key={key} className="block">
              <span className="flex items-baseline justify-between text-sm font-bold">
                {label}
                <span className="font-mono text-xs text-slate-500">{Math.round(mix[key] * 100)}%</span>
              </span>
              <span className="mb-1 block text-[10px] text-slate-500">{hint}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(mix[key] * 100)}
                onChange={(e) => setLocal({ ...mix, [key]: Number(e.target.value) / 100 })}
                className="w-full accent-amber-500"
                aria-label={`${label} volume`}
              />
            </label>
          ))}
        </div>

        <button
          onClick={() => setLocal(DEFAULT_MIX)}
          className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
        >
          Reset to defaults
        </button>
      </motion.div>
    </motion.div>
  );
}
