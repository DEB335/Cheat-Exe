"use client";

import { useRef } from "react";

import { paletteVars, PALETTES, rgb, usePauseWhenHidden, useSvgIds, type PaletteName } from "@/components/holo";
import { cn } from "@/lib/utils";

import styles from "./scene-manager-glyph.module.css";

export type ActionGlyphKind = "reset" | "ban" | "unban" | "delete";

// Each action's neon, as in the mockup's cards: reset violet, ban red,
// unban blue, delete magenta.
const TONE: Record<ActionGlyphKind, PaletteName> = {
  reset: "violet",
  ban: "danger",
  unban: "blue",
  delete: "pink",
};

// --- Icons, in a 48 x 48 viewBox. ---------------------------------------

const SHIELD = "M24 6.5 L37.5 11.5 V23 C37.5 31.8 31.8 38.3 24 41.5 C16.2 38.3 10.5 31.8 10.5 23 V11.5 Z";

/**
 * A clockwise arc round (24, 24) from a1 to a2 degrees (SVG angles,
 * clockwise from three o'clock) with an arrowhead at its end: the reset
 * icon's two half-turn arrows.
 */
const arrowArc = (r: number, a1: number, a2: number) => {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [24 + r * Math.cos(a), 24 + r * Math.sin(a)] as const;
  };
  const [x1, y1] = at(a1);
  const [x2, y2] = at(a2);
  // Clockwise tangent and outward normal at the end.
  const t = (a2 * Math.PI) / 180;
  const [tx, ty] = [-Math.sin(t), Math.cos(t)];
  const [nx, ny] = [Math.cos(t), Math.sin(t)];
  const f = (v: number) => v.toFixed(2);
  const wing = (s: number) => `${f(x2 - tx * 4.6 + nx * 4 * s)} ${f(y2 - ty * 4.6 + ny * 4 * s)}`;
  return `M${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)} M${wing(1)} L${f(x2)} ${f(y2)} L${wing(-1)}`;
};

// Built once: every card draws the same few paths.
const ICON: Record<ActionGlyphKind, readonly string[]> = {
  reset: [arrowArc(13, 200, 335), arrowArc(13, 20, 155)],
  ban: [SHIELD, "M24 16.5 A7 7 0 1 0 24 30.5 A7 7 0 1 0 24 16.5 Z", "M19.1 18.6 L28.9 28.4"],
  unban: [SHIELD, "M17.6 23.6 L22.2 28.2 L30.8 18.8"],
  delete: [
    "M11.5 14 H36.5",
    "M20 14 V10.5 Q20 9.5 21 9.5 H27 Q28 9.5 28 10.5 V14",
    "M14.5 14 L16.6 38.2 Q16.8 39.5 18 39.5 H30 Q31.2 39.5 31.4 38.2 L33.5 14",
    "M21 19.5 V33.5",
    "M27 19.5 V33.5",
  ],
};

/** Closed outlines that also get a faint glass fill. */
const GLASS: Partial<Record<ActionGlyphKind, string>> = {
  ban: SHIELD,
  unban: SHIELD,
  delete: "M14.5 14 L16.6 38.2 Q16.8 39.5 18 39.5 H30 Q31.2 39.5 31.4 38.2 L33.5 14 Z",
};

/**
 * The glowing icon on a mini pedestal at the left of each Manage Key
 * action card: a neon line icon (a coloured tube with a white-hot core
 * over a soft bloom) bobbing above a small elliptical disc of light in
 * the same tone, with a faint beam between them and a ring of light
 * pulsing off the disc. SVG and CSS only -- no particle canvas, as it
 * appears four times on the page.
 *
 * The caller positions and sizes it (designed round 72 x 88; it keeps
 * its proportions inside any box). Brightens and lifts while the card
 * it sits in (a Tailwind `group`) is hovered. Decorative only:
 * aria-hidden, pointer-events none, paused off screen, still under
 * reduced motion.
 */
export function ActionGlyph({ kind, className }: { kind: ActionGlyphKind; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds(`ag${kind}`);
  const p = PALETTES[TONE[kind]];
  const glass = GLASS[kind];

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.root} ${cn("pointer-events-none relative aspect-[72/88]", className)}`}
      style={paletteVars(p)}
    >
      <div className={styles.stage}>
        <svg className={styles.disc} viewBox="0 0 72 30">
          <defs>
            <radialGradient id={id("pool")}>
              <stop offset="0" stopColor={rgb(p.b)} stopOpacity="0.27" />
              <stop offset="0.6" stopColor={rgb(p.c)} stopOpacity="0.08" />
              <stop offset="1" stopColor={rgb(p.c)} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id("face")}>
              <stop offset="0" stopColor={rgb(p.hot)} stopOpacity="0.95" />
              <stop offset="0.45" stopColor={rgb(p.a)} stopOpacity="0.7" />
              <stop offset="1" stopColor={rgb(p.b)} stopOpacity="0.15" />
            </radialGradient>
          </defs>
          <ellipse cx="36" cy="15" rx="36" ry="12" fill={url("pool")} />
          <ellipse cx="36" cy="15" rx="33" ry="7.4" className={styles.ringOuter} />
          <ellipse cx="36" cy="15" rx="26" ry="5.4" className={styles.ringMid} />
          <ellipse cx="36" cy="15" rx="19" ry="3.9" fill={url("face")} />
          <ellipse cx="36" cy="15" rx="19" ry="3.9" className={styles.rim} />
          <ellipse cx="36" cy="14.6" rx="11" ry="1.5" className={styles.hotspot} />
        </svg>
        <span className={styles.pulse} />
        <span className={styles.beam} />

        <div className={styles.lift}>
          <div className={styles.bob}>
            <svg className={styles.icon} viewBox="0 0 48 48">
              <defs>
                <linearGradient id={id("tube")} gradientUnits="userSpaceOnUse" x1="10" y1="6" x2="38" y2="42">
                  <stop offset="0" stopColor={rgb(p.a)} />
                  <stop offset="1" stopColor={rgb(p.b)} />
                </linearGradient>
                <filter id={id("bloom")} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1.4" />
                </filter>
              </defs>
              {glass ? <path d={glass} className={styles.glass} /> : null}
              <g className={styles.bloom} filter={url("bloom")}>
                {ICON[kind].map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
              <g className={styles.tube} stroke={url("tube")}>
                {ICON[kind].map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
              <g className={styles.core}>
                {ICON[kind].map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
