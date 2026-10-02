"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HoloGlyph, isGlyphName, type HoloGlyphName } from "./glyphs";
import { usePauseWhenHidden, useSvgIds } from "./hooks";
import { paletteVars, resolvePalette, type PaletteInput } from "./palettes";
import styles from "./holo-objects.module.css";

export interface HoloCubeProps {
  /** Palette name or colours. Default "aurora". */
  tone?: PaletteInput;
  /** The symbol on the front face: a built-in name (lock, key, ...) or any node. */
  glyph?: HoloGlyphName | ReactNode;
  /** Box width in px. Without it the cube fills its box's width (className sizes it). */
  size?: number;
  /** Roll about the viewing axis in degrees, e.g. -18 for the generator's leaning cube. */
  tilt?: number;
  /** A neon ring round the cube, passing behind and in front of it. */
  ring?: boolean;
  /** Neon corner brackets round the glyph, as on the vault cube. */
  brackets?: boolean;
  /** The soft glow behind the cube. */
  halo?: boolean;
  className?: string;
}

/**
 * A glass cube hologram: six translucent faces in real CSS 3D, with a
 * neon edge and inner glow on each, light trapped at its heart, vents on
 * the side and a slot on the lid, and a glowing glyph on the front face
 * (a padlock for the vault, a key for the generator). It sways slowly
 * (and bobs too, inside a HoloStage).
 *
 * The cube takes 58% of its box, so its corners and glow stay inside
 * however it turns.
 */
export function HoloCube({
  tone = "aurora",
  glyph = "lock",
  size,
  tilt = 0,
  ring = false,
  brackets = true,
  halo = true,
  className,
}: HoloCubeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds("hc");
  const p = resolvePalette(tone);
  const style = {
    ...paletteVars(p),
    ...(tilt ? { "--cube-tilt": `${tilt}deg` } : null),
    ...(size ? { width: size } : null),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.object} ${styles.cube} ${cn("relative w-full", className)}`}
      style={style}
    >
      <div className={styles.scene}>
        {halo ? <div className={styles.halo} /> : null}
        {ring ? <div className={`${styles.orbit} ${styles.orbitBack}`} /> : null}
        <div className={styles.idle}>
          <div className={styles.cubeBody}>
            <div className={`${styles.face} ${styles.back}`} />
            <div className={`${styles.face} ${styles.left}`} />
            <div className={`${styles.face} ${styles.bottom}`} />
            <div className={styles.core} />
            <div className={`${styles.face} ${styles.right}`}>
              <span className={styles.vents} />
            </div>
            <div className={`${styles.face} ${styles.top}`}>
              <span className={styles.slot} />
            </div>
            <div className={`${styles.face} ${styles.front}`}>
              {brackets ? (
                <>
                  <span className={styles.bracket} />
                  <span className={styles.bracket} />
                  <span className={styles.bracket} />
                  <span className={styles.bracket} />
                </>
              ) : null}
              {isGlyphName(glyph) ? (
                <svg className={styles.faceGlyph} viewBox="0 0 40 40">
                  <HoloGlyph glyph={glyph} p={p} id={id} url={url} x={0} y={0} size={40} />
                </svg>
              ) : glyph ? (
                <div className={`${styles.faceGlyph} grid place-items-center`}>{glyph}</div>
              ) : null}
            </div>
          </div>
        </div>
        {ring ? <div className={`${styles.orbit} ${styles.orbitFront}`} /> : null}
      </div>
    </div>
  );
}
