"use client";

import type { CSSProperties } from "react";

import { HoloShield, HoloStage, paletteVars, resolvePalette, useSvgIds, type RGB } from "@/components/holo";
import { cn } from "@/lib/utils";

import styles from "./scene-whitelist.module.css";

export { EntryAvatar, type EntryAvatarVariant } from "./whitelist-avatar";

// The mockup's hologram is bluer than the kit's "aurora": violet-magenta
// where the light catches the right-hand rim, then royal and electric
// blue through the glass, the glyph and the beam. The first three are
// the palette's a/b/c; all six colour the particles.
const TONE: readonly RGB[] = [
  [190, 90, 255],
  [72, 118, 255],
  [40, 150, 255],
  [96, 165, 250],
  [34, 211, 238],
  [255, 61, 242],
];
const PALETTE = resolvePalette(TONE);

// The streaks of the light curtain: where each stands (% across the
// curtain), how high it reaches (% of it) and how bright it burns, so
// the still curtain is uneven rather than a flat row. Fixed, so it
// looks the same on every mount.
const STREAKS = [
  { x: 2, h: 52, o: 0.5 },
  { x: 11, h: 84, o: 0.8 },
  { x: 20, h: 44, o: 0.4 },
  { x: 29, h: 72, o: 0.65 },
  { x: 41, h: 96, o: 0.9 },
  { x: 59, h: 90, o: 0.75 },
  { x: 71, h: 76, o: 0.55 },
  { x: 80, h: 48, o: 0.4 },
  { x: 89, h: 88, o: 0.7 },
  { x: 98, h: 58, o: 0.45 },
] as const;

// Lifts the shield clear of the pedestal, so the cards have room to
// hang in front of its lower half as they do in the mockup, and raises
// the pedestal off the box's floor so its bloom is not cut off.
const STAGE_VARS = { "--lift": "7cqw", "--ped-bottom": "5cqw" } as CSSProperties;

/**
 * The Add New UID panel's hero: a glass shield carrying a glowing user
 * on the holographic pedestal, a curtain of light rising behind it, an
 * ID card and a "UID" badge floating in front at different depths, and
 * the kit's sparkle particles round the lot.
 *
 * Designed for a ~340px square. The caller positions and sizes the root
 * (it needs both a width and a height); the scene is the largest square
 * that fits in it. Decorative only: hidden from assistive tech and
 * never takes the pointer. The curtain and the cards are still; they
 * ride the stage's float with the shield, which is all that moves.
 */
export function WhitelistScene({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`${styles.root} ${cn("pointer-events-none relative", className)}`} style={paletteVars(PALETTE)}>
      <div className={styles.square}>
        <div className={styles.curtain}>
          {STREAKS.map((s) => (
            <span key={s.x} style={{ left: `${s.x}%`, height: `${s.h}%`, opacity: s.o }} />
          ))}
        </div>
        <HoloStage
          tone={TONE}
          pedestalSize={0.84}
          // Denser than the kit's default: on a 1x screen at the
          // desktop's 75% zoom the sparkles otherwise thin out to specks.
          density={3}
          radius={0.5}
          className="absolute inset-0"
          objectClassName="w-[46%]"
          style={STAGE_VARS}
        >
          <HoloShield tone={TONE} glyph="user" />
          <div className={styles.props}>
            <div className={`${styles.card} ${styles.idCard}`}>
              <span className={styles.glassBack} />
              <span className={styles.glass} />
              <IdPrint />
            </div>
            <div className={`${styles.card} ${styles.uidCard}`}>
              <span className={styles.glassBack} />
              <span className={styles.glass} />
              <span className={styles.uidText}>UID</span>
            </div>
          </div>
        </HoloStage>
      </div>
    </div>
  );
}

/**
 * The ID card's face: a ringed avatar and a line of text, then two
 * label-and-value rows. Drawn in currentColor over a blurred copy of
 * itself for the glow, so light mode only has to change the colour.
 */
function IdPrint() {
  const { id, url } = useSvgIds("wl-id");
  const marks = (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <circle cx="26" cy="29" r="9.5" strokeWidth="3.2" />
      <circle cx="26" cy="29" r="3" fill="currentColor" stroke="none" />
      <path d="M46 25 H112 M46 34 H88" strokeWidth="4.6" />
      <path d="M17 55 H32 M17 76 H32" strokeWidth="6.4" strokeOpacity="0.8" />
      <path d="M44 55 H106 M44 76 H90" strokeWidth="4.6" />
    </g>
  );

  return (
    <svg className={styles.print} viewBox="0 0 142 100">
      <defs>
        <filter id={id("glow")} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <g filter={url("glow")} opacity="0.35">
        {marks}
      </g>
      {marks}
    </svg>
  );
}
