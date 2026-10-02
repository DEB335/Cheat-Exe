"use client";

import { resolvePalette, rgb, useSvgIds, type PaletteInput } from "@/components/holo";

import styles from "./scene-resellers.module.css";

// A sphere for the head over a rounded bust, in a 100 x 100 box that
// overhangs the shield's glyph slot (see .user). Drawn a little above
// the box's centre, so the bust ends where the hex shield's face is
// still wide enough to hold it.
const HEAD = { cx: 50, cy: 28.5, r: 21 };
const BODY = "M22 89.5 Q14 89.5 14 81.5 C14 65 30 52.5 50 52.5 C70 52.5 86 65 86 81.5 Q86 89.5 78 89.5 Z";

/**
 * The glass user that stands inside the reseller shield. The kit's
 * "user" glyph is a flat neon fill; the mockup's is a pair of glass
 * solids, so each part here is built like one: a dark core the light
 * passes through, colour pooling where it exits (magenta, bottom right),
 * a fresnel rim that brightens toward the edge, a white-hot highlight
 * where the light enters (top left), and a burning crescent where it
 * leaves. A blurred copy underneath is the neon bloom.
 *
 * Static SVG, painted once: the shield it floats in does the moving.
 */
export function GlassUser({ tone = "aurora" }: { tone?: PaletteInput }) {
  const { id, url } = useSvgIds("gu");
  const p = resolvePalette(tone);

  return (
    <svg viewBox="0 0 100 100" aria-hidden className={styles.user}>
      <defs>
        {/* The colour the glass carries: it pools opposite the light. */}
        <radialGradient id={id("tint")} cx="0.66" cy="0.74" r="0.8">
          <stop offset="0" stopColor={rgb(p.a)} stopOpacity="0.78" />
          <stop offset="0.45" stopColor={rgb(p.b)} stopOpacity="0.62" />
          <stop offset="1" stopColor={rgb(p.c)} stopOpacity="0.72" />
        </radialGradient>
        {/* Fresnel: glass reflects more the flatter it is seen, so the
            edge burns and the middle stays clear. */}
        <radialGradient id={id("fresnel")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.62" stopColor={rgb(p.hot)} stopOpacity="0" />
          <stop offset="0.9" stopColor={rgb(p.hot)} stopOpacity="0.32" />
          <stop offset="1" stopColor={rgb(p.hot)} stopOpacity="0.62" />
        </radialGradient>
        <linearGradient id={id("wash")} x1="0" y1="0" x2="0.75" y2="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rgb(p.c)} />
          <stop offset="0.3" stopColor={rgb(p.hot)} />
          <stop offset="0.62" stopColor={rgb(p.b)} />
          <stop offset="1" stopColor={rgb(p.a)} />
        </linearGradient>
        <linearGradient id={id("gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("exit")} x1="1" y1="0" x2="0" y2="0.4">
          <stop offset="0" stopColor={rgb(p.hot)} />
          <stop offset="0.45" stopColor={rgb(p.a)} />
          <stop offset="1" stopColor={rgb(p.a)} stopOpacity="0" />
        </linearGradient>
        <filter id={id("bloom")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.9" />
        </filter>
        <filter id={id("soft")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      {/* Neon bloom round both solids. */}
      <g filter={url("bloom")} opacity="0.42">
        <circle {...HEAD} fill={rgb(p.b)} stroke={rgb(p.a)} strokeWidth="3" />
        <path d={BODY} fill={rgb(p.b)} stroke={rgb(p.a)} strokeWidth="3" />
      </g>

      {[
        <circle key="head" {...HEAD} />,
        <path key="body" d={BODY} />,
      ].map((shape) => (
        <g key={shape.key}>
          {/* Dark core, then the tint, the edge reflection and the light coming in. */}
          <g className={styles.userCore}>{shape}</g>
          <g fill={url("tint")}>{shape}</g>
          <g fill={url("fresnel")}>{shape}</g>
          <g fill={url("wash")}>{shape}</g>
          <g fill="none" stroke={url("rim")} strokeWidth="1.5" strokeLinejoin="round">
            {shape}
          </g>
        </g>
      ))}

      {/* Where the light leaves: a burning crescent low on the right of each. */}
      <g fill="none" stroke={url("exit")} strokeLinecap="round">
        <g filter={url("soft")} strokeWidth="3.4" opacity="0.4">
          <path d="M69 33.6 A19.7 19.7 0 0 1 44.9 47.5" />
          <path d="M74.6 61.8 C81.5 66.5 84.8 73 84.8 81.3 Q84.8 88.3 77.8 88.3 L44 88.3" />
        </g>
        <g strokeWidth="1.3">
          <path d="M69 33.6 A19.7 19.7 0 0 1 44.9 47.5" />
          <path d="M74.6 61.8 C81.5 66.5 84.8 73 84.8 81.3 Q84.8 88.3 77.8 88.3 L44 88.3" />
        </g>
      </g>

      {/* Where it comes in: a gloss on the sphere and along the shoulder. */}
      <ellipse cx="41.5" cy="19" rx="8.6" ry="5" fill={url("gloss")} transform="rotate(-36 41.5 19)" />
      <circle cx="36.2" cy="24.8" r="1.3" fill="#fff" fillOpacity="0.85" />
      <path
        d="M21.5 77 C23 64 34.5 56 48.5 55.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.62"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="56" cy="55.7" r="1" fill="#fff" fillOpacity="0.8" />

      {/* Faint refraction through the bust's glass. */}
      <path d="M27 86 C33 75.5 44.5 70 60 71" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="0.7" />
      <path d="M39 88 C46 81.5 56 79 69 80.6" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="0.6" />
    </svg>
  );
}
