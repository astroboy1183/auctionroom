// Sound: WebAudio-synthesized effects + Web Speech auctioneer. No audio
// assets, no network — everything is generated in the browser (D-011).
// UI-side code, so Math.random is fine here (engine purity is unaffected).

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short blip — a bid landing. */
export function blip(freq = 880): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.14, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.13);
}

/** Urgent clock tick for the final seconds. */
export function clockTick(): void {
  blip(440);
}

/** The gavel: low thud + a crack of filtered noise. */
export function hammer(): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(180, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(50, c.currentTime + 0.18);
  g.gain.setValueAtTime(0.55, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.3);

  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  const ng = c.createGain();
  ng.gain.value = 0.25;
  src.connect(f).connect(ng).connect(c.destination);
  src.start();
}

// ------------------------------------------------------------- auctioneer

let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang.replace("_", "-").startsWith("en-")) ??
    voices[0] ??
    null
  );
}

export function speak(text: string, interrupt = true): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice ??= pickVoice();
    if (voice) u.voice = voice;
    u.rate = 1.08;
    synth.speak(u);
  } catch {
    /* no speech support — silently fine */
  }
}

export function hushAuctioneer(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** "225" lakhs → "2.25 crore" for the auctioneer's mouth. */
export function moneySpeech(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `${Number.isInteger(cr) ? cr : cr.toFixed(2)} crore`;
  }
  return `${lakhs} lakh`;
}

// ------------------------------------------------------------- crowd bed

let crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

/** Low murmuring crowd: looped filtered noise. Idempotent start. */
export function startCrowd(): void {
  const c = ac();
  if (!c || crowd) return;
  const seconds = 2;
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // brown-ish noise: integrate white noise for a soft rumble
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
    d[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 650;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.045, c.currentTime + 1.2);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  crowd = { src, gain, filter };
}

export function stopCrowd(): void {
  if (!crowd || !ctx) return;
  const { src, gain } = crowd;
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => { try { src.stop(); } catch { /* done */ } }, 700);
  crowd = null;
}

/** The room reacts: murmur swells and brightens, then settles. */
export function crowdSwell(intensity = 1): void {
  const c = ac();
  if (!c || !crowd) return;
  const g = crowd.gain.gain;
  const f = crowd.filter.frequency;
  const now = c.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.045 + 0.12 * intensity, now + 0.15);
  g.linearRampToValueAtTime(0.045, now + 1.4 + 0.6 * intensity);
  f.cancelScheduledValues(now);
  f.setValueAtTime(f.value, now);
  f.linearRampToValueAtTime(650 + 1400 * intensity, now + 0.15);
  f.linearRampToValueAtTime(650, now + 1.6);
}

// ------------------------------------------------------- interaction SFX

/** Your paddle going up: a sharp confident thwack. */
export function paddle(): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(1500, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.06);
  g.gain.setValueAtTime(0.18, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.1);
}

/** Passing: a resigned downward whoosh. */
export function whoosh(): void {
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * 0.25);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(2400, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.22);
  const g = c.createGain();
  g.gain.value = 0.12;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

function chord(freqs: number[], dur: number, vol: number, type: OscillatorType = "triangle"): void {
  const c = ac();
  if (!c) return;
  for (const [i, hz] of freqs.entries()) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = hz;
    const t0 = c.currentTime + i * 0.06;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

/** RTM sting: a tense minor swell. */
export function sting(): void {
  chord([220, 261.6, 311.1], 1.1, 0.09, "sawtooth");
}

/** New set: a two-note broadcast motif. */
export function motif(): void {
  chord([523.3, 784], 0.5, 0.1);
}

/** Winner: a quick major fanfare. */
export function fanfare(): void {
  chord([392, 493.9, 587.3, 784], 1.4, 0.12);
}
