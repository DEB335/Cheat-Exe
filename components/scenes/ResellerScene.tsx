"use client";

import { useRef, type CSSProperties } from "react";

import { HoloShield, HoloStage, paletteVars, PALETTES, usePauseWhenHidden } from "@/components/holo";
import { cn } from "@/lib/utils";

import { GlassUser } from "./resellers-glass-user";
import { PED_BOTTOM, PED_SIZE, ResellerFloor } from "./resellers-floor";
import styles from "./scene-resellers.module.css";

/**
 * Thin shafts of light rising off the floor behind the hologram, as in
 * the mockup: x and the foot's height are % of the rig, the colour is a
 * palette slot, and a few carry a glint climbing them. Each pulses on its
 * own period, so they never flash together.
 */
const BEAMS: { x: number; foot: number; h: number; tone: "a" | "b" | "c"; s: number; glint?: boolean }[] = [
  { x: 6, foot: 22, h: 44, tone: "c", s: 7.2 },
  { x: 12.5, foot: 30, h: 52, tone: "c", s: 5.6, glint: true },
  { x: 19, foot: 36, h: 38, tone: "b", s: 8.4 },
  { x: 26, foot: 42, h: 46, tone: "c", s: 6.3 },
  { x: 33, foot: 45, h: 34, tone: "b", s: 9.1, glint: true },
  { x: 67, foot: 45, h: 36, tone: "b", s: 7.7 },
  { x: 74, foot: 41, h: 48, tone: "a", s: 5.9, glint: true },
  { x: 81, foot: 35, h: 40, tone: "a", s: 8.8 },
  { x: 88, foot: 28, h: 54, tone: "b", s: 6.6 },
  { x: 94.5, foot: 21, h: 40, tone: "a", s: 7.9, glint: true },
];

/**
 * The Reseller Management hero: a glass hex shield holding a glass user,
 * floating over the kit's holographic pedestal, with a perspective grid
 * floor, rings and HUD dashes round the pad, shafts of light rising
 * behind, and the kit's 3D star-glint particles swirling through it all.
 *
 * Designed for a ~380 x 380 box. The caller positions and sizes the root
 * (both dimensions); everything is drawn in a square "rig" centred in it
 * as large as fits, so a wider or taller box never stretches it and
 * nothing leaves the box. One particle stage (two canvases, back and
 * front of the shield).
 *
 * Decorative: aria-hidden, no pointer events (the shield still leans
 * toward the pointer over the panel), animations paused off screen and
 * stopped under reduced motion.
 */
export function ResellerScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.root} ${cn("pointer-events-none relative", className)}`}
      style={paletteVars(PALETTES.aurora)}
    >
      <div className={styles.rig}>
        <div className={styles.haze} />
        <ResellerFloor />
        {BEAMS.map((b) => (
          <span
            key={b.x}
            className={styles.beam}
            style={
              {
                left: `${b.x}%`,
                bottom: `${b.foot}%`,
                height: `${b.h}%`,
                "--beam": `var(--holo-${b.tone})`,
                "--beam-s": `${b.s}s`,
              } as CSSProperties
            }
          >
            {b.glint ? <span /> : null}
          </span>
        ))}
        <HoloStage
          tone="aurora"
          density={2.4}
          radius={0.5}
          pedestalSize={PED_SIZE}
          className="absolute inset-0"
          objectClassName="w-[62%]"
          style={{ "--ped-bottom": `${PED_BOTTOM}cqw` } as CSSProperties}
        >
          <HoloShield tone="aurora" shape="hex" glyph={<GlassUser />} />
        </HoloStage>
      </div>
    </div>
  );
}
