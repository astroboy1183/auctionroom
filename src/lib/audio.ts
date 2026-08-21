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
