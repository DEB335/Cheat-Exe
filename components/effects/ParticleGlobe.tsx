"use client";

import { useEffect, useRef } from "react";

import { onFrame } from "@/components/holo/hooks";
import { cn } from "@/lib/utils";
import { pageZoom } from "@/lib/zoom";

type Vec3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

const PINK: RGB = [255, 79, 163];
const VIOLET: RGB = [155, 107, 255];
const BLUE: RGB = [96, 134, 255];

/** Surface points. Enough to read as a lattice, few enough to stay cheap. */
const POINTS = 320;
/** Every Nth point is a network hub, wired to its three nearest hubs. */
const HUB_EVERY = 11;

/** Radians per second: an idle drift, and the pace while pointed at. */
const SPIN_IDLE = 0.14;
const SPIN_HOVER = 0.55;
/** How far the globe leans toward the pointer, in radians. */
const LEAN = 0.32;

/**
 * Frames come from the page's shared 30fps particle clock (onFrame),
 * hovered or not; the motion runs on elapsed time, so its speed does not
 * depend on the rate.
 */
const MAX_DPR = 2;

/** Camera distance in sphere radii; lower is a stronger perspective. */
const CAMERA = 3.4;

interface Ring {
  /** Radius in sphere radii. */
  radius: number;
  /** Inclination and roll of the ring's plane. */
  tilt: number;
  roll: number;
  alpha: number;
  /** Markers riding the ring: start angle, speed (rad/s), kind, colour. */
  markers: { at: number; speed: number; kind: "pill" | "node"; color: RGB }[];
}

// Both rings lean toward the camera at the top, so the arc that shows
// inside a short banner is the one passing in front of the globe.
const RINGS: Ring[] = [
  {
    radius: 1.1,
    tilt: -1.25,
    roll: 0.22,
    alpha: 0.34,
    markers: [
      { at: 0.35, speed: 0.05, kind: "pill", color: VIOLET },
      { at: 1.05, speed: 0.05, kind: "node", color: PINK },
      { at: 1.9, speed: 0.05, kind: "pill", color: BLUE },
      { at: 2.6, speed: 0.05, kind: "node", color: VIOLET },
      { at: 4.2, speed: 0.05, kind: "pill", color: PINK },
    ],
  },
  {
    radius: 1.3,
    tilt: -0.36,
    roll: -0.28,
    alpha: 0.22,
    markers: [
      { at: 1.25, speed: -0.035, kind: "pill", color: PINK },
      { at: 2.05, speed: -0.035, kind: "node", color: BLUE },
      { at: 5.0, speed: -0.035, kind: "pill", color: VIOLET },
    ],
  },
];

/** Chips pinned to the surface, so they turn with the globe. */
const SURFACE_PILLS: { lat: number; lon: number; color: RGB }[] = [
  { lat: 0.42, lon: 0.6, color: VIOLET },
  { lat: 0.3, lon: 2.5, color: VIOLET },
  { lat: 0.55, lon: 4.3, color: BLUE },
];

interface ParticleGlobeProps {
  className?: string;
  /**
   * The element whose hover drives the globe. The canvas itself never
   * takes the pointer, so it can sit behind buttons without stealing
   * their clicks. Defaults to the canvas's parent.
   */
  hostRef?: React.RefObject<HTMLElement | null>;
  /** Sphere centre as fractions of the canvas box (y may run past 1). */
  cx?: number;
  cy?: number;
  /** Sphere radius as a fraction of the canvas height. */
  radius?: number;
}

/**
 * A rotating 3D globe drawn on a canvas: a fibonacci lattice of points
 * with depth shading, faint meridians and parallels, a wired network of
 * hubs, a rim of atmosphere, and tilted orbit rings with chips riding
 * them. Pointing at the host speeds the spin and leans the globe toward
 * the pointer.
 *
 * Decorative only, and it acts like it: no clicks, one still frame for
 * reduced-motion users, and the loop stops whenever the tab is hidden or
 * the canvas is scrolled off screen. Anything wholly outside the canvas
 * -- most of the globe, in the short dashboard banner -- is never drawn.
 */
export function ParticleGlobe({ className, hostRef, cx = 0.5, cy = 0.5, radius = 0.42 }: ParticleGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const host = hostRef?.current ?? canvas.parentElement;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const glows = new Map<RGB, HTMLCanvasElement>([PINK, VIOLET, BLUE].map((c) => [c, glowSprite(c)]));
    // Each chip colour's fill and rim, built once rather than per chip per frame.
    const inks = new Map<RGB, { fill: string; rim: string; node: string }>(
      [PINK, VIOLET, BLUE].map((c) => [
        c,
        {
          fill: `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.45)`,
          rim: `rgba(${lighten(c)}, 0.75)`,
          node: `rgba(${lighten(c)}, 0.95)`,
        },
      ]),
    );
    const ringInks = RINGS.map(({ alpha: a }) => ({
      front: `rgba(170, 110, 255, ${a})`,
      back: `rgba(170, 110, 255, ${a * 0.3})`,
    }));

    // ---- Geometry, built once -------------------------------------------
    const points: Vec3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < POINTS; i++) {
      const y = 1 - (i / (POINTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      points.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }

    const hubs = points.filter((_, i) => i % HUB_EVERY === 4);
    const edges: Vec3[][] = [];
    const seen = new Set<string>();
    hubs.forEach((a, i) => {
      const nearest = hubs
        .map((b, j) => ({ j, d: dist(a, b) }))
        .filter(({ j }) => j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3);
      for (const { j } of nearest) {
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(arc(a, hubs[j]!, 6));
      }
    });

    // Meridians every 30deg, parallels every 30deg of latitude.
    const grid: Vec3[][] = [];
    for (let m = 0; m < 6; m++) {
      const lon = (m / 6) * Math.PI;
      const line: Vec3[] = [];
      for (let s = 0; s <= 48; s++) {
        const a = (s / 48) * Math.PI * 2;
        line.push([Math.cos(a) * Math.cos(lon), Math.sin(a), Math.cos(a) * Math.sin(lon)]);
      }
      grid.push(line);
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      const y = Math.sin((lat * Math.PI) / 180);
      const r = Math.cos((lat * Math.PI) / 180);
      const line: Vec3[] = [];
      for (let s = 0; s <= 48; s++) {
        const a = (s / 48) * Math.PI * 2;
        line.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      grid.push(line);
    }

    const ringLines = RINGS.map((ring) => {
      const line: Vec3[] = [];
      for (let s = 0; s <= 96; s++) line.push(ringPoint(ring, (s / 96) * Math.PI * 2));
      return line;
    });

    const surfacePills = SURFACE_PILLS.map(({ lat, lon, color }) => ({
      p: [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)] as Vec3,
      color,
    }));

    // ---- State ----------------------------------------------------------
    let width = 0;
    let height = 0;
    let spin = 0.9;
    let speed = SPIN_IDLE;
    let leanX = 0;
    let leanY = 0;
    let targetX = 0;
    let targetY = 0;
    let hovered = false;
    let time = 0;

    let unsubscribe: (() => void) | null = null;
    let last = 0;
    let onScreen = false;
    // The body and atmosphere fills depend only on the size and theme, so
    // they are built when either changes rather than every frame.
    let fills: { body: CanvasGradient; rim: CanvasGradient; light: boolean } | null = null;

    // Scratch output of project(): screen x, y, depth (+ toward the viewer)
    // and perspective scale. Reused so the hot loop allocates nothing.
    const out = { x: 0, y: 0, z: 0, s: 1 };
    let R = 1;
    let ox = 0;
    let oy = 0;
    // Rotation terms, refreshed once per frame.
    let cs = 1, ss = 0, cl = 1, sl = 0, ct = 1, st = 0;

    const setAngles = () => {
      cs = Math.cos(spin);
      ss = Math.sin(spin);
      // A fixed view from slightly above, plus the pointer's lean.
      const tiltX = -0.32 + leanY;
      ct = Math.cos(tiltX);
      st = Math.sin(tiltX);
      cl = Math.cos(leanX);
      sl = Math.sin(leanX);
    };

    /** World point (already placed) -> screen, through the lean and view tilt. */
    const view = (x: number, y: number, z: number) => {
      // Lean left/right about the vertical axis.
      const x1 = x * cl + z * sl;
      const z1 = -x * sl + z * cl;
      // Tilt about the horizontal axis.
      const y2 = y * ct - z1 * st;
      const z2 = y * st + z1 * ct;
      const s = CAMERA / (CAMERA - z2);
      out.x = ox + x1 * R * s;
      out.y = oy - y2 * R * s;
      out.z = z2;
      out.s = s;
    };

    /** Point on the spinning surface. */
    const surface = (p: Vec3) => {
      view(p[0] * cs + p[2] * ss, p[1], -p[0] * ss + p[2] * cs);
    };

    /** Behind the sphere, as seen from the camera (near enough). */
    const hidden = (x: number, y: number, z: number) => {
      if (z >= 0) return false;
      const dx = (x - ox) / R;
      const dy = (y - oy) / R;
      return dx * dx + dy * dy < 1;
    };

    // Drawn in the page's zoomed px, so the chips and hairlines shrink with
    // the rest of the page; the backing store is the real screen size
    // (the rect) times the device ratio, so it stays sharp.
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const zoom = pageZoom();
      width = Math.max(1, rect.width / zoom);
      height = Math.max(1, rect.height / zoom);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      R = height * radius;
      ox = width * cx;
      oy = height * cy;
      fills = null;
    };

    const buildFills = (light: boolean) => {
      const body = ctx.createRadialGradient(ox - R * 0.3, oy - R * 0.45, R * 0.1, ox, oy, R);
      body.addColorStop(0, light ? "rgba(99, 102, 241, 0.14)" : "rgba(28, 48, 150, 0.18)");
      body.addColorStop(0.7, light ? "rgba(99, 102, 241, 0.07)" : "rgba(8, 18, 72, 0.3)");
      body.addColorStop(1, light ? "rgba(99, 102, 241, 0.12)" : "rgba(28, 36, 128, 0.26)");
      const rim = ctx.createRadialGradient(ox, oy, R * 0.86, ox, oy, R * 1.16);
      rim.addColorStop(0, "rgba(90, 100, 255, 0)");
      rim.addColorStop(0.47, light ? "rgba(99, 102, 241, 0.14)" : "rgba(98, 84, 250, 0.17)");
      rim.addColorStop(0.55, light ? "rgba(99, 102, 241, 0.08)" : "rgba(80, 100, 255, 0.07)");
      rim.addColorStop(1, "rgba(88, 110, 255, 0)");
      return { body, rim, light };
    };

    /** Whether a box of half-size `pad` round (x, y) misses the canvas entirely. */
    const offCanvas = (x: number, y: number, pad: number) =>
      x + pad < 0 || x - pad > width || y + pad < 0 || y - pad > height;

    const strokeLines = (lines: Vec3[][], onSurface: boolean, front: string, back: string | null, widthPx: number) => {
      const frontPath = new Path2D();
      const backPath = back ? new Path2D() : null;
      for (const line of lines) {
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let i = 0; i < line.length; i++) {
          const p = line[i]!;
          if (onSurface) surface(p);
          else view(p[0], p[1], p[2]);
          const { x, y, z } = out;
          // A segment with both ends past the same edge cannot cross the
          // canvas, so it is left out of the path.
          if (
            i > 0 &&
            !((x < -1 && px < -1) || (x > width + 1 && px > width + 1) || (y < -1 && py < -1) || (y > height + 1 && py > height + 1))
          ) {
            const mz = (z + pz) / 2;
            const behind = onSurface ? mz < 0 : hidden((x + px) / 2, (y + py) / 2, mz);
            const path = behind ? backPath : frontPath;
            if (path) {
              path.moveTo(px, py);
              path.lineTo(x, y);
            }
          }
          px = x;
          py = y;
          pz = z;
        }
      }
      ctx.lineWidth = widthPx;
      if (backPath && back) {
        ctx.strokeStyle = back;
        ctx.stroke(backPath);
      }
      ctx.strokeStyle = front;
      ctx.stroke(frontPath);
    };

    const drawGlow = (color: RGB, x: number, y: number, size: number, alpha: number) => {
      if (offCanvas(x, y, size / 2)) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(glows.get(color)!, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    };

    const drawPill = (color: RGB, x: number, y: number, s: number, alpha: number) => {
      // The glow is the widest part.
      if (offCanvas(x, y, 13 * s)) return;
      const w = 11 * s;
      const h = 6.5 * s;
      const ink = inks.get(color)!;
      drawGlow(color, x, y, 26 * s, 0.22 * alpha);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ink.fill;
      ctx.strokeStyle = ink.rim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(x - w * 0.22, y - 0.6, w * 0.44, 1.2);
      ctx.globalAlpha = 1;
    };

    const drawNode = (color: RGB, x: number, y: number, s: number, alpha: number) => {
      if (offCanvas(x, y, 12 * s)) return;
      drawGlow(color, x, y, 24 * s, 0.24 * alpha);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = inks.get(color)!.node;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const shades = [0.05, 0.12, 0.28, 0.5].map((a) => `rgba(150, 170, 255, ${a})`);
    // Each lattice point's projection, reused every frame: x, y, size, depth bucket (-1 off canvas).
    const dots = new Float32Array(points.length * 3);
    const dotBucket = new Int8Array(points.length);

    const draw = () => {
      setAngles();
      ctx.clearRect(0, 0, width, height);
      const light = document.body.classList.contains("light-mode");
      if (!fills || fills.light !== light) fills = buildFills(light);

      // Body and atmosphere: two radial fills, cheaper than any blur.
      ctx.fillStyle = fills.body;
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = fills.rim;
      ctx.beginPath();
      ctx.arc(ox, oy, R * 1.16, 0, Math.PI * 2);
      ctx.fill();

      // Graticule: back half barely there, front half faint.
      strokeLines(grid, true, "rgba(110, 130, 255, 0.13)", "rgba(110, 130, 255, 0.04)", 0.8);

      // Orbit rings, with the arc that passes behind the globe dimmed.
      ringLines.forEach((line, i) => {
        strokeLines([line], false, ringInks[i]!.front, ringInks[i]!.back, 1);
      });

      // Network wiring between hubs, front only.
      strokeLines(edges, true, "rgba(125, 140, 255, 0.3)", "rgba(125, 140, 255, 0.06)", 0.8);

      // Lattice points in four depth buckets, one fill colour per bucket.
      // Plain rects rather than one path per bucket: the GPU batches a
      // run of rect fills into a single draw, where a path of dozens of
      // separate squares has to be tessellated every frame.
      for (let i = 0; i < points.length; i++) {
        surface(points[i]!);
        const depth = (out.z + 1) / 2;
        const size = (0.6 + depth * 0.9) * out.s;
        dots[i * 3] = out.x - size / 2;
        dots[i * 3 + 1] = out.y - size / 2;
        dots[i * 3 + 2] = size;
        dotBucket[i] = offCanvas(out.x, out.y, size) ? -1 : Math.min(3, Math.floor(depth * 4));
      }
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = shades[b]!;
        for (let i = 0; i < points.length; i++) {
          if (dotBucket[i] === b) ctx.fillRect(dots[i * 3]!, dots[i * 3 + 1]!, dots[i * 3 + 2]!, dots[i * 3 + 2]!);
        }
      }

      // Hubs glow on the front face.
      for (const h of hubs) {
        surface(h);
        if (out.z < 0.05) continue;
        drawGlow(VIOLET, out.x, out.y, 10 * out.s, 0.36 * out.z);
      }

      // Chips pinned to the surface, fading as they turn away.
      for (const { p, color } of surfacePills) {
        surface(p);
        if (out.z < -0.1) continue;
        drawPill(color, out.x, out.y, out.s, Math.min(1, (out.z + 0.1) * 2));
      }

      // Markers riding the rings.
      for (const ring of RINGS) {
        for (const m of ring.markers) {
          const q = ringPoint(ring, m.at + time * m.speed);
          view(q[0], q[1], q[2]);
          const alpha = hidden(out.x, out.y, out.z) ? 0.18 : 1;
          if (m.kind === "pill") drawPill(m.color, out.x, out.y, out.s, alpha);
          else drawNode(m.color, out.x, out.y, out.s, alpha);
        }
      }
    };

    // The pointer's position is only turned into a lean inside the
    // frame, so a burst of pointer events costs at most one layout read.
    const pointer = { x: 0, y: 0, dirty: false };
    const aim = () => {
      pointer.dirty = false;
      if (!hovered) {
        targetX = targetY = 0;
        return;
      }
      // The rect and pointer are real screen px, the drawing is not, so
      // map through the rect as a fraction of the canvas.
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = ((pointer.x - rect.left) / rect.width) * width;
      const py = ((pointer.y - rect.top) / rect.height) * height;
      targetX = clamp((px - ox) / (width / 2), -1, 1) * LEAN;
      targetY = clamp((py - oy) / height, -1, 1) * LEAN * 0.6;
    };

    // One tick of the page's shared 30fps particle clock. Everything
    // moves on elapsed time, so the spin is the same speed at any rate.
    const tick = (now: number) => {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
      last = now;
      if (pointer.dirty) aim();

      const ease = 1 - Math.exp(-dt * 3);
      speed += ((hovered ? SPIN_HOVER : SPIN_IDLE) - speed) * ease;
      leanX += (targetX - leanX) * ease;
      leanY += (targetY - leanY) * ease;
      spin += speed * dt;
      time += dt;
      draw();
    };

    const shouldRun = () => onScreen && !document.hidden && !reduced.matches;

    const start = () => {
      if (unsubscribe || !shouldRun()) return;
      last = 0;
      unsubscribe = onFrame(tick);
    };

    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };

    const sync = () => {
      if (shouldRun()) start();
      else {
        stop();
        draw();
      }
    };

    const onMove = (event: PointerEvent) => {
      hovered = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.dirty = true;
    };

    const onLeave = () => {
      hovered = false;
      pointer.dirty = true;
    };

    const resize = new ResizeObserver(() => {
      measure();
      draw();
    });
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      sync();
    });

    // Crossing the zoom breakpoint changes the real size without always
    // changing the CSS size the observer watches.
    const onWindowResize = () => {
      measure();
      draw();
    };

    measure();
    draw();
    resize.observe(canvas);
    window.addEventListener("resize", onWindowResize);
    visible.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      stop();
      resize.disconnect();
      visible.disconnect();
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [hostRef, cx, cy, radius]);

  return <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none block size-full", className)} />;
}

/** A point on a ring's circle, in world space (rings do not spin with the globe). */
function ringPoint(ring: Ring, a: number): Vec3 {
  const x = Math.cos(a) * ring.radius;
  const z0 = Math.sin(a) * ring.radius;
  // Incline the ring's plane, then roll it.
  const y1 = -z0 * Math.sin(ring.tilt);
  const z1 = z0 * Math.cos(ring.tilt);
  return [x * Math.cos(ring.roll) - y1 * Math.sin(ring.roll), x * Math.sin(ring.roll) + y1 * Math.cos(ring.roll), z1];
}

/** Great-circle arc from a to b, as n+1 points on the unit sphere. */
function arc(a: Vec3, b: Vec3, n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const len = Math.hypot(x, y, z) || 1;
    out.push([x / len, y / len, z / len]);
  }
  return out;
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function lighten([r, g, b]: RGB) {
  return `${Math.round(r + (255 - r) * 0.45)}, ${Math.round(g + (255 - g) * 0.45)}, ${Math.round(b + (255 - b) * 0.45)}`;
}

/** Soft radial glow, rendered once and stamped with drawImage. */
function glowSprite([r, g, b]: RGB) {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = size;
  const c = sprite.getContext("2d");
  if (c) {
    const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
    grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.35)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
  }
  return sprite;
}
