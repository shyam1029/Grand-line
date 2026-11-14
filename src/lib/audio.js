/**
 * Procedural sound design (Web Audio API) — no audio files.
 *
 *   ocean   looped noise through a low-pass filter whose gain and cutoff are
 *           swept by slow LFOs, so it swells like surf instead of hissing
 *   click   a short metallic tick when the needle is pulled to a new target
 *   chime   an inharmonic bell with a soft echo when the Log locks
 *
 * Muted by default. The AudioContext is only created after the visitor turns
 * sound on (which is also the user gesture browsers require to start audio).
 */
import { $activeTarget, $needleLocked, $soundEnabled } from '../stores/navigationStore.js';

const MASTER_LEVEL = 0.55;

let context = null;
let master = null;
let echo = null;
let initialised = false;

function createNoiseBuffer(ctx, seconds = 3) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish noise: integrate white noise for a warmer, deeper rumble.
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function lfo(ctx, frequency, depth, target) {
  const oscillator = ctx.createOscillator();
  const amount = ctx.createGain();
  oscillator.frequency.value = frequency;
  amount.gain.value = depth;
  oscillator.connect(amount).connect(target);
  oscillator.start();
}

function startOcean(ctx, destination) {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx);
  source.loop = true;

  // Body of the swell.
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 520;
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.5;
  lfo(ctx, 0.11, 0.22, bodyGain.gain);
  lfo(ctx, 0.07, 180, body.frequency);

  // Foam: a thin, airy band that washes in on a different rhythm.
  const foam = ctx.createBiquadFilter();
  foam.type = 'bandpass';
  foam.frequency.value = 2600;
  foam.Q.value = 0.6;
  const foamGain = ctx.createGain();
  foamGain.gain.value = 0.16;
  lfo(ctx, 0.17, 0.12, foamGain.gain);

  source.connect(body).connect(bodyGain).connect(destination);
  source.connect(foam).connect(foamGain).connect(destination);
  source.start();
}

function ensureContext() {
  if (context) return context;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;

  context = new AudioContextClass();
  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  // Shared feedback echo for the chime.
  echo = context.createDelay(1);
  echo.delayTime.value = 0.26;
  const feedback = context.createGain();
  feedback.gain.value = 0.28;
  echo.connect(feedback).connect(echo);
  echo.connect(master);

  startOcean(context, master);
  return context;
}

/** One decaying partial. */
function partial(frequency, peak, decay, destination, type = 'sine') {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(peak, now + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(now);
  oscillator.stop(now + decay + 0.05);
}

/** Brass gimbal click: two bright, very short partials. */
function playClick() {
  partial(2140, 0.07, 0.05, master, 'triangle');
  partial(3310, 0.04, 0.035, master, 'square');
}

/** Lock chime: bell-like inharmonic partials over a 660 Hz fundamental. */
function playChime() {
  const fundamental = 660;
  [
    [1, 0.22, 1.8],
    [2.0, 0.11, 1.3],
    [2.76, 0.08, 1.0],
    [5.4, 0.035, 0.55],
  ].forEach(([ratio, peak, decay]) => {
    partial(fundamental * ratio, peak, decay, master);
    partial(fundamental * ratio, peak * 0.5, decay, echo);
  });
}

function setEnabled(enabled) {
  if (enabled) {
    const ctx = ensureContext();
    if (!ctx) return;
    ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_LEVEL, ctx.currentTime + 1.2);
  } else if (context) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
    window.setTimeout(() => {
      if (!$soundEnabled.get()) context.suspend();
    }, 500);
  }
}

/** Wire the sound design to the navigation stores. Safe to call repeatedly. */
export function initAudio() {
  if (initialised) return;
  initialised = true;

  $soundEnabled.listen(setEnabled);
  $activeTarget.listen((slug) => {
    if (slug && $soundEnabled.get() && context) playClick();
  });
  $needleLocked.listen((locked) => {
    if (locked && $soundEnabled.get() && context) playChime();
  });
}
