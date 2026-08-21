// Seeded PRNG (mulberry32) as pure step functions — the engine never calls
// Math.random (CLAUDE.md §4). State is a plain number so it lives inside
// AuctionState and every transition stays reproducible by seed.

export type Rng = number;

export function seedRng(seed: number): Rng {
  return seed >>> 0;
}

/** One mulberry32 step: returns [float in [0,1), next state]. */
export function nextFloat(rng: Rng): [number, Rng] {
  const a = (rng + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a >>> 0];
}

export function nextInt(rng: Rng, maxExclusive: number): [number, Rng] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * maxExclusive), next];
}

/** Fisher–Yates on a copy; returns [shuffled, next state]. */
export function shuffle<T>(items: T[], rng: Rng): [T[], Rng] {
  const out = [...items];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(r, i + 1);
    r = next;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, r];
}
