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
 * palette slot, and each has its own brightness `o`, so the still set
 * reads as a flicker caught mid-way rather than a row of equal bars.
 * None stands between 27 and 73: the shield covers that band.
 */
const BEAMS: { x: number; foot: number; h: number; tone: "a" | "b" | "c"; o: number }[] = [
  { x: 6, foot: 22, h: 44, tone: "c", o: 0.55 },
  { x: 12.5, foot: 30, h: 52, tone: "c", o: 0.95 },
  { x: 19, foot: 36, h: 38, tone: "b", o: 0.45 },
  { x: 26, foot: 42, h: 46, tone: "c", o: 0.8 },
  { x: 74, foot: 41, h: 48, tone: "a", o: 0.9 },
  { x: 81, foot: 35, h: 40, tone: "a", o: 0.5 },
  { x: 88, foot: 28, h: 54, tone: "b", o: 0.75 },
  { x: 94.5, foot: 21, h: 40, tone: "a", o: 1 },
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
 * Decorative: aria-hidden, no pointer events. The floor, its HUD rings
 * and the beams are a still frame; what moves is the kit's stage
 * (paused off screen, stopped under reduced motion).
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
                opacity: b.o,
                "--beam": `var(--holo-${b.tone})`,
              } as CSSProperties
            }
          />
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
