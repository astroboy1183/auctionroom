// Renders the 3D hall behind the lobby and results screens. The chunk is
// heavy, so it is never part of first paint: it loads once the browser is
// idle, and the screen renders its own gradient until then.

import { Suspense, lazy, useEffect, useState } from "react";
import type { HallMode } from "../scene/Hall";
import { useGameStore } from "../store/gameStore";

const Hall = lazy(() => import("../scene/Hall"));

/** Load after first paint so the lobby is interactive immediately. */
function useIdleMount(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(h);
    }
    const timer = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(timer);
  }, [enabled]);
  return ready;
}

export default function HallBackdrop({ mode }: { mode: HallMode }) {
  const view3d = useGameStore((s) => s.view3d);
  const ready = useIdleMount(view3d);

  return (
    <>
      <div className="fixed inset-0 -z-20 bg-gradient-to-b from-slate-900 via-slate-950 to-black" />
      {view3d && ready && (
        <Suspense fallback={null}>
          <Hall mode={mode} />
        </Suspense>
      )}
    </>
  );
}
