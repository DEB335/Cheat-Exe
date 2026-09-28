"use client";

import { useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { usePauseWhenHidden, useSvgIds } from "./hooks";
import { paletteVars, resolvePalette, rgb, type PaletteInput } from "./palettes";
import styles from "./holo-stage.module.css";

// The disc in a 240 x 120 box, seen from ~14deg above: every ellipse is
// ry = 0.24 rx. The main disc's top face is centred at (120, 67) -- 55.8%
// down the box, which the CSS rings and HoloStage's layout rely on.
const TOP = { cx: 120, cy: 67, rx: 72, ry: 17.2 };
const DISC_DEPTH = 13;
const STEP = { cx: 120, cy: 80, rx: 94, ry: 22.6 };
const STEP_DEPTH = 8;

/** Front half of an ellipse (left end -> through the bottom -> right end). */
const frontArc = (e: typeof TOP, dy = 0) =>
  `M${e.cx - e.rx} ${e.cy + dy} A${e.rx} ${e.ry} 0 0 0 ${e.cx + e.rx} ${e.cy + dy}`;
/** Back half (left end -> over the top -> right end). */
const backArc = (e: typeof TOP) => `M${e.cx - e.rx} ${e.cy} A${e.rx} ${e.ry} 0 0 1 ${e.cx + e.rx} ${e.cy}`;
/** The visible side of a cylinder of this top face and depth. */
const side = (e: typeof TOP, depth: number) =>
  `${frontArc(e)} L${e.cx + e.rx} ${e.cy + depth} A${e.rx} ${e.ry} 0 0 1 ${e.cx - e.rx} ${e.cy + depth} Z`;

export interface HoloPedestalProps {
  /** Palette name or colours. Default "aurora". */
  tone?: PaletteInput;
  /** Width in px. By default it fills its container's width (height is half of it). */
  size?: number;
  /** The rising light beam. */
  beam?: boolean;
  /** A faint perspective grid on the floor around the disc. */
  grid?: boolean;
  className?: string;
}

/**
 * The glowing holographic platform the hero objects float over: a
 * two-step disc with concentric neon rings on its face, a HUD reticle
 * and a comet turning on it, tick marks turning the other way round the
 * floor, a soft cone of light rising off it, bloom underneath, and
 * optionally a grid floor receding round it.
 *
 * Decorative: no pointer events, hidden from assistive tech, and its
 * animations pause off screen and stop under reduced motion.
 */
export function HoloPedestal({ tone = "aurora", size, beam = true, grid = false, className }: HoloPedestalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds("hp");
  const p = resolvePalette(tone);
  const style: CSSProperties = { ...paletteVars(p), ...(size ? { width: size } : null) };

  return (
    <div ref={rootRef} aria-hidden className={`${styles.pedestal} ${cn("relative w-full", className)}`} style={style}>
      {grid ? <div className={styles.grid} /> : null}
      <div className={styles.bloom} />
      {beam ? <div className={styles.beam} /> : null}
      <div className={`${styles.plane} ${styles.hudFloor}`}>
        <span />
      </div>
      <svg viewBox="0 0 240 120">
        <defs>
          {/* Rim light: the neon runs c -> b -> a across the disc. */}
          <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={rgb(p.c)} />
            <stop offset="0.5" stopColor={rgb(p.b)} />
            <stop offset="0.82" stopColor={rgb(p.a)} />
            <stop offset="1" stopColor={rgb(p.a)} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={id("side")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={rgb(p.b)} stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#141a55" />
            <stop offset="1" stopColor="#090c2c" />
          </linearGradient>
          {/* Cylindrical shading across the side band. */}
          <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={rgb(p.c)} stopOpacity="0.28" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor={rgb(p.a)} stopOpacity="0.3" />
          </linearGradient>
          <radialGradient id={id("face")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={rgb(p.b)} stopOpacity="0.75" />
            <stop offset="0.45" stopColor="#1f2372" stopOpacity="0.95" />
            <stop offset="1" stopColor="#0d1142" />
          </radialGradient>
          <radialGradient id={id("hot")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.25" stopColor={rgb(p.hot)} stopOpacity="0.7" />
            <stop offset="0.6" stopColor={rgb(p.a)} stopOpacity="0.25" />
            <stop offset="1" stopColor={rgb(p.a)} stopOpacity="0" />
          </radialGradient>
          <filter id={id("bloom")} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* Floor rings the disc stands in. */}
        <ellipse cx="120" cy="90" rx="117" ry="28" fill="none" stroke={rgb(p.c)} strokeOpacity="0.35" strokeWidth="0.6" />
        <ellipse
          cx="120"
          cy="90"
          rx="106"
          ry="25.4"
          fill="none"
          stroke={rgb(p.b)}
          strokeOpacity="0.4"
          strokeWidth="0.7"
          strokeDasharray="2 3"
        />

        {/* Lower step. */}
        <ellipse className={styles.pedDark} cx={STEP.cx} cy={STEP.cy} rx={STEP.rx} ry={STEP.ry} fill="#0b0f36" />
        <path className={styles.pedDark} d={side(STEP, STEP_DEPTH)} fill={url("side")} />
        <path d={side(STEP, STEP_DEPTH)} fill={url("sheen")} />
        <path d={frontArc(STEP, STEP_DEPTH)} fill="none" stroke={rgb(p.c)} strokeOpacity="0.55" strokeWidth="0.8" />
        <path d={frontArc(STEP)} fill="none" stroke={url("rim")} strokeWidth="3" filter={url("bloom")} />
        <path d={frontArc(STEP)} fill="none" stroke={url("rim")} strokeWidth="1.1" />
        <ellipse cx={STEP.cx} cy={STEP.cy} rx={STEP.rx - 8} ry={STEP.ry - 2} fill="none" stroke={rgb(p.b)} strokeOpacity="0.35" strokeWidth="0.6" />

        {/* Main disc: its side band, then the lit face. */}
        <path className={styles.pedDark} d={side(TOP, DISC_DEPTH)} fill={url("side")} />
        <path d={side(TOP, DISC_DEPTH)} fill={url("sheen")} />
        <path d={frontArc(TOP, DISC_DEPTH)} fill="none" stroke={url("rim")} strokeOpacity="0.8" strokeWidth="1" />
        <path d={frontArc(TOP, DISC_DEPTH * 0.55)} fill="none" stroke={rgb(p.hot)} strokeOpacity="0.14" strokeWidth="0.6" />
        <ellipse className={styles.pedFace} cx={TOP.cx} cy={TOP.cy} rx={TOP.rx} ry={TOP.ry} fill={url("face")} />

        {/* Concentric rings on the face, one of them burning bright. */}
        <ellipse cx="120" cy="67" rx="60" ry="14.3" fill="none" stroke={rgb(p.c)} strokeOpacity="0.5" strokeWidth="0.7" />
        <ellipse cx="120" cy="67" rx="47" ry="11.2" fill="none" stroke={url("rim")} strokeWidth="3" filter={url("bloom")} />
        <ellipse cx="120" cy="67" rx="47" ry="11.2" fill="none" stroke={rgb(p.hot)} strokeOpacity="0.9" strokeWidth="1" />
        <ellipse cx="120" cy="67" rx="34" ry="8.1" fill="none" stroke={rgb(p.b)} strokeOpacity="0.55" strokeWidth="0.7" />
        <ellipse cx="120" cy="67" rx="21" ry="5" fill="none" stroke={rgb(p.a)} strokeOpacity="0.8" strokeWidth="0.9" />
        <ellipse cx="120" cy="67" rx="30" ry="7.4" fill={url("hot")} />

        {/* The rim: bloom under a crisp gradient edge, brightest in front. */}
        <path d={backArc(TOP)} fill="none" stroke={url("rim")} strokeOpacity="0.6" strokeWidth="0.9" />
        <path d={frontArc(TOP)} fill="none" stroke={url("rim")} strokeWidth="3.6" filter={url("bloom")} />
        <path d={frontArc(TOP)} fill="none" stroke={url("rim")} strokeWidth="1.4" />
        <path d={frontArc(TOP)} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.5" />
      </svg>
      <div className={`${styles.plane} ${styles.hudTop}`}>
        <span />
      </div>
      <div className={`${styles.plane} ${styles.comet}`}>
        <span />
      </div>
    </div>
  );
}
