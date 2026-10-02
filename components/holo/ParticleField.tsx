"use client";

import { useEffect, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { pageZoom } from "@/lib/zoom";

import { findPointerHost, REDUCED_MOTION } from "./hooks";
import { lighten, mix, PALETTES, resolvePalette, type PaletteInput, type PaletteName, type RGB } from "./palettes";

/*
 * A 3D particle volume on a canvas, for the holograms' sparkle: tiny
 * sharp specks, glowing dots, four-point star glints that flash, and a
 * few big out-of-focus bokeh discs. Everything is placed in a small 3D
 * world, turned, and projected, so near particles are bigger, brighter
 * and cross faster than far ones, and anything off the focal plane
 * spreads into a softer disc.
 *
 * The drawing follows the old login card's particle field: positions
 * are a pure function of a shared clock, so
 * two fields with the same props -- a stage's back and front layers --
 * stay in lockstep without talking to each other; every glow is a
 * sprite rendered once and stamped with drawImage; and nothing uses
 * Math.random, so the layout is the same on every mount.
 */

export type FieldShape = "orbit" | "column" | "dome";
export type FieldLayer = "all" | "back" | "front";

export interface ParticleFieldProps {
  /** A named palette or the particle colours themselves. Default "aurora". */
  palette?: PaletteInput;
  /** Particle count multiplier. 1 suits a ~420x300 hero box. */
  density?: number;
  /**
   * "orbit": a thick swirl circling the centre on tilted ellipses.
   * "column": a slowly turning cylinder of motes drifting upward.
   * "dome": a turning sphere shell around the centre.
   */
  shape?: FieldShape;
  /** Centre of the field as fractions of the box. Ignored when anchorRef is set. */
  cx?: number;
  cy?: number;
  /** Centre the field on this element instead (measured on resize). */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Field radius as a fraction of the box's shorter side. */
  radius?: number;
  /** Vertical spread of the orbit cloud, as a multiple of its default thickness. */
  spread?: number;
  /** Motion speed multiplier. */
  speed?: number;
  /** How far the field turns toward the pointer; 0 turns the lean off. */
  lean?: number;
  /**
   * Which depth slice to draw: "back" is everything behind the centre
   * plane and "front" everything before it, so a stage can put a
   * floating object between two fields. Particles crossing the plane
   * cross-fade between the two, so the seam never shows.
   */
  layer?: FieldLayer;
  /** Element whose pointer drives the lean and the full frame rate. Defaults to the nearest ancestor that takes the pointer. */
  hostRef?: RefObject<HTMLElement | null>;
  /** Layout seed; two fields with the same props and seed draw the same particles. */
  seed?: number;
  /**
   * Fade the particles out toward the box's edges, so a field smaller
   * than its panel has no visible rectangle round it.
   */
  edgeFade?: boolean;
  className?: string;
}

const SPECK = 0;
const DOT = 1;
const STAR = 2;
const BOKEH = 3;
type Kind = typeof SPECK | typeof DOT | typeof STAR | typeof BOKEH;

interface Particle {
  kind: Kind;
  /** Screen-filling dust rather than part of the shape. */
  ambient: boolean;
  /** Orbit/shell/column radius in world units. */
  r: number;
  /** Starting angle about the vertical axis. */
  a: number;
  /** Orbit: height off the orbit plane. Dome: height on the unit sphere. */
  h: number;
  /** Orbit: extra inclination of this particle's orbit plane. */
  incl: number;
  /** Angular speed factor (inner orbits run faster). */
  spin: number;
  /** Column/ambient: starting height fraction and rise per second. */
  v: number;
  rise: number;
  /** Ambient: across-fraction and depth (-1 far .. 1 near). */
  u: number;
  d: number;
  /** Drawn diameter in CSS px at unit perspective scale. */
  size: number;
  alpha: number;
  /** Index into the colour list; the last entry is the palette's white-hot. */
  color: number;
  phase: number;
  twinkle: number;
  sway: number;
}

/**
 * The shared clock. Fixed when the module loads, so every field on the
 * page -- and both layers of a stage -- read the same time.
 */
const EPOCH = typeof performance !== "undefined" ? performance.now() : 0;

/** Camera distance in world units; lower is a stronger perspective. */
const CAMERA = 3.2;
/** Radians per second for each shape's turn. */
const SPIN_ORBIT = 0.22;
const SPIN_COLUMN = 0.07;
const SPIN_DOME = 0.09;
/** How far above the orbit plane the camera looks down, in radians. */
const VIEW_TILT = 0.34;
/** How far each particle wanders off its path, in world units. */
const SWAY = 0.04;
/** Depth of the focal plane (+ toward the viewer), and the depth either side that stays sharp. */
const FOCUS = 0.1;
const FOCUS_BAND = 0.55;
/** Full lean, in radians: across (about the vertical) and down (about the horizontal). */
const LEAN_X = 0.34;
const LEAN_Y = 0.2;
const LEAN_EASE = 4;
/** Ambient dust parallax at full lean, CSS px per unit of depth. */
const PARALLAX = 14;
/** Seconds to fade in on mount. */
const FADE_IN = 0.9;
/** The moment shown, frozen, to anyone who asked for reduced motion. */
const STILL_AT = 21;
/** Depth band either side of the centre plane over which layers cross-fade. */
const SEAM = 0.14;
/** Extra brightness while the pointer is over the host. */
const HOVER_GAIN = 0.3;

/** 30fps while settled: the drift is slow enough that more frames buy nothing. */
const IDLE_FRAME_MS = 1000 / 30;
const MAX_DPR = 2;
const TAU = Math.PI * 2;

/** Base counts per shape at density 1: [specks, dots, stars, bokeh], then ambient [specks, dots, stars]. */
const COUNTS: Record<FieldShape, { body: [number, number, number, number]; dust: [number, number, number] }> = {
  orbit: { body: [120, 30, 12, 7], dust: [30, 5, 6] },
  column: { body: [130, 30, 12, 7], dust: [22, 4, 5] },
  dome: { body: [150, 26, 12, 6], dust: [28, 4, 6] },
};

/** Share of each kind drawn in the palette's white-hot rather than a colour. */
const HOT_SHARE: Record<Kind, number> = { [SPECK]: 0.3, [DOT]: 0.1, [STAR]: 0.45, [BOKEH]: 0 };

export function ParticleField({
  palette = "aurora",
  density = 1,
  shape = "orbit",
  cx = 0.5,
  cy = 0.5,
  anchorRef,
  radius = 0.46,
  spread = 1,
  speed = 1,
  lean = 1,
  layer = "all",
  hostRef,
  seed = 0x401d_5eed,
  edgeFade = false,
  className,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // An inline array would be a new object every render; key the effect
  // on the colours themselves.
  const paletteKey = typeof palette === "string" ? palette : palette.map((c) => c.join(",")).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const host = hostRef?.current ?? findPointerHost(canvas);
    const reduced = window.matchMedia(REDUCED_MOTION);

    const pal = resolvePalette(paletteKey in PALETTES ? (paletteKey as PaletteName) : paletteFromKey(paletteKey));
    const colors: RGB[] = [...pal.particles, pal.hot];
    const field = buildField(shape, density, seed, pal.particles.length, spread);

    let width = 1;
    let height = 1;
    let ox = 0;
    let oy = 0;
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let onScreen = true;
    const born = performance.now();

    // Pointer state: where it is (real screen px), whether it is over
    // the host, and the eased lean (-1..1) toward it.
    const pointer = { x: 0, y: 0, dirty: false };
    let hovered = false;
    let energy = 0;
    let leanX = 0;
    let leanY = 0;
    let targetX = 0;
    let targetY = 0;

    // Drawn in the box's CSS px. offsetWidth is that whatever the page
    // zoom or any hover transform on the panel; the backing store is the
    // real on-screen size (CSS px x zoom) times the device ratio, so it
    // is exactly as sharp as the screen and no bigger.
    const measure = () => {
      width = Math.max(1, canvas.offsetWidth);
      height = Math.max(1, canvas.offsetHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const zoom = pageZoom();
      canvas.width = Math.max(1, Math.round(width * zoom * dpr));
      canvas.height = Math.max(1, Math.round(height * zoom * dpr));
      ox = width * cx;
      oy = height * cy;
      const anchor = anchorRef?.current;
      if (anchor) {
        // Both rects are real px; as fractions of the canvas the zoom cancels.
        const box = canvas.getBoundingClientRect();
        const at = anchor.getBoundingClientRect();
        if (box.width && box.height) {
          ox = ((at.left + at.width / 2 - box.left) / box.width) * width;
          oy = ((at.top + at.height / 2 - box.top) / box.height) * height;
        }
      }
    };

    const stamp = (img: HTMLCanvasElement, x: number, y: number, d: number, alpha: number) => {
      if (alpha < 0.004 || x + d < 0 || x - d > width || y + d < 0 || y - d > height) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
    };

    /** The whole field at time t (seconds): nothing carries over from the last frame. */
    const draw = (t: number, fade: number) => {
      const light = document.body.classList.contains("light-mode");
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      // Additive on the dark glass, so overlapping glows bloom. On the
      // pale light-mode glass additive light would vanish into white, so
      // the particles are painted as plain colour instead.
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";

      const sprites = colors.map((c) => getSprites(c, light));
      const U = radius * Math.min(width, height);
      const m = t * speed;
      const gain = fade * (1 + HOVER_GAIN * energy) * (light ? 0.8 : 1);

      const yaw = leanX * LEAN_X * lean;
      const pitch = (shape === "column" ? 0.04 : shape === "dome" ? VIEW_TILT * 0.6 : VIEW_TILT) + leanY * LEAN_Y * lean;
      const cl = Math.cos(yaw);
      const sl = Math.sin(yaw);
      const ct = Math.cos(pitch);
      const st = Math.sin(pitch);
      // How far the column must reach, above and below the centre, for
      // even its farthest (smallest) motes to span the box.
      const reach = Math.max(oy, height - oy) / U / (CAMERA / (CAMERA + 1.2)) + 0.25;

      for (const p of field) {
        let x: number;
        let y: number;
        let z: number;
        let edge = 1;

        if (p.ambient) {
          // Dust: laid out across the whole box rather than in the
          // shape, rising slowly, with parallax by depth.
          const v = (((p.v - p.rise * m) % 1) + 1) % 1;
          const px = p.u * width + leanX * lean * p.d * PARALLAX;
          const py = v * (height + 24) - 12;
          edge = clamp01(Math.min(v, 1 - v) * 12);
          drawOne(p, px, py, 1 + p.d * 0.22, p.d, t, gain * edge, sprites[p.color]!, light);
          continue;
        }

        if (shape === "orbit") {
          const a = p.a + m * SPIN_ORBIT * p.spin;
          const ox0 = Math.cos(a) * p.r;
          const oz0 = Math.sin(a) * p.r;
          const oy0 = p.h + Math.sin(t * p.sway + p.phase) * SWAY;
          const ci = Math.cos(p.incl);
          const si = Math.sin(p.incl);
          x = ox0;
          y = oy0 * ci - oz0 * si;
          z = oy0 * si + oz0 * ci;
        } else if (shape === "column") {
          const a = p.a + m * SPIN_COLUMN;
          const v = (p.v + p.rise * m) % 1;
          x = Math.cos(a) * p.r + Math.sin(t * p.sway + p.phase) * SWAY;
          z = Math.sin(a) * p.r;
          y = (v * 2 - 1) * reach;
          edge = clamp01(Math.min(v, 1 - v) * 10);
        } else {
          const a = p.a + m * SPIN_DOME;
          const ring = Math.sqrt(Math.max(0, 1 - p.h * p.h)) * p.r;
          x = Math.cos(a) * ring;
          z = Math.sin(a) * ring;
          y = p.h * p.r + Math.sin(t * p.sway + p.phase) * SWAY * 0.5;
        }

        // Turn toward the pointer about the vertical, then look down
        // (plus the pointer's pitch) about the horizontal, then project.
        const x1 = x * cl + z * sl;
        const z1 = z * cl - x * sl;
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        const s = CAMERA / (CAMERA - z2);
        drawOne(p, ox + x1 * U * s, oy - y2 * U * s, s, z2, t, gain * edge, sprites[p.color]!, light);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    /** One particle at screen (px, py), perspective scale s, depth z (+ near). */
    const drawOne = (
      p: Particle,
      px: number,
      py: number,
      s: number,
      z: number,
      t: number,
      gain: number,
      set: SpriteSet,
      light: boolean,
    ) => {
      // Which layer owns it: a smooth split across the centre plane, so
      // the back and front fields sum to one particle as it crosses.
      const front = smoothstep(-SEAM, SEAM, z);
      const share = layer === "all" ? 1 : layer === "front" ? front : 1 - front;
      if (share < 0.01) return;
      const depth = clamp01((z + 1.3) / 2.6);
      const coc = Math.abs(z - FOCUS);
      const g = gain * share;

      if (p.kind === SPECK) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 3);
        // Out of focus, a speck spreads into a larger, fainter disc.
        const blur = Math.min(1.3, Math.max(0, coc - FOCUS_BAND) * 2.4);
        const alpha = (p.alpha * (0.3 + 0.7 * tw * tw) * (0.4 + 0.6 * depth)) / (1 + blur * 0.7);
        stamp(blur > 0.5 ? set.soft : set.sharp, px, py, p.size * s * (1 + blur), alpha * g);
      } else if (p.kind === DOT) {
        const tw = 0.75 + 0.25 * Math.sin(t * p.twinkle + p.phase);
        const blur = Math.max(0, coc - FOCUS_BAND) * 2;
        const d = p.size * s;
        const alpha = p.alpha * tw * (0.45 + 0.55 * depth) * g;
        stamp(set.soft, px, py, d * (3.4 + blur * 1.6), (alpha * 0.6) / (1 + blur * 0.5));
        if (blur < 0.9) stamp(set.sharp, px, py, d * 1.6, alpha * (1 - blur / 0.9));
      } else if (p.kind === STAR) {
        // Mostly a faint point, flaring into a cross every few seconds.
        const w = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
        const flare = w * w * w * w;
        const alpha = p.alpha * (0.35 + 0.65 * depth) * g;
        stamp(set.star, px, py, p.size * s * (0.45 + 0.95 * flare), alpha * (0.3 + 0.7 * flare));
        stamp(set.sharp, px, py, 5 * s, alpha);
      } else {
        const pulse = 0.8 + 0.2 * Math.sin(t * p.twinkle + p.phase);
        const d = p.size * s * (0.7 + coc * 0.6);
        stamp(set.bokeh, px, py, d, p.alpha * pulse * (0.55 + 0.45 * depth) * g * (light ? 0.5 : 1));
      }
    };

    const clock = (now: number) => (now - EPOCH) / 1000;
    const render = () => draw(reduced.matches ? STILL_AT : clock(performance.now()), 1);

    // The pointer's position is only turned into a lean inside the
    // frame, so a burst of pointer events costs at most one layout read.
    const aim = () => {
      pointer.dirty = false;
      if (!hovered) {
        targetX = targetY = 0;
        return;
      }
      const box = canvas.getBoundingClientRect();
      const area = host.getBoundingClientRect();
      if (!box.width || !area.width || !area.height) return;
      const fx = box.left + (ox / width) * box.width;
      const fy = box.top + (oy / height) * box.height;
      targetX = clamp((pointer.x - fx) / (area.width / 2));
      targetY = clamp((pointer.y - fy) / (area.height / 2));
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;

      if (pointer.dirty) aim();
      const k = 1 - Math.exp(-dt * LEAN_EASE);
      leanX += (targetX - leanX) * k;
      leanY += (targetY - leanY) * k;
      energy += ((hovered ? 1 : 0) - energy) * k;
      const easing =
        Math.abs(targetX - leanX) + Math.abs(targetY - leanY) > 0.002 || Math.abs((hovered ? 1 : 0) - energy) > 0.01;
      const fade = Math.min(1, (now - born) / 1000 / FADE_IN);

      // Full rate while pointed at or settling; 30fps once idle.
      if (!hovered && !easing && fade >= 1 && now - lastDraw < IDLE_FRAME_MS) return;
      lastDraw = now;
      draw(clock(now), fade);
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
      if (reduced.matches) leanX = leanY = targetX = targetY = energy = 0;
      if (onScreen && !document.hidden && !reduced.matches) start();
      else {
        stop();
        render();
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduced.matches || lean === 0) return;
      hovered = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.dirty = true;
    };
    const onLeave = () => {
      hovered = false;
      pointer.dirty = true;
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
    resize.observe(canvas);
    if (anchorRef?.current) resize.observe(anchorRef.current);
    visible.observe(canvas);
    // Crossing the zoom breakpoint, or a browser zoom, changes the real
    // size without always changing the CSS size the observer watches.
    window.addEventListener("resize", onResize);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();

    return () => {
      stop();
      resize.disconnect();
      visible.disconnect();
      window.removeEventListener("resize", onResize);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [paletteKey, density, shape, cx, cy, anchorRef, radius, spread, speed, lean, layer, hostRef, seed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 block size-full", className)}
      style={edgeFade ? EDGE_FADE : undefined}
    />
  );
}

// A static mask: the compositor applies it, the canvas never redraws for it.
const EDGE_FADE_MASK = "radial-gradient(farthest-side, #000 58%, transparent)";
const EDGE_FADE = { WebkitMaskImage: EDGE_FADE_MASK, maskImage: EDGE_FADE_MASK } as const;

/**
 * Rebuilds an RGB list from paletteKey. The effect works from the key
 * alone, so an inline palette array (a new object every render) never
 * restarts the loop.
 */
function paletteFromKey(key: string): RGB[] {
  return key.split("|").map((c) => {
    const [r = 0, g = 0, b = 0] = c.split(",").map(Number);
    return [r, g, b] as const;
  });
}

/** The field, laid out once from the seed. */
function buildField(shape: FieldShape, density: number, seed: number, colorCount: number, spread: number): Particle[] {
  const rand = mulberry32(seed);
  const field: Particle[] = [];
  const { body, dust } = COUNTS[shape];
  const n = (count: number) => Math.round(count * Math.max(0, density));

  const color = (kind: Kind) => (rand() < HOT_SHARE[kind] ? colorCount : Math.floor(rand() * colorCount));
  const look = (kind: Kind) => ({
    size:
      kind === SPECK ? 3 + rand() * 4 : kind === DOT ? 3 + rand() * 3 : kind === STAR ? 16 + rand() * 16 : 20 + rand() * 34,
    alpha:
      kind === SPECK
        ? 0.55 + rand() * 0.45
        : kind === DOT
          ? 0.6 + rand() * 0.4
          : kind === STAR
            ? 0.7 + rand() * 0.3
            : 0.06 + rand() * 0.08,
    color: color(kind),
    phase: rand() * TAU,
    twinkle: kind === BOKEH ? 0.3 + rand() * 0.4 : kind === STAR ? 0.5 + rand() * 1.1 : 0.8 + rand() * 2.6,
    sway: 0.15 + rand() * 0.35,
  });

  const kinds: Kind[] = [SPECK, DOT, STAR, BOKEH];
  kinds.forEach((kind, i) => {
    for (let j = 0; j < n(body[i]!); j++) {
      const bokeh = kind === BOKEH;
      let r: number;
      let h = 0;
      let incl = 0;
      if (shape === "orbit") {
        // A thick band: most particles between 0.55 and 1.25 of the
        // radius, a few strays well inside or out, and bokeh out at the
        // edge so the turn swings them right up to the lens.
        r = bokeh ? 1.05 + rand() * 0.35 : 0.5 + Math.pow(rand(), 0.8) * 0.8;
        h = gaussian(rand) * 0.3 * spread;
        incl = gaussian(rand) * 0.22;
      } else if (shape === "column") {
        r = bokeh ? 0.75 + rand() * 0.45 : 1.15 * Math.sqrt(rand());
      } else {
        r = bokeh ? 1.1 + rand() * 0.25 : 0.88 + rand() * 0.24;
        h = rand() * 2 - 1;
      }
      field.push({
        kind,
        ambient: false,
        r,
        a: rand() * TAU,
        h,
        incl,
        spin: 0.75 + 0.45 / Math.max(0.5, r),
        v: rand(),
        rise: (bokeh ? 0.004 : 0.008) + rand() * 0.012,
        u: 0,
        d: 0,
        ...look(kind),
      });
    }
  });

  const dustKinds: Kind[] = [SPECK, DOT, STAR];
  dustKinds.forEach((kind, i) => {
    for (let j = 0; j < n(dust[i]!); j++) {
      field.push({
        kind,
        ambient: true,
        r: 0,
        a: 0,
        h: 0,
        incl: 0,
        spin: 0,
        v: rand(),
        rise: 0.006 + rand() * 0.01,
        u: rand(),
        d: rand() * 2 - 1,
        ...look(kind),
      });
    }
  });

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

/** Roughly normal, -3..3: the sum of three uniforms, recentred. */
function gaussian(rand: () => number) {
  return (rand() + rand() + rand() - 1.5) * 2;
}

interface SpriteSet {
  sharp: HTMLCanvasElement;
  soft: HTMLCanvasElement;
  bokeh: HTMLCanvasElement;
  star: HTMLCanvasElement;
}

const spriteCache = new Map<string, SpriteSet>();

/**
 * Glows rendered once per colour (and theme) and stamped with drawImage,
 * which is far cheaper than a gradient or shadowBlur per particle per
 * frame. The light-mode set swaps the white-hot cores for the colour
 * itself: white on the pale glass would simply disappear.
 */
function getSprites(c: RGB, light: boolean): SpriteSet {
  const key = `${c.join(",")}${light ? "L" : "D"}`;
  let set = spriteCache.get(key);
  if (set) return set;
  const hot = light ? mix(c, [20, 16, 60], 0.15) : lighten(c, 0.6);
  const core = light ? hot : ([255, 255, 255] as const);
  set = {
    // A white-hot pinpoint with a thin halo.
    sharp: radial(32, [
      [0, rgba(core, 1)],
      [0.18, rgba(hot, 1)],
      [0.42, rgba(c, 0.38)],
      [0.7, rgba(c, 0.1)],
      [1, rgba(c, 0)],
    ]),
    // The same light, defocused.
    soft: radial(64, [
      [0, rgba(hot, 0.8)],
      [0.3, rgba(c, 0.45)],
      [0.62, rgba(c, 0.12)],
      [1, rgba(c, 0)],
    ]),
    // A lens bokeh disc: flat, with the faintly brighter rim real ones have.
    bokeh: radial(96, [
      [0, rgba(c, 0.62)],
      [0.55, rgba(c, 0.6)],
      [0.8, rgba(hot, 0.72)],
      [0.9, rgba(c, 0.3)],
      [1, rgba(c, 0)],
    ]),
    star: starSprite(c, hot, core),
  };
  spriteCache.set(key, set);
  return set;
}

function radial(size: number, stops: readonly (readonly [number, string])[]) {
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

/** A four-point glint: a small halo crossed by two long, tapering spikes. */
function starSprite(c: RGB, hot: RGB, core: RGB) {
  const size = 96;
  const r = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.globalCompositeOperation = "lighter";

  const halo = g.createRadialGradient(r, r, 0, r, r, r * 0.42);
  halo.addColorStop(0, rgba(core, 0.95));
  halo.addColorStop(0.2, rgba(hot, 0.6));
  halo.addColorStop(0.55, rgba(c, 0.16));
  halo.addColorStop(1, rgba(c, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  for (const vertical of [false, true]) {
    const spike = vertical ? g.createLinearGradient(r, 0, r, size) : g.createLinearGradient(0, r, size, r);
    spike.addColorStop(0, rgba(c, 0));
    spike.addColorStop(0.32, rgba(c, 0.35));
    spike.addColorStop(0.5, rgba(core, 1));
    spike.addColorStop(0.68, rgba(c, 0.35));
    spike.addColorStop(1, rgba(c, 0));
    g.fillStyle = spike;
    g.beginPath();
    const w = 1.7;
    if (vertical) {
      g.moveTo(r, 0);
      g.lineTo(r + w, r);
      g.lineTo(r, size);
      g.lineTo(r - w, r);
    } else {
      g.moveTo(0, r);
      g.lineTo(r, r - w);
      g.lineTo(size, r);
      g.lineTo(r, r + w);
    }
    g.closePath();
    g.fill();
  }
  return canvas;
}

function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function clamp(v: number) {
  return Math.min(1, Math.max(-1, v));
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(lo: number, hi: number, v: number) {
  const x = clamp01((v - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
}
