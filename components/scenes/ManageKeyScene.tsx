"use client";

import { useRef } from "react";

import {
  HoloKey,
  HoloStage,
  PALETTES,
  paletteVars,
  usePauseWhenHidden,
  usePointerLean,
  useSvgIds,
  type RGB,
} from "@/components/holo";
import { cn } from "@/lib/utils";

import styles from "./scene-manager.module.css";

export { ActionGlyph, type ActionGlyphKind } from "./manager-glyph";

// The mockup's sparkle: mostly electric blue and sky, with violet and a
// little magenta drifting through, as round the key and its dome. The
// first colour tints the white-hot specks, so they read pale blue.
const SPARKLE: readonly RGB[] = [
  PALETTES.blue.a,
  PALETTES.blue.b,
  PALETTES.cyan.a,
  PALETTES.violet.b,
  PALETTES.blue.c,
  PALETTES.aurora.a,
];

/** The dome's colours: blue HUD lines with a violet accent arc, as in the mockup. */
const DOME = paletteVars({ ...PALETTES.blue, particles: [] });

// --- Dome geometry, in a 200 x 200 viewBox centred on (100, 100). ------
// Angles are SVG's: degrees clockwise from three o'clock, so the dome's
// visible upper half runs from 180 (left) through 270 (top) to 360.

const C = 100;

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)] as const;
};

/** An arc of radius r, clockwise from a1 to a2 degrees. */
const arc = (r: number, a1: number, a2: number) => {
  const [x1, y1] = polar(r, a1);
  const [x2, y2] = polar(r, a2);
  return `M${x1} ${y1} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/** Radial tick marks between r1 and r2, every `step` degrees from a1 to a2. */
const ticks = (r1: number, r2: number, a1: number, a2: number, step: number) => {
  let d = "";
  for (let deg = a1; deg <= a2; deg += step) {
    const [x1, y1] = polar(r1, deg);
    const [x2, y2] = polar(r2, deg);
    d += `M${x1} ${y1} L${x2} ${y2} `;
  }
  return d.trim();
};

// Built once: the scene draws the same HUD on every mount.
const MAIN_ARC = arc(96, 196, 262);
const ACCENT_ARC = arc(96, 292, 336);
const INNER_ARC = arc(82, 222, 300);
const TICK_BAND = ticks(86, 91, 150, 246, 3);
const TICK_BAND_2 = ticks(86, 89, 300, 350, 2.5);
const FINE_TICKS = ticks(70, 72.5, 0, 357, 6);

/**
 * The Manage Key hologram: a neon blue key standing on the diagonal
 * above a holographic pedestal, under a big translucent radar dome --
 * a glass shell with a sweeping radar beam, neon arcs and tick bands
 * turning at different speeds, dotted rings -- with wide dotted rings
 * on the floor, a few data streaks flicking out at pedestal height and
 * a volume of blue and violet sparkle round the key (the stage's one
 * particle field, half behind the key and half in front).
 *
 * The caller positions and sizes it -- it needs a definite width and
 * height (designed round ~460 x 260; the dome shrinks to fit a shorter
 * box) -- and everything stays inside that box. Decorative only:
 * aria-hidden and pointer-events none throughout; the key and the dome
 * lean toward the pointer over the nearest panel, the animations pause
 * off screen or in a hidden tab, and reduced motion gets a still frame.
 */
export function ManageKeyScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  // The stage leans the key on its own; this drives the dome's parallax.
  usePointerLean(rootRef);
  const { id, url } = useSvgIds("mk");

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.root} ${cn("pointer-events-none relative", className)}`}
      style={DOME}
    >
      <div className={styles.floor}>
        <span className={styles.floorDots} />
        <span className={styles.floorDash} />
        <span className={styles.floorRing} />
      </div>

      <div className={styles.dome}>
        <div className={styles.domeTilt}>
          <span className={styles.shell} />
          <span className={styles.sweep} />
          <svg className={styles.layer} viewBox="0 0 200 200">
            <circle cx={C} cy={C} r="76" className={styles.dotted} />
            <circle cx={C} cy={C} r="99" className={styles.outline} />
            <path d={FINE_TICKS} className={styles.fine} />
          </svg>
          <svg className={`${styles.layer} ${styles.spinSlow}`} viewBox="0 0 200 200">
            <defs>
              <filter id={id("bloom")} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>
            <path d={MAIN_ARC} className={styles.arcBloom} filter={url("bloom")} />
            <path d={MAIN_ARC} className={styles.arcMain} />
            <path d={MAIN_ARC} className={styles.arcCore} />
            <path d={ACCENT_ARC} className={styles.arcAccent} />
          </svg>
          <svg className={`${styles.layer} ${styles.spinBack}`} viewBox="0 0 200 200">
            <path d={TICK_BAND} className={styles.tickBand} />
            <path d={TICK_BAND_2} className={styles.tickBand} />
            <path d={INNER_ARC} className={styles.innerArc} />
          </svg>
        </div>
      </div>

      <span className={`${styles.streak} ${styles.streakL1}`} />
      <span className={`${styles.streak} ${styles.streakL2}`} />
      <span className={`${styles.streak} ${styles.streakR1}`} />
      <span className={`${styles.streak} ${styles.streakR2}`} />

      <HoloStage
        tone="blue"
        palette={SPARKLE}
        pedestalSize={0.6}
        density={1.35}
        radius={0.62}
        className="absolute inset-0"
        objectClassName="w-[46%]"
      >
        <HoloKey tone="blue" />
      </HoloStage>
    </div>
  );
}
