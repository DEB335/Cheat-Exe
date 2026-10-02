"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

import { usePauseWhenHidden, useSvgIds } from "./hooks";
import { paletteVars, resolvePalette, rgb, type PaletteInput } from "./palettes";
import styles from "./holo-objects.module.css";

// One closed outline in a 200 x 90 box, bow on the left (centre 36,45),
// teeth up along the bit -- a single path, so the neon line never shows
// a seam where the bow meets the shaft. The hole is cut with evenodd.
const KEY =
  "M62.8 37 L70 37 L70 32 L80 32 L80 37 L136 37 L136 24 L146 24 L146 37 L154 37 L154 28.5 L164 28.5 L164 37 " +
  "L172 37 L172 24 L182 24 Q187 24 187 29 L187 49 Q187 53 183 53 L80 53 L80 58 L70 58 L70 53 L62.8 53 " +
  "A28 28 0 1 1 62.8 37 Z M36 32 A13 13 0 1 0 36 58 A13 13 0 1 0 36 32 Z";

export interface HoloKeyProps {
  /** Palette name or colours. Default "blue", like the Manage Key hero. */
  tone?: PaletteInput;
  /** The soft glow behind the key. */
  halo?: boolean;
  /** Position and width (the height follows, 5:6). Defaults to the full width of its box. */
  className?: string;
}

/**
 * A neon key hologram, like the Manage Key hero: a glowing glass tube
 * traced round the key's outline -- a coloured sheath with a white-hot
 * core over a wide bloom -- laid along the diagonal and tilted back in
 * 3D. Two dimmer copies behind it give the glass its depth as it sways
 * (and bobs too, inside a HoloStage).
 */
export function HoloKey({ tone = "blue", halo = true, className }: HoloKeyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds("hk");
  const p = resolvePalette(tone);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.object} ${styles.key} ${cn("relative w-full", className)}`}
      style={paletteVars(p)}
    >
      <div className={styles.scene}>
        {halo ? <div className={styles.halo} /> : null}
        <div className={styles.idle}>
          <div className={styles.keyBody}>
            <svg className={`${styles.layer} ${styles.keyBack}`} viewBox="0 0 200 90">
              <path d={KEY} fillRule="evenodd" fill={rgb(p.c, 0.12)} stroke={rgb(p.c, 0.5)} strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <svg className={`${styles.layer} ${styles.keyMid}`} viewBox="0 0 200 90">
              <path d={KEY} fillRule="evenodd" fill="none" stroke={rgb(p.b, 0.45)} strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <svg className={styles.layer} viewBox="0 0 200 90">
              <defs>
                <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={rgb(p.hot)} stopOpacity="0.32" />
                  <stop offset="0.5" stopColor={rgb(p.b)} stopOpacity="0.2" />
                  <stop offset="1" stopColor={rgb(p.c)} stopOpacity="0.32" />
                </linearGradient>
                <linearGradient id={id("tube")} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={rgb(p.a)} />
                  <stop offset="0.5" stopColor={rgb(p.b)} />
                  <stop offset="1" stopColor={rgb(p.a)} />
                </linearGradient>
                <filter id={id("bloom")} x="-15%" y="-40%" width="130%" height="180%">
                  <feGaussianBlur stdDeviation="2" />
                </filter>
              </defs>
              <path d={KEY} fillRule="evenodd" fill={url("glass")} />
              <path d={KEY} fillRule="evenodd" fill="none" stroke={rgb(p.b)} strokeOpacity="0.48" strokeWidth="10" filter={url("bloom")} />
              <path d={KEY} fillRule="evenodd" fill="none" stroke={url("tube")} strokeWidth="5.2" strokeLinejoin="round" />
              <path
                d={KEY}
                fillRule="evenodd"
                fill="none"
                stroke={rgb(p.hot)}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              {/* A glint along the top of the shaft. */}
              <path d="M86 41 H130" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M17 36 A20 20 0 0 1 30 26" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
