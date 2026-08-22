// Sound design: everything is synthesized in-browser (no assets, no network)
// but routed through a shared hall reverb so it sits in a room instead of
// beeping in your ear. UI-side code — Math.random is fine here.

let ctx: AudioContext | null = null;
let dry: GainNode | null = null;   // direct signal
let wet: GainNode | null = null;   // reverb send
let master: GainNode | null = null;

/** Build a decaying-noise impulse response — a plausible large hall. */
function impulse(c: AudioContext, seconds = 2.6, decay = 2.4): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // early reflections + exponential tail
      const early = i < c.sampleRate * 0.06 ? (Math.random() * 2 - 1) * 0.5 : 0;
      d[i] = ((Math.random() * 2 - 1) * (1 - t) ** decay + early) * 0.6;
    }
  }
  return buf;
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      const verb = ctx.createConvolver();
      verb.buffer = impulse(ctx);
      dry = ctx.createGain();
      dry.gain.value = 0.82;
      wet = ctx.createGain();
      wet.gain.value = 0.3;
      dry.connect(master);
      wet.connect(verb).connect(master);
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Route a source through both the dry path and the hall reverb. */
function send(node: AudioNode, wetAmount = 1): void {
  if (dry) node.connect(dry);
  if (wet && wetAmount > 0) {
    const g = ctx!.createGain();
    g.gain.value = wetAmount;
    node.connect(g).connect(wet);
  }
}

/** One struck-tone voice: sine partials with a soft attack and long tail. */
function struck(
  freq: number,
  { dur = 0.9, vol = 0.22, wetAmount = 1, partials = [1, 2, 3.01], decay = [1, 0.4, 0.16], attack = 0.006 } = {},
): void {
  const c = audio();
  if (!c) return;
  const bus = c.createGain();
  bus.gain.value = 1;
  send(bus, wetAmount);
  partials.forEach((mult, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    const amp = vol * (decay[i] ?? 0.2);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (1 - i * 0.18));
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  });
}

/** Filtered noise burst — the "body" of wooden/percussive hits. */
function noiseHit(
  { dur = 0.14, vol = 0.2, type = "bandpass" as BiquadFilterType, from = 2200, to = 500, q = 1.2, wetAmount = 1 } = {},
): void {
  const c = audio();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.6;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, to), c.currentTime + dur);
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g);
  send(g, wetAmount);
  src.start();
}

// ------------------------------------------------------------------ cues

/** A rival's bid: warm wooden knock, pitched up slightly as money climbs. */
export function blip(step = 0): void {
  const f = 392 * Math.pow(1.06, Math.min(step, 12)); // G4 creeping upward
  struck(f, { dur: 0.55, vol: 0.16, partials: [1, 2.76, 5.4], decay: [1, 0.25, 0.08] });
  noiseHit({ dur: 0.05, vol: 0.05, from: 3000, to: 1200, wetAmount: 0.5 });
}

/** Your paddle: a fuller, brighter version of the same instrument. */
export function paddle(): void {
  struck(523.25, { dur: 0.8, vol: 0.24, partials: [1, 2, 3.02, 4.1], decay: [1, 0.45, 0.2, 0.1] });
  noiseHit({ dur: 0.06, vol: 0.08, from: 4200, to: 1400, wetAmount: 0.6 });
}

/** Countdown tick: soft rim-click, tightens as the clock dies. */
export function clockTick(urgency = 0): void {
  noiseHit({ dur: 0.05, vol: 0.07 + urgency * 0.05, type: "highpass", from: 2600, to: 2600, wetAmount: 0.35 });
  struck(1046 + urgency * 180, { dur: 0.12, vol: 0.05, partials: [1], decay: [1], wetAmount: 0.4 });
}

/** The gavel: hard wooden crack over a resonant block thud. */
export function hammer(): void {
  noiseHit({ dur: 0.09, vol: 0.34, from: 5200, to: 900, q: 0.8 });
  struck(150, { dur: 0.5, vol: 0.34, partials: [1, 2.4, 4.2], decay: [1, 0.3, 0.12], attack: 0.002 });
  struck(300, { dur: 0.28, vol: 0.14, partials: [1, 3.1], decay: [1, 0.2], attack: 0.002 });
}

/** Passing: a soft descending breath. */
export function whoosh(): void {
  noiseHit({ dur: 0.34, vol: 0.09, from: 1800, to: 260, q: 0.7, wetAmount: 0.8 });
}

/** Chord helper for musical cues — gentle arpeggiated entry. */
function chord(freqs: number[], { dur = 1.3, vol = 0.13, spread = 0.07 } = {}): void {
  freqs.forEach((f, i) => {
    setTimeout(
      () => struck(f, { dur, vol, partials: [1, 2, 3.01], decay: [1, 0.35, 0.12], attack: 0.02 }),
      i * spread * 1000,
    );
  });
}

/** RTM: a tense, suspended minor colour. */
export function sting(): void {
  chord([220, 261.63, 329.63, 415.3], { dur: 1.8, vol: 0.11, spread: 0.05 });
}

/** New set: a clean broadcast two-note. */
export function motif(): void {
  chord([523.25, 783.99], { dur: 1.1, vol: 0.12, spread: 0.11 });
}

/** Winner: a warm major spread. */
export function fanfare(): void {
  chord([392, 493.88, 587.33, 783.99, 1174.66], { dur: 2.2, vol: 0.13, spread: 0.085 });
}

// ------------------------------------------------------------- crowd bed

let crowd: { srcs: AudioBufferSourceNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;

/** Room tone: two detuned layers of soft filtered noise, gently breathing. */
export function startCrowd(): void {
  const c = audio();
  if (!c || crowd) return;
  const seconds = 4;
  const len = c.sampleRate * seconds;
  const mk = (roughness: number) => {
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + (Math.random() * 2 - 1) * roughness) * 0.995;
      // slow amplitude undulation = a room of murmuring people
      d[i] = last * 2.6 * (1 + 0.35 * Math.sin((i / len) * Math.PI * 6));
    }
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    return s;
  };
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 480;
  filter.Q.value = 0.6;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.8);
  const a = mk(0.018);
  const b = mk(0.011);
  b.playbackRate.value = 0.87;
  a.connect(filter);
  b.connect(filter);
  filter.connect(gain);
  send(gain, 0.85);
  a.start();
  b.start(0.4);
  crowd = { srcs: [a, b], gain, filter };
}

export function stopCrowd(): void {
  if (!crowd || !ctx) return;
  const { srcs, gain } = crowd;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => srcs.forEach((s) => { try { s.stop(); } catch { /* already done */ } }), 900);
  crowd = null;
}

/** The room reacts — murmur swells and opens up, then settles back. */
export function crowdSwell(intensity = 1): void {
  const c = audio();
  if (!c || !crowd) return;
  const g = crowd.gain.gain;
  const f = crowd.filter.frequency;
  const now = c.currentTime;
  const peak = 0.05 + 0.11 * intensity;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(peak, now + 0.25);
  g.linearRampToValueAtTime(0.05, now + 1.8 + intensity);
  f.cancelScheduledValues(now);
  f.setValueAtTime(f.value, now);
  f.linearRampToValueAtTime(480 + 1100 * intensity, now + 0.25);
  f.linearRampToValueAtTime(480, now + 2);
}

// ------------------------------------------------------------- auctioneer

let voice: SpeechSynthesisVoice | null | undefined;
let englishVoices: SpeechSynthesisVoice[] | null = null;

function allEnglish(): SpeechSynthesisVoice[] {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  if (englishVoices && englishVoices.length) return englishVoices;
  const voices = synth.getVoices();
  const en = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("en"));
  englishVoices = en.length ? en : voices;
  return englishVoices;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang.replace("_", "-").startsWith("en-GB")) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith("en-")) ??
    voices[0] ??
    null
  );
}

/** The auctioneer: authoritative, a touch lower and slower than default. */
export function speak(text: string, interrupt = true, pitch = 0.92, rate = 1.04): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice ??= pickVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 1;
    synth.speak(u);
  } catch {
    /* no speech support — silently fine */
  }
}

// --------------------------------------------------------- team voices

/** A per-franchise voice: a different system voice where the OS offers one,
 * otherwise a distinct pitch/rate pairing, so the eight tables sound like
 * eight different rooms of people. */
export interface TeamVoice {
  pitch: number;
  rate: number;
  voiceIndex: number;
}

export function teamVoice(index: number): TeamVoice {
  // spread pitch/rate widely; indices wrap over whatever voices exist
  const pitches = [1.28, 0.78, 1.12, 0.88, 1.35, 0.7, 1.05, 0.95];
  const rates = [1.18, 0.94, 1.25, 1.02, 1.1, 0.9, 1.3, 1.06];
  return { pitch: pitches[index % 8], rate: rates[index % 8], voiceIndex: index };
}

let lastTeamCall = 0;

/**
 * A franchise shouts something — their own bid, a reaction. Kept short and
 * rate-limited so it interjects around the auctioneer instead of burying him.
 * Never interrupts: these queue behind whatever the host is saying.
 */
export function speakTeam(text: string, v: TeamVoice, minGapMs = 1500): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const now = Date.now();
    if (now - lastTeamCall < minGapMs) return;
    lastTeamCall = now;
    const u = new SpeechSynthesisUtterance(text);
    const pool = allEnglish();
    if (pool.length) u.voice = pool[v.voiceIndex % pool.length];
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.volume = 0.85;
    synth.speak(u);
  } catch {
    /* ignore */
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
