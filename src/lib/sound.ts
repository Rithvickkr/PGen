/**
 * Small kitchen sound kit, synthesized with Web Audio so there are no files to load.
 * Sounds only ever play in response to something the person did.
 */

export type SoundName =
  | 'chop'
  | 'stir'
  | 'plop'
  | 'pick'
  | 'pop'
  | 'coin'
  | 'tick'
  | 'whoosh'
  | 'sizzle'
  | 'pour'
  | 'lift'
  | 'ding'
  | 'print';

const KEY = 'pgen:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isMuted = () => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? 'off' : 'on');
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function envelope(g: GainNode, t: number, attack: number, peak: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(c: AudioContext, t: number, freq: number, dur: number, opts: { type?: OscillatorType; peak?: number; to?: number } = {}) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  envelope(g, t, 0.005, opts.peak ?? 0.3, dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(
  c: AudioContext,
  t: number,
  dur: number,
  opts: { filter?: BiquadFilterType; freq?: number; to?: number; q?: number; peak?: number; attack?: number } = {},
) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.filter ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.freq ?? 1200, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  filter.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const attack = opts.attack ?? 0.004;
  envelope(g, t, attack, opts.peak ?? 0.2, Math.max(0.01, dur - attack));
  src.connect(filter).connect(g).connect(master!);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export function play(name: SoundName): void {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'chop':
      noise(c, t, 0.05, { freq: 2600, q: 1.2, peak: 0.22 });
      tone(c, t, 170, 0.05, { type: 'triangle', to: 90, peak: 0.18 });
      break;
    case 'stir':
      noise(c, t, 0.22, { filter: 'lowpass', freq: 900, peak: 0.05, attack: 0.06 });
      break;
    case 'plop':
      tone(c, t, 620, 0.14, { to: 170, peak: 0.35 });
      noise(c, t + 0.02, 0.05, { filter: 'highpass', freq: 3000, peak: 0.05 });
      break;
    case 'pick':
      tone(c, t, 1760, 0.14, { peak: 0.1 });
      tone(c, t + 0.01, 2640, 0.1, { peak: 0.06 });
      tone(c, t + 0.12, 540, 0.12, { to: 200, peak: 0.22 });
      break;
    case 'pop':
      tone(c, t, 900, 0.07, { to: 1400, peak: 0.16 });
      break;
    case 'coin':
      tone(c, t, 1320, 0.08, { type: 'triangle', peak: 0.14 });
      tone(c, t + 0.07, 1980, 0.2, { type: 'triangle', peak: 0.14 });
      break;
    case 'tick':
      tone(c, t, 2200, 0.02, { type: 'square', peak: 0.05 });
      break;
    case 'whoosh':
      noise(c, t, 0.5, { freq: 300, to: 1600, q: 0.8, peak: 0.08, attack: 0.18 });
      break;
    case 'sizzle':
      noise(c, t, 0.8, { filter: 'highpass', freq: 4200, peak: 0.08, attack: 0.08 });
      break;
    case 'pour':
      noise(c, t, 1.2, { freq: 900, to: 420, q: 0.7, peak: 0.12, attack: 0.25 });
      break;
    case 'lift':
      tone(c, t, 320, 0.3, { to: 520, peak: 0.08 });
      noise(c, t, 0.35, { filter: 'highpass', freq: 2500, peak: 0.05, attack: 0.1 });
      break;
    case 'ding':
      tone(c, t, 1318, 1.4, { peak: 0.22 });
      tone(c, t, 2636, 0.7, { peak: 0.08 });
      tone(c, t, 3954, 0.35, { peak: 0.04 });
      break;
    case 'print':
      for (let i = 0; i < 10; i++) noise(c, t + i * 0.07, 0.04, { freq: 1800, q: 2, peak: 0.06 });
      break;
  }
}

/** A tiny vibration on phones that support it. Follows the sound setting. */
export function buzz(ms = 10): void {
  if (muted || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* not allowed */
  }
}
