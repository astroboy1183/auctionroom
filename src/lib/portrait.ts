// Generated player likenesses, shared by the 3D jumbotron and the DOM.
// Skin tone, kit colour, hair, beard and headgear all derive from a hash of
// the player id, so a given cricketer always looks the same. Real photos are
// deliberately not used: rights-encumbered, and the game ships no external
// assets (D-021).

/** Deterministic 32-bit hash of a player id, so a given cricketer always
 * gets the same generated likeness. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SKIN = ["#8d5524", "#a86b3c", "#c68642", "#e0ac69", "#f1c27d", "#7a4620"];
const KIT = ["#1d4ed8", "#b91c1c", "#047857", "#7c3aed", "#c2410c", "#0e7490"];

/**
 * A stylised head-and-shoulders portrait generated from the player's id —
 * skin tone, kit colour, hair, beard and headgear all derived from the hash,
 * with a role-appropriate prop. Real photographs are deliberately not used:
 * they are rights-encumbered, and the hall is asset-free and offline (D-013).
 */
export function drawPortrait(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  player: { id: string; role: string; overseas: boolean },
): void {
  const h = hashId(player.id);
  const skin = SKIN[h % SKIN.length];
  const kit = KIT[(h >> 3) % KIT.length];
  const hasBeard = ((h >> 6) & 3) > 1;
  const capped = ((h >> 8) & 3) > 0;
  const hair = ((h >> 10) & 1) ? "#1c1917" : "#292524";

  g.save();
  // roundel
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = g.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, "#1e293b");
  grad.addColorStop(1, "#0b1220");
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = kit;
  g.lineWidth = r * 0.07;
  g.stroke();

  g.beginPath();
  g.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
  g.clip();

  // shoulders / jersey
  g.fillStyle = kit;
  g.beginPath();
  g.ellipse(cx, cy + r * 0.95, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  // collar
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + r * 0.6, r * 0.26, r * 0.13, 0, 0, Math.PI * 2);
  g.fill();

  // neck + head
  g.fillStyle = skin;
  g.fillRect(cx - r * 0.16, cy + r * 0.18, r * 0.32, r * 0.36);
  g.beginPath();
  g.ellipse(cx, cy - r * 0.06, r * 0.36, r * 0.44, 0, 0, Math.PI * 2);
  g.fill();

  // ears
  g.beginPath();
  g.ellipse(cx - r * 0.37, cy - r * 0.02, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
  g.ellipse(cx + r * 0.37, cy - r * 0.02, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
  g.fill();

  // hair
  g.fillStyle = hair;
  g.beginPath();
  g.ellipse(cx, cy - r * 0.32, r * 0.37, r * 0.24, 0, Math.PI, 0);
  g.fill();

  if (hasBeard) {
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(cx, cy + r * 0.14, r * 0.3, r * 0.26, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(cx, cy + r * 0.04, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }

  // eyes + brows
  g.fillStyle = "#0b1220";
  g.beginPath();
  g.ellipse(cx - r * 0.14, cy - r * 0.08, r * 0.045, r * 0.055, 0, 0, Math.PI * 2);
  g.ellipse(cx + r * 0.14, cy - r * 0.08, r * 0.045, r * 0.055, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hair;
  g.lineWidth = r * 0.045;
  g.beginPath();
  g.moveTo(cx - r * 0.22, cy - r * 0.18);
  g.lineTo(cx - r * 0.06, cy - r * 0.21);
  g.moveTo(cx + r * 0.06, cy - r * 0.21);
  g.lineTo(cx + r * 0.22, cy - r * 0.18);
  g.stroke();

  if (capped) {
    // cap crown + peak, in the kit colour
    g.fillStyle = kit;
    g.beginPath();
    g.ellipse(cx, cy - r * 0.34, r * 0.4, r * 0.28, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - r * 0.4, cy - r * 0.36, r * 0.8, r * 0.08);
    g.beginPath();
    g.ellipse(cx, cy - r * 0.3, r * 0.52, r * 0.1, 0, 0, Math.PI);
    g.fill();
  }

  g.restore();

  // role prop, bottom-right of the roundel
  g.save();
  g.translate(cx + r * 0.66, cy + r * 0.66);
  g.rotate(-0.5);
  if (player.role === "BOWL") {
    g.fillStyle = "#b91c1c";
    g.beginPath();
    g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#fef2f2";
    g.lineWidth = r * 0.03;
    g.beginPath();
    g.arc(0, 0, r * 0.16, -0.9, 0.9);
    g.stroke();
  } else {
    g.fillStyle = "#d6b98c";
    g.fillRect(-r * 0.07, -r * 0.26, r * 0.14, r * 0.34);
    g.fillStyle = "#8b5a2b";
    g.fillRect(-r * 0.035, r * 0.06, r * 0.07, r * 0.2);
  }
  g.restore();

  if (player.overseas) {
    g.fillStyle = "#a5b4fc";
    g.font = `700 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.fillText("✈", cx - r * 0.72, cy - r * 0.6);
    g.textAlign = "left";
  }
}

