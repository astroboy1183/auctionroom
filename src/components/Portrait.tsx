// The generated likeness from the 3D jumbotron, reused in the DOM. Drawn to a
// canvas from a hash of the player id, so a cricketer always looks the same
// everywhere in the game. Real photographs are deliberately not used — they
// are rights-encumbered and the game ships no external assets (D-021).

import { useEffect, useRef } from "react";
import type { Player } from "../engine/types";
import { drawPortrait } from "../lib/portrait";

interface Props {
  player: Player;
  size?: number;
  className?: string;
}

export default function Portrait({ player, size = 44, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, size, size);
    drawPortrait(g, size / 2, size / 2, size / 2 - 1, player);
  }, [player, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full ${className}`}
      role="img"
      aria-label={`${player.name}, ${player.role}`}
    />
  );
}
