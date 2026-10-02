"use client";

import { useEffect, useId, useRef } from "react";

import { pageZoom } from "@/lib/zoom";

import s from "./lamp.module.css";

/*
 * The floor lamp on the login page, drawn in design px: one unit is
 * var(--u), set by the stage, so the lamp is the same shape at every
 * screen size. The box is exactly the lamp (top bar to base, LAMP_W x
 * LAMP_H); the light it throws -- the halo over the bar, the cone, the
 * pool and streaks on the floor -- overflows it and moves with it.
 *
 * Every glow is painted once and only fades with opacity; data-on picks
 * which ones show. The cord and capsule are a real button that can be
 * tugged down with a pointer, tapped, or pressed with Enter / Space.
 */

/** Footprint in design px (lamp-on.png: x 307..565, y 214..813). */
const LAMP_W = 258;
const LAMP_H = 599;

/** How far the cord hangs from the bar (it leaves at x 229.5, y 24 --
    see .pull in lamp.module.css) to the capsule's cap. */
const CORD_LEN = 127;

/** Pull feel, in design px. */
const MAX_PULL = 70; // the rubber band never stretches past this
const TRIGGER = 22; // a pull this far toggles the light
const TAP_SLOP = 6; // CSS px of wander still treated as a tap, not a drag

/** Springs, per unit mass: the capsule's bob and the cord's pendulum. */
const BOB_K = 320;
const BOB_C = 15;
const SWAY_K = 62;
const SWAY_C = 6;

interface Drag {
  id: number;
  x: number;
  y: number;
  /** Real (screen) px per design px, measured when the drag starts. */
  scale: number;
  /** pageZoom() at the start: real px per CSS px. */
  zoom: number;
  moved: boolean;
  pull: number;
}

export function Lamp({
  on,
  onToggle,
  controls,
}: {
  on: boolean;
  onToggle: () => void;
  /** id of what the pull shows and hides (the sign-in card), for aria-controls. */
  controls?: string;
}) {
  // SVG ids must be unique per lamp and safe inside url(#...).
  const uid = `lamp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLSpanElement>(null);
  const cordRef = useRef<HTMLSpanElement>(null);
  const capsuleRef = useRef<HTMLSpanElement>(null);

  // Spring state lives outside React: it is written straight to the
  // three transforms every frame and never causes a render.
  const phys = useRef({ y: 0, vy: 0, a: 0, va: 0, last: 0, raf: 0 });
  const drag = useRef<Drag | null>(null);
  // When a pointer press last toggled (or deliberately didn't). The click
  // the browser sends after it must not toggle a second time; any other
  // click -- keyboard, switch access, a screen reader -- is a real press.
  const pointerUpAt = useRef(-Infinity);

  useEffect(() => {
    const p = phys.current;
    return () => cancelAnimationFrame(p.raf);
  }, []);

  /** Writes the current pull and swing to the cord and capsule. */
  const paint = () => {
    const p = phys.current;
    if (swingRef.current) swingRef.current.style.transform = `rotate(${p.a.toFixed(3)}deg)`;
    if (cordRef.current) {
      cordRef.current.style.transform = `scaleY(${((CORD_LEN + p.y) / CORD_LEN).toFixed(4)})`;
    }
    if (capsuleRef.current) {
      capsuleRef.current.style.transform = `translate3d(0, calc(${p.y.toFixed(2)} * var(--u)), 0)`;
    }
  };

  /** Runs the springs until both have settled, then stops the loop. */
  const settle = () => {
    const p = phys.current;
    if (p.raf) return;
    p.last = performance.now();

    const step = (now: number) => {
      // Clamp the step so a backgrounded tab does not explode the sim.
      const dt = Math.min(0.032, (now - p.last) / 1000);
      p.last = now;

      p.vy += (-BOB_K * p.y - BOB_C * p.vy) * dt;
      p.y += p.vy * dt;
      p.va += (-SWAY_K * p.a - SWAY_C * p.va) * dt;
      p.a += p.va * dt;

      const still =
        Math.abs(p.y) < 0.05 &&
        Math.abs(p.vy) < 0.5 &&
        Math.abs(p.a) < 0.04 &&
        Math.abs(p.va) < 0.4;
      if (still) {
        p.y = p.vy = p.a = p.va = 0;
        p.raf = 0;
        paint();
        return;
      }
      paint();
      p.raf = requestAnimationFrame(step);
    };
    p.raf = requestAnimationFrame(step);
  };

  /** Toggles the light and lets the cord spring back with a sway. */
  const release = (kick: number, swayFrom: number) => {
    const p = phys.current;
    // A tap or a key press has no pull of its own: give the capsule a
    // small downward tug so every toggle looks like the same pull.
    p.vy = kick;
    p.va = swayFrom;
    settle();
  };

  const reduceMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag.current) return;
    const root = rootRef.current;
    if (!root) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    // Real pointer px -> design px. The lamp's on-screen width is
    // LAMP_W * --u (CSS px) * pageZoom() * whatever scale the stage has
    // it at mid-glide, so dividing by it converts all three at once.
    const scale = root.getBoundingClientRect().width / LAMP_W || 1;

    const p = phys.current;
    cancelAnimationFrame(p.raf);
    p.raf = 0;
    p.vy = p.va = 0;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scale,
      zoom: pageZoom(),
      moved: false,
      pull: Math.max(0, p.y),
    };
    event.currentTarget.setAttribute("data-dragging", "");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;

    const dxReal = event.clientX - d.x;
    const dyReal = event.clientY - d.y;
    // TAP_SLOP is in CSS px; the pointer reports real px.
    if (!d.moved && Math.hypot(dxReal, dyReal) / d.zoom > TAP_SLOP) d.moved = true;

    const dx = dxReal / d.scale;
    const dy = dyReal / d.scale;
    d.pull = Math.max(0, dy);

    const p = phys.current;
    // Down only, and rubber-banded: the further you pull, the less it gives.
    p.y = MAX_PULL * (1 - Math.exp(-d.pull / MAX_PULL));
    // The capsule leans a little toward the pointer.
    const lean = (-Math.atan2(dx, CORD_LEN + 60 + p.y) * 180) / Math.PI;
    p.a = Math.max(-14, Math.min(14, lean * 0.6));
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.removeAttribute("data-dragging");

    if (!cancelled) pointerUpAt.current = performance.now();

    const pulled = d.pull > TRIGGER;
    const tapped = !d.moved;
    const toggles = !cancelled && (pulled || tapped);
    if (toggles) onToggle();

    const p = phys.current;
    if (reduceMotion()) {
      // No bounce or sway: the cord simply lets go.
      p.y = p.vy = p.a = p.va = 0;
      paint();
    } else if (toggles) {
      release(tapped ? 260 : 0, (p.a >= 0 ? 1 : -1) * (24 + p.y * 0.5));
    } else {
      release(0, 0);
    }
  };

  return (
    <div ref={rootRef} className={s.lamp} data-on={on ? "true" : "false"}>
      {/* Light thrown by the lamp, behind the metal. */}
      <span aria-hidden className={`${s.halo} ${s.lit}`} />
      <span aria-hidden className={`${s.cone} ${s.lit}`} />
      <span aria-hidden className={s.offStreak} />
      <span aria-hidden className={`${s.floorWash} ${s.lit}`} />
      <span aria-hidden className={`${s.pool} ${s.lit}`} />
      <span aria-hidden className={`${s.streak} ${s.lit}`} />
      <span aria-hidden className={`${s.streak2} ${s.lit}`} />

      <LampBody uid={uid} />

      {/* The diffuser's bloom, over the bar's lower lip. */}
      <span aria-hidden className={`${s.bloom} ${s.flick}`} />
      <span aria-hidden className={s.joint} />

      <button
        type="button"
        className={s.pull}
        data-lamp-cord
        aria-label="Lamp pull string"
        aria-expanded={on}
        aria-controls={controls}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, false)}
        onPointerCancel={(event) => endDrag(event, true)}
        onLostPointerCapture={(event) => endDrag(event, true)}
        onClick={() => {
          // A pointer press was already handled on pointerup; this is the
          // click the browser sends after it. (Touch skips that click
          // after a drag, hence the time limit rather than a bare flag.)
          if (performance.now() - pointerUpAt.current < 800) {
            pointerUpAt.current = -Infinity;
            return;
          }
          // Keyboard or assistive tech: the same toggle, the same tug.
          onToggle();
          if (!reduceMotion()) release(260, phys.current.a >= 0 ? 26 : -26);
        }}
        onKeyDown={(event) => {
          // Space normally fires on keyup; fire on keydown like Enter so
          // the tug lands with the key, and stop the page from scrolling.
          if (event.key === " ") {
            event.preventDefault();
            if (!event.repeat) event.currentTarget.click();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
      >
        <span aria-hidden className={s.idle}>
          <span ref={swingRef} className={s.swing}>
            <span ref={cordRef} className={s.cord}>
              <span className={s.cordOff} />
              <span className={`${s.cordOn} ${s.lit}`} />
            </span>
            <span ref={capsuleRef} className={s.capsule}>
              <span className={s.capGlowOff} />
              <span className={`${s.capGlowOn} ${s.flash}`} />
              <Capsule uid={uid} />
              <span className={s.ring} />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}

/** Bar, diffuser, pole and base (design-spec A1-A7): satin black metal
    with faint rim light, plus a warm-lit copy of each surface that fades
    in over it when the lamp is on. */
function LampBody({ uid }: { uid: string }) {
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      aria-hidden
      className={s.body}
      viewBox={`0 0 ${LAMP_W} ${LAMP_H}`}
      preserveAspectRatio="none"
    >
      <defs>
        {/* Bar. Off: charcoal, lighter to the right, a cool top edge. */}
        <linearGradient id={id("barOff")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1b1b1c" />
          <stop offset="1" stopColor="#29282a" />
        </linearGradient>
        <linearGradient id={id("barOffV")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7b7978" stopOpacity="0.9" />
          <stop offset="0.09" stopColor="#3a3939" stopOpacity="0.6" />
          <stop offset="0.2" stopColor="#000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        {/* On: reflected warm top edge, dark body, a lower lip lit by
            the diffuser, light bleeding through at the centre. */}
        <linearGradient id={id("barOn")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a6a47" />
          <stop offset="0.12" stopColor="#2a2016" />
          <stop offset="0.45" stopColor="#120d09" />
          <stop offset="0.75" stopColor="#2a1806" />
          <stop offset="1" stopColor="#9a5e1b" />
        </linearGradient>
        <radialGradient id={id("barGlow")} cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="#7a4813" stopOpacity="0.7" />
          <stop offset="0.6" stopColor="#543210" stopOpacity="0.35" />
          <stop offset="1" stopColor="#543210" stopOpacity="0" />
        </radialGradient>
        {/* Lit, the bar stays dark metal towards its ends; only the middle
            catches the diffuser. */}
        <linearGradient id={id("barOnEnds")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0c0a09" stopOpacity="0.85" />
          <stop offset="0.06" stopColor="#0c0a09" stopOpacity="0.55" />
          <stop offset="0.12" stopColor="#0c0a09" stopOpacity="0" />
          <stop offset="0.88" stopColor="#0c0a09" stopOpacity="0" />
          <stop offset="0.94" stopColor="#0c0a09" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0c0a09" stopOpacity="0.85" />
        </linearGradient>
        {/* The bar's pill ends fall into shadow. */}
        <linearGradient id={id("barEnds")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.5" />
          <stop offset="0.05" stopColor="#000" stopOpacity="0" />
          <stop offset="0.95" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>

        {/* Diffuser: white-hot core, amber edge ring. */}
        <radialGradient id={id("disc")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffefc" />
          <stop offset="0.95" stopColor="#fefdfa" />
          <stop offset="0.985" stopColor="#fed266" />
          <stop offset="1" stopColor="#f0ac4f" />
        </radialGradient>
        {/* Off, only its lower rim catches the capsule. */}
        <linearGradient id={id("discRim")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.12" stopColor="#7b634b" stopOpacity="0" />
          <stop offset="0.5" stopColor="#7b634b" stopOpacity="0.9" />
          <stop offset="0.88" stopColor="#7b634b" stopOpacity="0" />
        </linearGradient>

        {/* Pole. Off: near-black with a dim cool stripe. */}
        <linearGradient id={id("poleOff")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0c0a08" />
          <stop offset="0.45" stopColor="#14110f" />
          <stop offset="0.66" stopColor="#47464a" />
          <stop offset="0.8" stopColor="#24221f" />
          <stop offset="1" stopColor="#3b342c" />
        </linearGradient>
        <linearGradient id={id("poleOn")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#20130b" />
          <stop offset="0.08" stopColor="#0e0b08" />
          <stop offset="0.55" stopColor="#171411" />
          <stop offset="0.85" stopColor="#120e0b" />
          <stop offset="1" stopColor="#6a4520" />
        </linearGradient>
        <linearGradient id={id("poleTop")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c39462" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#9a6a40" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#6a4428" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3a2414" stopOpacity="0" />
        </linearGradient>
        {/* Its specular stripe: warm under the light, cooling to the
            card's grey-blue towards the floor. */}
        <linearGradient id={id("stripe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe497" />
          <stop offset="0.3" stopColor="#fdb362" />
          <stop offset="0.48" stopColor="#8a6a52" />
          <stop offset="0.62" stopColor="#3b4552" />
          <stop offset="1" stopColor="#434853" />
        </linearGradient>

        {/* Base. Off: a dark slab with a lit front edge. */}
        <linearGradient id={id("baseOff")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23201e" />
          <stop offset="0.17" stopColor="#23201e" />
          <stop offset="0.2" stopColor="#b3a291" />
          <stop offset="0.25" stopColor="#3a3632" />
          <stop offset="0.36" stopColor="#090808" />
          <stop offset="1" stopColor="#0f0a05" />
        </linearGradient>
        <linearGradient id={id("baseOffEdge")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        {/* On: amber top rim, cool grey face shading to a warm floor
            bounce at the bottom. */}
        <linearGradient id={id("baseOn")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a4a22" />
          <stop offset="0.03" stopColor="#f0b060" />
          <stop offset="0.08" stopColor="#d89a48" />
          <stop offset="0.13" stopColor="#5a4630" />
          <stop offset="0.16" stopColor="#333235" />
          <stop offset="0.27" stopColor="#26272d" />
          <stop offset="0.43" stopColor="#0f0e0f" />
          <stop offset="0.59" stopColor="#150d06" />
          <stop offset="0.81" stopColor="#291807" />
          <stop offset="1" stopColor="#2e1b05" />
        </linearGradient>
        <linearGradient id={id("baseEnds")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c98a3e" stopOpacity="0.75" />
          <stop offset="0.025" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.09" stopColor="#000" stopOpacity="0" />
          <stop offset="0.91" stopColor="#000" stopOpacity="0" />
          <stop offset="0.975" stopColor="#000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c98a3e" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* Diffuser, under the bar. */}
      <ellipse cx="129.5" cy="33" rx="79" ry="8" fill="#050403" />
      <path
        d="M50.5 33 A79 8 0 0 0 208.5 33"
        fill="none"
        stroke={url("discRim")}
        strokeWidth="1"
      />
      <ellipse className={s.flick} cx="129.5" cy="33" rx="79" ry="8" fill={url("disc")} />

      {/* Bar. */}
      <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barOff")} />
      <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barOffV")} />
      <g className={s.lit}>
        <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barOn")} />
        <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barGlow")} />
        <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barOnEnds")} />
        {/* Specular rim on the right-hand end cap. */}
        <path
          d="M251 3.4 Q256.6 12 251 20.6"
          fill="none"
          stroke="#f0c070"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
      <rect x="0" y="0" width={LAMP_W} height="24" rx="12" fill={url("barEnds")} />
      <path
        className={s.unlit}
        d="M3.2 6 Q4 1.6 9 1"
        fill="none"
        stroke="#706e71"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Pole, flaring a touch into the diffuser, with its collar at the
          base. */}
      <path d="M118.5 37 Q121 40 121 45 V562 H138 V45 Q138 40 140.5 37 Z" fill={url("poleOff")} />
      <g className={s.lit}>
        <path d="M118.5 37 Q121 40 121 45 V562 H138 V45 Q138 40 140.5 37 Z" fill={url("poleOn")} />
        {/* The top of the pole, lit by the diffuser right above it. */}
        <rect x="121" y="41" width="17" height="300" fill={url("poleTop")} />
        <rect x="132.6" y="41" width="2.8" height="519" fill={url("stripe")} />
      </g>
      <rect x="120" y="559.5" width="19" height="2.5" fill="#0d0a08" />

      {/* Base. */}
      <rect x="22" y="562" width="216" height="37" rx="18" fill={url("baseOff")} />
      <rect className={s.unlit} x="22" y="562" width="216" height="37" rx="18" fill={url("baseOffEdge")} />
      <rect className={s.lit} x="22" y="562" width="216" height="37" rx="18" fill={url("baseOn")} />
      <rect className={s.lit} x="22" y="562" width="216" height="37" rx="18" fill={url("baseEnds")} />
    </svg>
  );
}

/** The glass capsule on the end of the cord (22 x 60, design-spec A6).
    Off: amber glass round a glowing filament under a thin metal cap --
    the brightest thing in the dark room, and the thing to pull. On: the
    lower half glows cream and the cap ring warms. */
function Capsule({ uid }: { uid: string }) {
  const id = (name: string) => `${uid}-cap-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg className={s.capsuleArt} viewBox="0 0 22 60" aria-hidden>
      <defs>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#988675" />
          <stop offset="0.16" stopColor="#6e5a46" />
          <stop offset="0.5" stopColor="#4a3a2c" />
          <stop offset="0.84" stopColor="#6e5a46" />
          <stop offset="1" stopColor="#988675" />
        </linearGradient>
        <radialGradient id={id("fil")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3dc" />
          <stop offset="0.3" stopColor="#f1d6a6" />
          <stop offset="0.65" stopColor="#ac8e6e" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ac8e6e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("cap")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f1b1a" />
          <stop offset="0.5" stopColor="#2b2625" />
          <stop offset="0.82" stopColor="#cbcbcb" />
          <stop offset="1" stopColor="#4d4745" />
        </linearGradient>
        <linearGradient id={id("lit")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8984f" stopOpacity="0.85" />
          <stop offset="0.48" stopColor="#d8984f" stopOpacity="0.85" />
          <stop offset="0.56" stopColor="#feebb8" />
          <stop offset="0.8" stopColor="#fefefb" />
          <stop offset="1" stopColor="#fdf0cc" />
        </linearGradient>
        <linearGradient id={id("edge")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fdf7d3" />
          <stop offset="0.14" stopColor="#fdf7d3" stopOpacity="0" />
          <stop offset="0.82" stopColor="#fefbf3" stopOpacity="0" />
          <stop offset="1" stopColor="#fefbf3" />
        </linearGradient>
      </defs>

      {/* Off: amber glass and its filament. */}
      <rect x="0.5" y="0.5" width="21" height="59" rx="10.5" fill={url("glass")} />
      <ellipse cx="11" cy="37" rx="9" ry="14" fill={url("fil")} />
      <path
        d="M8.6 28V45M13.4 28V45M8.6 45Q11 47.6 13.4 45"
        stroke="#ffe7bd"
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
      />

      {/* On: lit glass, white edge highlights. */}
      <g className={s.flash}>
        <rect x="0.5" y="0.5" width="21" height="59" rx="10.5" fill={url("lit")} />
        <rect x="0.5" y="0.5" width="21" height="59" rx="10.5" fill={url("edge")} />
        <rect
          x="0.6"
          y="0.6"
          width="20.8"
          height="58.8"
          rx="10.4"
          fill="none"
          stroke="rgba(255, 248, 225, 0.85)"
          strokeWidth="1"
        />
      </g>

      {/* Thin metal cap ring; it warms with the light. */}
      <path d="M1.6 6 A10.5 10.5 0 0 1 20.4 6 Z" fill={url("cap")} />
      <path className={s.flash} d="M1.6 6 A10.5 10.5 0 0 1 20.4 6 Z" fill="#e4a45a" />
    </svg>
  );
}
