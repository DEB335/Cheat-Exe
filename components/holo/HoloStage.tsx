"use client";

import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";

import { HoloPedestal } from "./HoloPedestal";
import { usePauseWhenHidden, usePointerLean } from "./hooks";
import { paletteVars, resolvePalette, type PaletteInput } from "./palettes";
import { ParticleField, type FieldShape } from "./ParticleField";
import styles from "./holo-stage.module.css";

export interface HoloStageProps {
  /** Palette for the pedestal, halo and particles. Default "aurora". */
  tone?: PaletteInput;
  /** Particle colours, when they should differ from `tone`. */
  palette?: PaletteInput;
  /** The glowing platform under the object. Without it the object floats mid-stage. */
  pedestal?: boolean;
  /** The light beam rising off the pedestal. */
  beam?: boolean;
  /** A faint perspective grid floor round the pedestal. */
  grid?: boolean;
  /** Pedestal width as a share of the stage width (0-1). Default 0.74. */
  pedestalSize?: number;
  /** The particle volume around the object. */
  particles?: boolean;
  /** Particle count multiplier. */
  density?: number;
  shape?: FieldShape;
  /** Particle field radius as a fraction of the stage's shorter side. */
  radius?: number;
  /** Particle speed multiplier. */
  speed?: number;
  /**
   * Particle layout seed. By default it is derived from tone and shape,
   * so two stages on one page with different looks do not show the same
   * sparkle pattern; pass one to tell apart two identical stages.
   */
  seed?: number;
  /** The floating object, e.g. <HoloShield glyph="user" />. It fills the object box. */
  children?: ReactNode;
  /** Sizes and positions the stage. It has no size of its own. */
  className?: string;
  /** Sizes the object's box (width; its height follows the object). Default w-[40%]. */
  objectClassName?: string;
  /** Element whose pointer drives the lean. Defaults to the nearest ancestor that takes the pointer (the panel). */
  hostRef?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
}

/**
 * A hero hologram: particles behind, the holographic pedestal, the
 * floating object, particles in front. The object bobs gently and leans
 * toward the pointer (--hx/--hy on this element, eased by the objects'
 * own CSS transitions), and the particle field turns toward it too.
 *
 * The caller sizes and places the stage (e.g. "absolute right-6 top-4
 * h-[300px] w-[420px]") and the object (objectClassName, a width).
 * Everything is inside that box: nothing is fixed to the viewport, and
 * the page's background video is never covered.
 *
 * Decorative only: aria-hidden, pointer-events none throughout (the
 * pointer is read from the host, so the panel's controls under it keep
 * working), CSS animations paused off screen, one still frame of
 * particles under reduced motion.
 */
export function HoloStage({
  tone = "aurora",
  palette,
  pedestal = true,
  beam = true,
  grid = false,
  pedestalSize,
  particles = true,
  density = 1,
  shape = "orbit",
  radius,
  speed,
  seed,
  children,
  className,
  objectClassName,
  hostRef,
  style,
}: HoloStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  usePointerLean(rootRef, hostRef);

  const vars = {
    ...paletteVars(resolvePalette(tone)),
    ...(pedestalSize ? { "--ped-size": pedestalSize } : null),
    ...style,
  } as CSSProperties;

  // Both layers must share one seed, or the back and front would be two
  // different fields rather than one field split at the object.
  const fieldSeed = seed ?? hashSeed(`${typeof tone === "string" ? tone : tone.join()}|${shape}`);

  const field = (layer: "back" | "front") =>
    particles ? (
      <ParticleField
        layer={layer}
        palette={palette ?? tone}
        density={density}
        shape={shape}
        radius={radius}
        speed={speed}
        seed={fieldSeed}
        anchorRef={objectRef}
        hostRef={hostRef}
        edgeFade
        className={layer === "back" ? styles.back : styles.front}
      />
    ) : null;

  return (
    <div ref={rootRef} aria-hidden className={`${styles.stage} ${cn("relative", className)}`} style={vars}>
      <div className={styles.halo} />
      {field("back")}
      {pedestal ? <HoloPedestal tone={tone} beam={beam} grid={grid} className={styles.stagePedestal} /> : null}
      <div
        ref={objectRef}
        className={`${styles.object} ${pedestal ? "" : styles.floating} ${cn("w-[40%]", objectClassName)}`}
      >
        <div className={styles.float}>{children}</div>
      </div>
      {field("front")}
    </div>
  );
}

/** FNV-1a: a stable 32-bit seed from a string. */
function hashSeed(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
