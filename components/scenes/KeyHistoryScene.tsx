"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

import {
  HoloShield,
  paletteVars,
  ParticleField,
  resolvePalette,
  usePauseWhenHidden,
  type RGB,
} from "@/components/holo";
import { cn } from "@/lib/utils";

import { HistoryFloor } from "./history-floor";
import styles from "./scene-history.module.css";

// The key history mockup is violet into blue with no magenta: purple
// where the light catches the shield's right rim, violet through the
// glass, electric blue down the left. The first three are the
// palette's a/b/c; the particles also get lilac, indigo and sky.
const TONE: readonly RGB[] = [
  [168, 85, 247],
  [139, 92, 246],
  [59, 130, 246],
];
const SPECKS: readonly RGB[] = [...TONE, [192, 132, 252], [99, 102, 241], [96, 165, 250]];
const VARS = paletteVars(resolvePalette(TONE));

/**
 * The box's layout size, rounded so sub-pixel jitter never rebuilds the
 * floor or the particle field. offsetWidth/Height are unzoomed CSS px,
 * the same units the floor's viewBox and the field's sprites use.
 */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth / 8) * 8;
      const h = Math.round(el.offsetHeight / 8) * 8;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Rounds to one decimal, so a resize only restarts the field in steps. */
const step = (v: number) => Math.round(v * 10) / 10;

/**
 * The quiet backdrop behind the key history panel's header and stat
 * row: soft violet and blue light pooling, a faint perspective grid
 * floor under a horizon line, and a sparse, slowly turning column of 3D
 * specks, glints and bokeh across the whole width.
 *
 * Meant for the full panel width and ~300px tall; the caller positions
 * and sizes the root. Everything is dim and fades out toward the bottom
 * and sides, so the stat tiles and text over it stay crisp. One particle
 * canvas.
 *
 * Decorative: aria-hidden, no pointer events. A still frame apart from
 * the particle field, which stops off screen and under reduced motion.
 */
export function KeyHistoryAmbient({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const size = useBoxSize(rootRef);

  // The field is a turning column whose radius is a share of the box's
  // shorter side; this makes it span about three quarters of the width
  // whatever the aspect, and keeps the count per area about the same.
  const field = size && size.w > 0 && size.h > 0
    ? {
        radius: step((0.36 * size.w) / Math.min(size.w, size.h)),
        density: step(Math.min(1.8, Math.max(0.6, size.w / 1000))),
      }
    : null;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.ambient} ${cn("pointer-events-none relative", className)}`}
      style={VARS}
    >
      <div className={styles.pools} />
      {size ? <HistoryFloor w={size.w} h={size.h} /> : null}
      <div className={styles.horizon} />
      {field ? (
        <ParticleField
          palette={SPECKS}
          shape="column"
          radius={field.radius}
          density={field.density}
          speed={0.45}
          seed={0x6b657973}
          className={styles.ambField}
        />
      ) : null}
    </div>
  );
}

/**
 * Three sparkles resting on the emblem's orbit ring: `a` is the angle
 * round it (clockwise from the right, so 0-180 is the near half), `s`
 * the size, `o` the brightness -- the one on the far side is dimmer, as
 * the ring's back half is.
 */
const SPARKS = [
  { a: 24, s: 1, o: 1 },
  { a: 150, s: 0.7, o: 0.9 },
  { a: 322, s: 0.85, o: 0.5 },
];

/**
 * The key history panel's header emblem: a glass hex shield bearing a
 * neon key, floating over a small projector pad in violet and blue,
 * with a tipped orbit ring passing behind and in front of it, sparkles
 * on the ring and a small cloud of 3D specks round the lot.
 *
 * Designed for ~220 x 130. The caller positions and sizes the root
 * (both dimensions); everything is drawn in a 22:13 rig centred in it
 * as large as fits, so the box's shape never stretches the hologram.
 * One particle canvas. Only the shield moves, floating slowly; the
 * ring, its comet and the sparkles are a still frame.
 *
 * Decorative: aria-hidden, no pointer events, CSS animations paused off
 * screen and stopped under reduced motion.
 */
export function KeyHistoryEmblem({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.emblem} ${cn("pointer-events-none relative", className)}`}
      style={VARS}
    >
      <div className={styles.rig}>
        <div className={styles.halo} />
        <div className={styles.pad}>
          <span />
        </div>
        <div className={styles.beam} />
        <ParticleField
          palette={SPECKS}
          shape="orbit"
          radius={0.62}
          cy={0.5}
          density={0.6}
          speed={0.8}
          seed={0x6b6579}
          edgeFade
          className={styles.emblemField}
        />
        <div className={`${styles.ring} ${styles.ringBack}`}>
          <span />
        </div>
        <div className={styles.shield}>
          <div className={styles.bob}>
            <HoloShield tone={TONE} shape="hex" glyph="key" />
          </div>
        </div>
        <div className={`${styles.ring} ${styles.ringFront}`}>
          <span />
        </div>
        <div className={styles.sparks}>
          {SPARKS.map((p) => (
            <div key={p.a} className={styles.arm} style={{ "--a": `${p.a}deg` } as CSSProperties}>
              <span className={styles.spark} style={{ "--s": p.s, opacity: p.o } as CSSProperties}>
                <i />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
