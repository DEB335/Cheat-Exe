import type { HoloPalette } from "./palettes";
import { rgb } from "./palettes";

export type HoloGlyphName = "user" | "x" | "lock" | "check" | "key";

const GLYPHS: readonly string[] = ["user", "x", "lock", "check", "key"] satisfies HoloGlyphName[];

export function isGlyphName(value: unknown): value is HoloGlyphName {
  return typeof value === "string" && GLYPHS.includes(value);
}

interface GlyphProps {
  glyph: HoloGlyphName;
  p: HoloPalette;
  /** Namespaces the gradient/filter ids; see useSvgIds. */
  id: (name: string) => string;
  url: (name: string) => string;
  /** Where the glyph's 40x40 box lands in the parent SVG. */
  x: number;
  y: number;
  size: number;
}

/**
 * The glowing symbols the holograms carry: a glass user, a padlock, a
 * key, a crossed circle and a check. Each is drawn in its own 40 x 40
 * box and dropped into the parent SVG at (x, y, size), so a shield and
 * a cube face can share them.
 *
 * Every one is the same recipe: a blurred copy underneath for the neon
 * bloom, then the crisp glass shape on top with a white-hot highlight.
 * It is static SVG, painted once; the motion around it is transforms.
 */
export function HoloGlyph({ glyph, p, id, url, x, y, size }: GlyphProps) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 40 40" overflow="visible">
      <defs>
        <linearGradient id={id("g-fill")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={rgb(p.hot)} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={rgb(p.b)} stopOpacity="0.85" />
          <stop offset="1" stopColor={rgb(p.c)} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={id("g-stroke")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rgb(p.hot)} />
          <stop offset="0.5" stopColor={rgb(p.a)} />
          <stop offset="1" stopColor={rgb(p.b)} />
        </linearGradient>
        {/* Glass bodies: tinted c -> b -> a across, with a separate white
            shine on top so each part reads as a lit sphere. */}
        <linearGradient id={id("g-glass")} x1="0" y1="0.2" x2="1" y2="0.8">
          <stop offset="0" stopColor={rgb(p.c)} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={rgb(p.b)} stopOpacity="0.8" />
          <stop offset="1" stopColor={rgb(p.a)} stopOpacity="0.92" />
        </linearGradient>
        <radialGradient id={id("g-orb")} cx="0.34" cy="0.28" r="0.72">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.28" stopColor={rgb(p.hot)} stopOpacity="0.4" />
          <stop offset="0.75" stopColor={rgb(p.hot)} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("g-gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={id("g-bloom")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g filter={url("g-bloom")} opacity="0.95">
        <GlyphShape glyph={glyph} fill={rgb(glyph === "user" ? p.b : p.a)} stroke={rgb(p.b)} bloom />
      </g>
      <GlyphShape
        glyph={glyph}
        fill={url("g-fill")}
        stroke={url("g-stroke")}
        glass={url("g-glass")}
        orb={url("g-orb")}
        gloss={url("g-gloss")}
      />
    </svg>
  );
}

const BUST = "M6.5 36 C6.5 26.8 12.6 22.2 20 22.2 C27.4 22.2 33.5 26.8 33.5 36 Q33.5 37.8 31.7 37.8 L8.3 37.8 Q6.5 37.8 6.5 36 Z";

function GlyphShape({
  glyph,
  fill,
  stroke,
  glass,
  orb,
  gloss,
  bloom = false,
}: {
  glyph: HoloGlyphName;
  fill: string;
  stroke: string;
  glass?: string;
  orb?: string;
  gloss?: string;
  bloom?: boolean;
}) {
  // The bloom copy is drawn a little heavier so the glow clears the edges.
  const w = (base: number) => (bloom ? base + 1.6 : base);

  switch (glyph) {
    case "user":
      // A glassy sphere for the head over a rounded bust, like the
      // reseller and whitelist shields.
      return (
        <g>
          <circle cx="20" cy="12.5" r="7.6" fill={glass ?? fill} stroke={stroke} strokeWidth={w(1.1)} />
          <path d={BUST} fill={glass ?? fill} stroke={stroke} strokeWidth={w(1.1)} strokeLinejoin="round" />
          {orb && gloss ? (
            <>
              <circle cx="20" cy="12.5" r="7.6" fill={orb} />
              <path d={BUST} fill={orb} />
              <ellipse cx="17.4" cy="9.6" rx="3.4" ry="2.1" fill={gloss} transform="rotate(-24 17.4 9.6)" />
              <path d="M11 29 C12.4 26 15.4 24.4 19 24.2" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : null}
        </g>
      );
    case "x":
      return (
        <g fill="none" stroke={stroke} strokeWidth={w(3)} strokeLinecap="round">
          <circle cx="20" cy="20" r="13.5" />
          <path d="M13.2 13.2 L26.8 26.8 M26.8 13.2 L13.2 26.8" />
          {gloss ? <path d="M9.4 15 A12 12 0 0 1 16 8" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.2" /> : null}
        </g>
      );
    case "check":
      return (
        <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 21 L17 28 L31 13" strokeWidth={w(4.2)} />
          {gloss ? <path d="M11.4 20.2 L16.8 25.6" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.1" /> : null}
        </g>
      );
    case "lock":
      return (
        <g>
          <path d="M13 18.5 V13 A7 7 0 0 1 27 13 V18.5" fill="none" stroke={stroke} strokeWidth={w(3.4)} strokeLinecap="round" />
          <rect x="7.5" y="17" width="25" height="20" rx="5" fill={fill} stroke={stroke} strokeWidth={w(1)} />
          {gloss ? (
            <>
              <rect x="9.5" y="18.4" width="21" height="7" rx="3.5" fill={gloss} />
              <circle cx="20" cy="25.6" r="2.8" fill="#0b1033" fillOpacity="0.85" />
              <path d="M18.6 27 H21.4 L22 32 H18 Z" fill="#0b1033" fillOpacity="0.85" />
            </>
          ) : null}
        </g>
      );
    case "key":
      // Bow up and to the right, bit down to the left: the key on the
      // generator's glass cube.
      return (
        <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="25.5" cy="14.5" r="7.2" strokeWidth={w(3.2)} />
          <path d="M20.4 19.6 L7.5 32.5 M11.5 28.5 L15 32 M14.8 25.2 L17.6 28" strokeWidth={w(3.2)} />
          {gloss ? <path d="M21.6 10.6 A5.2 5.2 0 0 1 27 9.4" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.1" /> : null}
        </g>
      );
  }
}
