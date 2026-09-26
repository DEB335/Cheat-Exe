"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import styles from "./glass-scene.module.css";

type RGB = readonly [number, number, number];

// The design's palette: a blue body, cyan and teal highlights, white
// for the sparkle.
const CYAN: RGB = [34, 211, 238];
const TEAL: RGB = [94, 234, 212];
const BLUE: RGB = [59, 130, 246];
const SKY: RGB = [96, 165, 250];
const WHITE: RGB = [226, 240, 255];
const PALETTE = [CYAN, TEAL, BLUE, SKY, WHITE] as const;

/** Tiny sharp specks, mid-size glowing dots, large out-of-focus discs. */
const SPECK = 0;
const DOT = 1;
const BOKEH = 2;
type Kind = typeof SPECK | typeof DOT | typeof BOKEH;

/** How many of each, and how each kind is coloured (weights per PALETTE entry). */
const KINDS: { kind: Kind; count: number; weights: readonly number[] }[] = [
  { kind: SPECK, count: 170, weights: [0.22, 0.08, 0.2, 0.25, 0.25] },
  { kind: DOT, count: 44, weights: [0.3, 0.1, 0.3, 0.25, 0.05] },
  { kind: BOKEH, count: 18, weights: [0.25, 0.1, 0.4, 0.25, 0] },
];

/**
 * Fixed, so the field is laid out the same on every mount. Nothing here
 * may use Math.random: the card remounts on a failed sign-in (it is
 * keyed to replay its shake), and a reshuffled field would visibly jump.
 */
const SEED = 0x5eed_c0de;

/**
 * The shared clock. Every position in the field, and the phase of every
 * CSS animation on the objects, is a function of time since this moment
 * -- which is fixed when the module loads, not when the card mounts --
 * so a remount picks up exactly where the last one left off.
 */
const EPOCH = typeof performance !== "undefined" ? performance.now() : 0;

// World units are half the card's width. The field is a column of
// particles around a vertical axis through the card's centre, turning
// slowly so near ones cross one way and far ones the other.
/** Column radius. Far particles shrink, so it reaches past the card's sides. */
const FIELD_RADIUS = 1.4;
/** Camera distance; lower is a stronger perspective. */
const CAMERA = 3.2;
/** The smallest perspective scale, at the back of the column. */
const FAR_SCALE = CAMERA / (CAMERA + FIELD_RADIUS);
/** Radians per second: one turn in about a minute and three quarters. */
const SPIN = 0.06;
/** How far each particle wanders off its path, in world units. */
const SWAY = 0.05;

/** Depth of the focal plane (+ toward the viewer), and the depth either side of it that stays sharp. */
const FOCUS = 0.15;
const FOCUS_BAND = 0.55;

/** How far the field turns toward the pointer, in radians, across and down. */
const LEAN_X = 0.12;
const LEAN_Y = 0.08;
/** Rate the lean eases toward the pointer, per second. */
const LEAN_EASE = 4;

/** Overall particle brightness; they sit behind text, so they stay modest. */
const GAIN = 1.15;
/** Seconds the field takes to fade in when the page first loads. */
const FADE_IN = 1.4;
/** The moment shown, frozen, to anyone who asked for reduced motion. */
const STILL_AT = 36;

/** 30fps while settled: the drift is slow enough that more frames buy nothing. */
const IDLE_FRAME_MS = 1000 / 30;
const MAX_DPR = 2;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const TAU = Math.PI * 2;

// A heater shield in a 100 x 112 box, its right half (the shaded facet),
// and a sliver of reflection down the left edge.
const SHIELD =
  "M50 3 C61 10 74 13.5 88 13.5 Q91 13.5 91 16.5 L91 50 C91 77 74 96 50 108 C26 96 9 77 9 50 L9 16.5 Q9 13.5 12 13.5 C26 13.5 39 10 50 3 Z";
const SHIELD_RIGHT = "M50 3 C61 10 74 13.5 88 13.5 Q91 13.5 91 16.5 L91 50 C91 77 74 96 50 108 Z";
const SHIELD_SHEEN =
  "M13.5 19 Q13.5 17 15.5 17 C28 16.6 39 13.2 48 8.4 L48 12.6 C39 17.4 29 20.3 18.2 21 L18 50 C18 58 19 64.5 21 71 L16.4 71 C14.6 65 13.5 58 13.5 50 Z";

const FACES = ["front", "back", "right", "left", "top", "bottom"] as const;

interface Particle {
  kind: Kind;
  /** Distance from the spin axis, and starting angle around it. */
  radius: number;
  angle: number;
  /** Starting height as a fraction of the column, and its rise per second. */
  v: number;
  rise: number;
  /** Drawn diameter in CSS px at unit perspective scale. */
  size: number;
  alpha: number;
  /** Index into PALETTE. */
  color: number;
  phase: number;
  /** Twinkle and sway rates, radians per second. */
  twinkle: number;
  sway: number;
}

const FIELD = buildField();

/**
 * Carried across mounts along with the clock, so a remount keeps the
 * lean it had. x/y are the eased lean, tx/ty where the pointer wants it.
 */
const lean = { x: 0, y: 0, tx: 0, ty: 0 };
const shared = { revealed: false };

/**
 * The login card's decor: a 3D particle field on the glass, and three
 * glass objects -- a shield with a padlock and an orbit ring at the top
 * right, an orb on the right edge and a cube on the bottom-left corner.
 *
 * Render as the FIRST child of the card element (position: relative,
 * rounded). The particles fill the card, clipped to its corners, at
 * z-index 0 behind content the page gives `relative z-10`; the shield
 * sits at z-5 beside the heading, and the orb and cube at z-20, in front,
 * where they straddle the card's edges. Nothing else leaves the card:
 * the page's background video stays untouched.
 *
 * Decorative only: no pointer events, hidden from assistive tech, one
 * still frame for reduced motion, and the particle loop stops whenever
 * the tab is hidden or the card is off screen.
 */
export function LoginDecor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // SVG gradient ids must be unique on the page; useId's punctuation is
  // not safe inside url(#...), so keep only the plain characters.
  const uid = `gs${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Before paint: put this mount's objects on the shared clock.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    writeLean(root);

    // Marked live before anything below reads styles, so on a remount
    // the objects' very first style is already visible and there is no
    // fade to replay. (Strict Mode re-runs this on the same node, which
    // already carries data-live, so the first load still fades in.)
    if (shared.revealed && root.dataset.live === undefined) root.dataset.instant = "";
    root.dataset.live = "";
    shared.revealed = true;

    // Each CSS animation starts when its element is first styled, so a
    // remounted shield would snap back to the start of its bob. Pinning
    // every start to EPOCH makes the phase a function of the clock alone.
    const align = () => {
      for (const animation of root.getAnimations({ subtree: true })) {
        // Only the keyframe animations: the fade-in is a transition and
        // must run from now.
        if ("animationName" in animation) animation.startTime = EPOCH;
      }
    };
    align();
    // Turning reduced motion back off creates the animations afresh.
    const reduced = window.matchMedia(REDUCED_MOTION);
    reduced.addEventListener("change", align);
    return () => reduced.removeEventListener("change", align);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!root || !wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(REDUCED_MOTION);
    const sprites = getSprites();

    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let onScreen = true;

    // Drawn in the card's CSS px. offsetWidth is already that (the page
    // zoom does not enter into it), and the backing store is that times
    // the device ratio, so it stays sharp at any zoom.
    const measure = () => {
      width = Math.max(1, wrap.offsetWidth);
      height = Math.max(1, wrap.offsetHeight);
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };

    const stamp = (img: HTMLCanvasElement, x: number, y: number, d: number, alpha: number) => {
      if (alpha < 0.004 || x + d < 0 || x - d > width || y + d < 0 || y - d > height) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
    };

    /** The whole field at time t (seconds since EPOCH): nothing carries over from the last frame. */
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      // Additive, so overlapping glows bloom and draw order is irrelevant.
      ctx.globalCompositeOperation = "lighter";

      const unit = width / 2;
      const cx = width / 2;
      const cy = height / 2;
      // Tall enough that even the farthest particles span the card, plus
      // a margin so the wrap from top back to bottom happens off screen.
      const extent = height / 2 / unit / FAR_SCALE + 0.3;
      const spin = t * SPIN;
      const gain = GAIN * Math.min(1, t / FADE_IN);
      const cl = Math.cos(lean.x * LEAN_X);
      const sl = Math.sin(lean.x * LEAN_X);
      const ct = Math.cos(lean.y * LEAN_Y);
      const st = Math.sin(lean.y * LEAN_Y);

      for (const p of FIELD) {
        const a = p.angle + spin;
        const x = Math.cos(a) * p.radius + Math.sin(t * p.sway + p.phase) * SWAY;
        const z = Math.sin(a) * p.radius;
        const v = (p.v + p.rise * t) % 1;
        const y = (v * 2 - 1) * extent + Math.cos(t * p.sway * 0.8 + p.phase) * SWAY;

        // Lean toward the pointer (about the vertical, then the
        // horizontal axis), then project. Near points swing toward it.
        const x1 = x * cl + z * sl;
        const z1 = z * cl - x * sl;
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        const s = CAMERA / (CAMERA - z2);
        const px = cx + x1 * unit * s;
        const py = cy - y2 * unit * s;

        // 0 at the back of the column, 1 at the front; far is dimmer.
        const depth = clamp01((z2 + FIELD_RADIUS) / (2 * FIELD_RADIUS));
        // Circle of confusion: distance from the focal plane.
        const coc = Math.abs(z2 - FOCUS);
        const fade = clamp01(Math.min(v, 1 - v) * 14) * gain;
        const set = sprites[p.color]!;

        if (p.kind === SPECK) {
          const tw = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 3);
          // Out of focus, a speck spreads into a larger, fainter disc.
          const blur = Math.min(1.3, Math.max(0, coc - FOCUS_BAND) * 2.4);
          const alpha = (p.alpha * (0.3 + 0.7 * tw * tw) * (0.45 + 0.55 * depth)) / (1 + blur * 0.7);
          stamp(blur > 0.5 ? set.soft : set.sharp, px, py, p.size * s * (1 + blur), alpha * fade);
        } else if (p.kind === DOT) {
          const tw = 0.75 + 0.25 * Math.sin(t * p.twinkle + p.phase);
          const blur = Math.max(0, coc - FOCUS_BAND) * 2;
          const d = p.size * s;
          const alpha = p.alpha * tw * (0.45 + 0.55 * depth) * fade;
          stamp(set.soft, px, py, d * (3.2 + blur * 1.6), (alpha * 0.6) / (1 + blur * 0.5));
          if (blur < 0.9) stamp(set.sharp, px, py, d * 1.6, alpha * (1 - blur / 0.9));
        } else {
          const pulse = 0.8 + 0.2 * Math.sin(t * p.twinkle + p.phase);
          const d = p.size * s * (0.7 + coc * 0.6);
          stamp(set.bokeh, px, py, d, p.alpha * pulse * (0.55 + 0.45 * depth) * fade);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const render = () => draw(reduced.matches ? STILL_AT : (performance.now() - EPOCH) / 1000);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;

      const k = 1 - Math.exp(-dt * LEAN_EASE);
      lean.x += (lean.tx - lean.x) * k;
      lean.y += (lean.ty - lean.y) * k;
      const easing = Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) > 0.002;
      if (easing) writeLean(root);

      // Full rate only while the lean is catching up with the pointer.
      if (!easing && now - lastDraw < IDLE_FRAME_MS) return;
      lastDraw = now;
      draw((now - EPOCH) / 1000);
    };

    const start = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const sync = () => {
      if (reduced.matches) {
        lean.x = lean.y = lean.tx = lean.ty = 0;
        writeLean(root);
      }
      if (onScreen && !document.hidden && !reduced.matches) start();
      else {
        stop();
        render();
      }
    };

    // Only fractions of the card's box are used here. The rect and the
    // pointer are both real screen px, so the page zoom cancels out of
    // the ratio and pageZoom() is not needed.
    const onMove = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType === "touch") return;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      lean.tx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      lean.ty = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    };

    const onLeave = () => {
      lean.tx = 0;
      lean.ty = 0;
    };

    const onResize = () => {
      measure();
      render();
    };

    const resize = new ResizeObserver(onResize);
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      sync();
    });

    measure();
    render();
    resize.observe(wrap);
    visible.observe(wrap);
    // A browser zoom changes the device ratio without resizing the card.
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();

    return () => {
      stop();
      resize.disconnect();
      visible.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return (
    // display: contents, so each layer is positioned against the card
    // itself; the radius is inherited through it so the particle clip
    // can inherit the card's corners in turn.
    <div ref={rootRef} aria-hidden className={cn("pointer-events-none contents rounded-[inherit]", styles.root)}>
      <div ref={wrapRef} className={cn("absolute inset-0 z-0 overflow-hidden rounded-[inherit]", styles.particles)}>
        <canvas ref={canvasRef} className="block size-full" />
      </div>
      <GlassShield uid={uid} />
      <GlassOrb />
      <GlassCube />
    </div>
  );
}

/**
 * Translucent shield with a glowing padlock and an orbit ring. Three
 * stacked outlines give the glass its thickness, the padlock floats
 * 15px in front of it, and the ring is split into far and near halves
 * drawn behind and in front of the shield.
 */
function GlassShield({ uid }: { uid: string }) {
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <div className={cn(styles.object, styles.shield)}>
      <div className={styles.shieldFloat}>
        <div className={styles.shieldHalo} />
        <OrbitRing className={styles.ringBack} />
        <div className={styles.stage}>
          <div className={styles.lean}>
            <div className={styles.shieldBody}>
              <svg className={styles.plateBack} viewBox="0 0 100 112">
                <path d={SHIELD} fill="#1d4ed8" fillOpacity="0.2" stroke="#60a5fa" strokeOpacity="0.4" strokeWidth="1.6" />
              </svg>
              <svg className={styles.plateMid} viewBox="0 0 100 112">
                <path d={SHIELD} fill="none" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="1.4" />
              </svg>
              <svg className={styles.plateFront} viewBox="0 0 100 112">
                <defs>
                  <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#bfdbfe" stopOpacity="0.42" />
                    <stop offset="0.45" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="1" stopColor="#1e40af" stopOpacity="0.42" />
                  </linearGradient>
                  <linearGradient id={id("rim")} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor="#f0f9ff" />
                    <stop offset="0.35" stopColor="#7dd3fc" />
                    <stop offset="0.7" stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                  <linearGradient id={id("sheen")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id={id("core")}>
                    <stop offset="0" stopColor="#38bdf8" stopOpacity="0.38" />
                    <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
                  </radialGradient>
                  <filter id={id("bloom")} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.4" />
                  </filter>
                </defs>
                <path d={SHIELD} fill={url("body")} />
                <path d={SHIELD_RIGHT} fill="#1e3a8a" fillOpacity="0.24" />
                <ellipse cx="50" cy="56" rx="34" ry="38" fill={url("core")} />
                <path d="M50 8 V104" stroke="#e0f2fe" strokeOpacity="0.2" strokeWidth="0.8" />
                <path d={SHIELD_SHEEN} fill={url("sheen")} opacity="0.55" />
                <path
                  d={SHIELD}
                  transform="translate(50 57) scale(0.82) translate(-50 -57)"
                  fill="none"
                  stroke="#bae6fd"
                  strokeOpacity="0.42"
                  strokeWidth="1.1"
                />
                {/* Rim light: a blurred bloom under a crisp gradient edge. */}
                <path d={SHIELD} fill="none" stroke="#38bdf8" strokeWidth="3.4" filter={url("bloom")} />
                <path d={SHIELD} fill="none" stroke={url("rim")} strokeWidth="2.2" strokeLinejoin="round" />
              </svg>
              <div className={styles.lockGlow} />
              <svg className={styles.lock} viewBox="0 0 40 46">
                <defs>
                  <linearGradient id={id("lock")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#93c5fd" />
                    <stop offset="0.5" stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id={id("shackle")} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#e0f2fe" />
                    <stop offset="0.5" stopColor="#7dd3fc" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id={id("gloss")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <filter id={id("glow")} x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="#38bdf8" floodOpacity="0.95" />
                  </filter>
                </defs>
                <g filter={url("glow")}>
                  <path
                    d="M12 21 V14.5 A8 8 0 0 1 28 14.5 V21"
                    fill="none"
                    stroke={url("shackle")}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <rect
                    x="6"
                    y="19.5"
                    width="28"
                    height="23"
                    rx="6"
                    fill={url("lock")}
                    fillOpacity="0.92"
                    stroke="#dbeafe"
                    strokeOpacity="0.9"
                    strokeWidth="1"
                  />
                </g>
                <rect x="8.5" y="21" width="23" height="8" rx="4" fill={url("gloss")} />
                <circle cx="20" cy="29.5" r="3.3" fill="#0b2a66" />
                <path d="M18.4 31 H21.6 L22.3 37 H17.7 Z" fill="#0b2a66" />
                <circle cx="20" cy="29.5" r="3.3" fill="none" stroke="#7dd3fc" strokeOpacity="0.55" strokeWidth="0.6" />
              </svg>
            </div>
          </div>
        </div>
        <OrbitRing className={styles.ringFront} />
      </div>
    </div>
  );
}

/** One half of the orbit ring: the line plus the comet running around it. */
function OrbitRing({ className }: { className: string | undefined }) {
  return (
    <div className={cn(styles.ringWrap, className)}>
      <div className={styles.lean}>
        <div className={styles.ring}>
          <div className={styles.ringLine} />
          <div className={styles.comet} />
        </div>
      </div>
    </div>
  );
}

/**
 * A clear glass bubble: nearly transparent in the middle and bright at
 * the rim, a specular highlight top left, the caustic glow it focuses
 * bottom right, and slow refracted colour turning inside it.
 */
function GlassOrb() {
  return (
    <div className={cn(styles.object, styles.orb)}>
      <div className={styles.orbFloat}>
        <div className={styles.orbLean}>
          <div className={styles.orbHalo} />
          <div className={styles.orbBody}>
            <div className={styles.orbSwirl} />
            <div className={styles.orbCaustic} />
            <div className={styles.orbRim} />
            <div className={styles.orbWindow} />
            <div className={styles.orbSpecular} />
            <div className={styles.orbGlint} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A real CSS 3D cube: six translucent faces with glowing edges and a light at its core. */
function GlassCube() {
  return (
    <div className={cn(styles.object, styles.cube)}>
      <div className={styles.cubeFloor} />
      <div className={styles.cubeFloat}>
        <div className={styles.cubeHalo} />
        <div className={styles.cubeStage}>
          <div className={styles.lean}>
            <div className={styles.cubeCore} />
            <div className={styles.cubeSpin}>
              {FACES.map((face) => (
                <div key={face} className={cn(styles.face, styles[face])} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function writeLean(root: HTMLElement) {
  root.style.setProperty("--lx", lean.x.toFixed(3));
  root.style.setProperty("--ly", lean.y.toFixed(3));
}

/** The particle field, laid out once from SEED. */
function buildField(): Particle[] {
  const rand = mulberry32(SEED);
  const field: Particle[] = [];
  for (const { kind, count, weights } of KINDS) {
    for (let i = 0; i < count; i++) {
      const bokeh = kind === BOKEH;
      field.push({
        kind,
        // Bokeh keep to the outside of the column, so turning carries
        // them from the far side (small) to right up close (huge).
        radius: FIELD_RADIUS * (bokeh ? 0.55 + 0.45 * rand() : Math.sqrt(rand())),
        angle: rand() * TAU,
        v: rand(),
        rise: (bokeh ? 0.002 : 0.004) + rand() * 0.008,
        size: kind === SPECK ? 3.5 + rand() * 4.5 : kind === DOT ? 3.5 + rand() * 3 : 18 + rand() * 30,
        alpha: kind === SPECK ? 0.6 + rand() * 0.4 : kind === DOT ? 0.6 + rand() * 0.4 : 0.07 + rand() * 0.09,
        color: pickWeighted(rand(), weights),
        phase: rand() * TAU,
        twinkle: bokeh ? 0.3 + rand() * 0.4 : 0.8 + rand() * 2.6,
        sway: 0.15 + rand() * 0.35,
      });
    }
  }
  return field;
}

/** Small, fast, seedable PRNG: the same seed always yields the same field. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(r: number, weights: readonly number[]) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = r * total;
  for (let i = 0; i < weights.length; i++) {
    at -= weights[i]!;
    if (at < 0) return i;
  }
  return weights.length - 1;
}

interface SpriteSet {
  sharp: HTMLCanvasElement;
  soft: HTMLCanvasElement;
  bokeh: HTMLCanvasElement;
}

let spriteCache: SpriteSet[] | null = null;

/**
 * Glows rendered once per colour and stamped with drawImage, which is
 * far cheaper than a gradient or shadowBlur per particle per frame.
 */
function getSprites(): SpriteSet[] {
  spriteCache ??= PALETTE.map((c) => {
    const hot = lighten(c, 0.6);
    return {
      // A white-hot pinpoint with a thin halo.
      sharp: sprite(32, [
        [0, "rgba(255, 255, 255, 1)"],
        [0.18, rgba(hot, 1)],
        [0.42, rgba(c, 0.38)],
        [0.7, rgba(c, 0.1)],
        [1, rgba(c, 0)],
      ]),
      // The same light, defocused.
      soft: sprite(64, [
        [0, rgba(hot, 0.8)],
        [0.3, rgba(c, 0.45)],
        [0.62, rgba(c, 0.12)],
        [1, rgba(c, 0)],
      ]),
      // A lens bokeh disc: flat, with the faintly brighter rim real ones have.
      bokeh: sprite(96, [
        [0, rgba(c, 0.62)],
        [0.55, rgba(c, 0.6)],
        [0.8, rgba(hot, 0.72)],
        [0.9, rgba(c, 0.3)],
        [1, rgba(c, 0)],
      ]),
    };
  });
  return spriteCache;
}

function sprite(size: number, stops: readonly (readonly [number, string])[]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  if (c) {
    const r = size / 2;
    const grad = c.createRadialGradient(r, r, 0, r, r, r);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
  }
  return canvas;
}

function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function lighten([r, g, b]: RGB, amount: number): RGB {
  return [Math.round(r + (255 - r) * amount), Math.round(g + (255 - g) * amount), Math.round(b + (255 - b) * amount)];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
