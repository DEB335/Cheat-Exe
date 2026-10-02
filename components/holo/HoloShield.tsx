"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HoloGlyph, isGlyphName, type HoloGlyphName } from "./glyphs";
import { usePauseWhenHidden, useSvgIds } from "./hooks";
import { paletteVars, resolvePalette, rgb, type PaletteInput } from "./palettes";
import styles from "./holo-objects.module.css";

// Outlines in a 100 x 112 box. "heater" is the classic shield with a
// peak at the top centre (whitelist, vault); "hex" the faceted one with
// straight shoulders (reseller). Each has its right half, the shaded
// facet, and a sliver of reflection down the left edge.
const SHAPES = {
  heater: {
    outline:
      "M50 3 C61 10 74 13.5 88 13.5 Q91 13.5 91 16.5 L91 50 C91 77 74 96 50 108 C26 96 9 77 9 50 L9 16.5 Q9 13.5 12 13.5 C26 13.5 39 10 50 3 Z",
    right: "M50 3 C61 10 74 13.5 88 13.5 Q91 13.5 91 16.5 L91 50 C91 77 74 96 50 108 Z",
    sheen:
      "M13.5 19 Q13.5 17 15.5 17 C28 16.6 39 13.2 48 8.4 L48 12.6 C39 17.4 29 20.3 18.2 21 L18 50 C18 58 19 64.5 21 71 L16.4 71 C14.6 65 13.5 58 13.5 50 Z",
    glyph: { x: 21, y: 25, size: 58 },
  },
  hex: {
    outline: "M50 4 L89 20.5 Q91 21.4 91 23.6 L91 60 Q91 65.6 87.4 69.8 L54.2 105.4 Q50 109.8 45.8 105.4 L12.6 69.8 Q9 65.6 9 60 L9 23.6 Q9 21.4 11 20.5 Z",
    right: "M50 4 L89 20.5 Q91 21.4 91 23.6 L91 60 Q91 65.6 87.4 69.8 L54.2 105.4 Q50 109.8 50 108 Z",
    sheen: "M14 25 L46 11.2 L46 15.6 L18.4 27.4 L18.4 60 Q18.4 63.4 20.4 66 L16.6 66 Q14 63 14 60 Z",
    glyph: { x: 21, y: 24, size: 58 },
  },
} as const;

export type HoloShieldShape = keyof typeof SHAPES;

export interface HoloShieldProps {
  /** Palette name or colours. Default "aurora". */
  tone?: PaletteInput;
  /** The symbol floating in front of the glass: a built-in name or any node. */
  glyph?: HoloGlyphName | ReactNode;
  shape?: HoloShieldShape;
  /** The soft glow behind the shield. */
  halo?: boolean;
  /** Position and width (the height follows, 112:100). Defaults to the full width of its box. */
  className?: string;
}

/**
 * A glassy neon shield, like the reseller, whitelist and vault heroes:
 * three stacked outlines give the glass its thickness once it turns, the
 * face is a glass gradient with a shaded right facet, a reflection and
 * an inset second rim, and the edge is a crisp gradient rim over a
 * blurred bloom. The glyph floats in front of the glass on its own
 * plane, so it parallaxes as the shield rocks (and bobs too, inside a
 * HoloStage).
 */
export function HoloShield({ tone = "aurora", glyph = "user", shape = "heater", halo = true, className }: HoloShieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds("hs");
  const p = resolvePalette(tone);
  const s = SHAPES[shape];
  const named = isGlyphName(glyph);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.object} ${styles.shield} ${cn("relative w-full", className)}`}
      style={paletteVars(p)}
    >
      <div className={styles.scene}>
        {halo ? <div className={styles.halo} /> : null}
        <div className={styles.idle}>
          <svg className={`${styles.layer} ${styles.plateBack}`} viewBox="0 0 100 112">
            <path d={s.outline} fill={rgb(p.c, 0.22)} stroke={rgb(p.b, 0.55)} strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <svg className={`${styles.layer} ${styles.plateMid}`} viewBox="0 0 100 112">
            <path d={s.outline} fill={rgb(p.c, 0.08)} stroke={rgb(p.a, 0.5)} strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          <svg className={styles.layer} viewBox="0 0 100 112">
            <defs>
              <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={rgb(p.hot)} stopOpacity="0.36" />
                <stop offset="0.42" stopColor={rgb(p.b)} stopOpacity="0.2" />
                <stop offset="1" stopColor={rgb(p.c)} stopOpacity="0.42" />
              </linearGradient>
              {/* The rim runs c on the left through b to a on the right, like the mockups. */}
              <linearGradient id={id("rim")} x1="0" y1="0.15" x2="1" y2="0.85">
                <stop offset="0" stopColor={rgb(p.c)} />
                <stop offset="0.28" stopColor={rgb(p.hot)} />
                <stop offset="0.55" stopColor={rgb(p.b)} />
                <stop offset="1" stopColor={rgb(p.a)} />
              </linearGradient>
              <linearGradient id={id("sheen")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.8" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id={id("core")}>
                <stop offset="0" stopColor={rgb(p.a)} stopOpacity="0.17" />
                <stop offset="0.6" stopColor={rgb(p.b)} stopOpacity="0.06" />
                <stop offset="1" stopColor={rgb(p.b)} stopOpacity="0" />
              </radialGradient>
              <filter id={id("bloom")} x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="1.8" />
              </filter>
            </defs>
            <path d={s.outline} fill="#0b0f3a" fillOpacity="0.55" className={styles.darkFill} />
            <path d={s.outline} fill={url("body")} />
            <path d={s.right} fill="#1b1660" fillOpacity="0.3" className={styles.darkFill} />
            <ellipse cx="50" cy="56" rx="36" ry="40" fill={url("core")} />
            <path d="M50 8 V104" stroke={rgb(p.hot)} strokeOpacity="0.16" strokeWidth="0.8" />
            <path d={s.sheen} fill={url("sheen")} opacity="0.5" />
            <path
              d={s.outline}
              transform="translate(50 57) scale(0.84) translate(-50 -57)"
              fill="none"
              stroke={rgb(p.hot)}
              strokeOpacity="0.5"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d={s.outline} fill="none" stroke={url("rim")} strokeOpacity="0.48" strokeWidth="6" filter={url("bloom")} />
            <path d={s.outline} fill="none" stroke={url("rim")} strokeWidth="2.2" strokeLinejoin="round" />
            <path d={s.outline} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.6" strokeLinejoin="round" />
          </svg>
          <div className={styles.glyphGlow} />
          {named ? (
            <svg className={`${styles.layer} ${styles.glyph}`} viewBox="0 0 100 112">
              <HoloGlyph glyph={glyph} p={p} id={id} url={url} {...s.glyph} />
            </svg>
          ) : glyph ? (
            <div className={styles.glyphSlot}>{glyph}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
