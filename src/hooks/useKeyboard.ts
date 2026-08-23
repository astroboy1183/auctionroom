// Keyboard control for the auction floor. Space is the bid key because it is
// the one you can hit without looking while watching the clock.

import { useEffect } from "react";

export interface KeyActions {
  onBid: () => void;
  onPass: () => void;
  onSkip: () => void;
  enabled: boolean;
}

export function useKeyboard({ onBid, onPass, onSkip, enabled }: KeyActions) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Never steal keys from a text field.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === "Space") {
        e.preventDefault(); // stop the page scrolling
        onBid();
      } else if (e.key.toLowerCase() === "p") {
        onPass();
      } else if (e.key.toLowerCase() === "s") {
        onSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBid, onPass, onSkip, enabled]);
}
