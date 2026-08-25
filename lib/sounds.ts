"use client";

/**
 * Synthesised UI sounds for the login page -- no audio assets, just
 * short oscillator envelopes, ported one-for-one from the original.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  configure: (osc: OscillatorNode, gain: GainNode, now: number, audio: AudioContext) => void,
) {
  const audio = ctx();
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    configure(osc, gain, audio.currentTime, audio);
  } catch {
    /* audio unavailable -- the UI still works */
  }
}

/** Crisp click. */
export function playClick() {
  tone((osc, gain, now) => {
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start();
    osc.stop(now + 0.06);
  });
}

/** Micro keyboard feedback. */
export function playType() {
  tone((osc, gain, now) => {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.start();
    osc.stop(now + 0.03);
  });
}

/** Rising C-major arpeggio when the credentials check out. */
export function playSnap() {
  const audio = ctx();
  if (!audio) return;
  try {
    [523.25, 659.25, 1046.5].forEach((freq, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + index * 0.04;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.15, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.18);
    });
  } catch {
    /* ignore */
  }
}

let lastDodge = 0;

/** Woosh as the button dodges, throttled so it cannot machine-gun. */
export function playDodge() {
  const now = Date.now();
  if (now - lastDodge < 350) return;
  lastDodge = now;
  tone((osc, gain, t) => {
    osc.type = "sine";
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start();
    osc.stop(t + 0.12);
  });
}

/** Two-step sawtooth buzz on a failed sign-in. */
export function playError() {
  tone((osc, gain, now) => {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start();
    osc.stop(now + 0.25);
  });
}
