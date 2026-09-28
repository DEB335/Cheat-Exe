import type { CSSProperties } from "react";

export type RGB = readonly [number, number, number];

export type PaletteName = "aurora" | "violet" | "cyan" | "blue" | "pink" | "danger" | "emerald";

/** A named palette, or the particle colours themselves. */
export type PaletteInput = PaletteName | readonly RGB[];

/**
 * One hologram's colours. Every neon gradient in the holo set runs
 * a -> b -> c (the mockups' magenta -> violet -> electric blue, for
 * "aurora"), and `hot` is the near-white the brightest edges and the
 * particle cores burn at.
 */
export interface HoloPalette {
  /** Particle colours. Each is equally likely; white specks are mixed in separately. */
  particles: readonly RGB[];
  a: RGB;
  b: RGB;
  c: RGB;
  hot: RGB;
}

// The design language's neons, named once so the palettes below read
// as choices rather than numbers.
const MAGENTA: RGB = [255, 61, 242];
const PINK: RGB = [255, 79, 216];
const ROSE: RGB = [244, 114, 182];
const VIOLET: RGB = [139, 92, 246];
const PURPLE: RGB = [168, 85, 247];
const LILAC: RGB = [192, 132, 252];
const INDIGO: RGB = [99, 102, 241];
const BLUE: RGB = [59, 130, 246];
const SKY: RGB = [96, 165, 250];
const CYAN: RGB = [34, 211, 238];
const TEAL: RGB = [94, 234, 212];
const GREEN: RGB = [16, 224, 160];
const MINT: RGB = [52, 211, 153];
const RED: RGB = [255, 45, 85];
const CORAL: RGB = [251, 113, 133];
const WHITE: RGB = [255, 255, 255];

export const PALETTES: Record<PaletteName, HoloPalette> = {
  // The house look: magenta rims fading through violet into blue.
  aurora: {
    particles: [MAGENTA, PINK, PURPLE, VIOLET, BLUE, SKY],
    a: MAGENTA,
    b: VIOLET,
    c: BLUE,
    hot: [246, 226, 255],
  },
  violet: {
    particles: [PURPLE, VIOLET, LILAC, INDIGO, PINK],
    a: LILAC,
    b: PURPLE,
    c: INDIGO,
    hot: [240, 228, 255],
  },
  cyan: {
    particles: [CYAN, TEAL, SKY, BLUE],
    a: CYAN,
    b: SKY,
    c: BLUE,
    hot: [224, 250, 255],
  },
  blue: {
    particles: [BLUE, SKY, INDIGO, CYAN, VIOLET],
    a: SKY,
    b: BLUE,
    c: INDIGO,
    hot: [226, 238, 255],
  },
  pink: {
    particles: [PINK, MAGENTA, ROSE, PURPLE],
    a: PINK,
    b: MAGENTA,
    c: PURPLE,
    hot: [255, 228, 246],
  },
  // Bans and deletions: red into hot pink, never orange (orange is the
  // "warning" amber elsewhere on the panel).
  danger: {
    particles: [RED, CORAL, PINK, MAGENTA],
    a: RED,
    b: CORAL,
    c: PINK,
    hot: [255, 228, 234],
  },
  emerald: {
    particles: [GREEN, MINT, TEAL, CYAN],
    a: GREEN,
    b: MINT,
    c: CYAN,
    hot: [220, 255, 242],
  },
};

export function resolvePalette(input: PaletteInput = "aurora"): HoloPalette {
  if (typeof input === "string") return PALETTES[input] ?? PALETTES.aurora;
  const [a = MAGENTA, b = a, c = b] = input;
  return { particles: input.length ? input : PALETTES.aurora.particles, a, b, c, hot: mix(a, WHITE, 0.82) };
}

/** "rgb(r g b)" or, with alpha, "rgb(r g b / a)". */
export function rgb([r, g, b]: RGB, alpha?: number): string {
  return alpha === undefined ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/**
 * The palette as custom properties, for the CSS side of the holograms:
 * `rgb(var(--holo-a) / 0.5)` and so on. Set on a hologram's root; every
 * part inside it (and anything the caller nests there) picks it up.
 */
export function paletteVars(p: HoloPalette): CSSProperties {
  return {
    "--holo-a": triplet(p.a),
    "--holo-b": triplet(p.b),
    "--holo-c": triplet(p.c),
    "--holo-hot": triplet(p.hot),
  } as CSSProperties;
}

export function mix(from: RGB, to: RGB, amount: number): RGB {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

export function lighten(c: RGB, amount: number): RGB {
  return mix(c, WHITE, amount);
}

function triplet([r, g, b]: RGB) {
  return `${r} ${g} ${b}`;
}
