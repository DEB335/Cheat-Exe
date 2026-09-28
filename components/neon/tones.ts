/**
 * The neon kit's colour system.
 *
 * Every kit component takes a `tone` and publishes it as CSS custom
 * properties on its own root (see `toneVars`), so the Tailwind classes
 * inside can say `rgba(var(--tone),0.4)` and one class list serves all
 * nine colours. The values are rgb triplets rather than hex so alpha can
 * be set per use; they are tuned to the mockups, not to the older
 * --accent-* tokens, which are pitched for text and read grey at the
 * weight of a 1px neon rim.
 */

export type NeonTone =
  | "violet"
  | "magenta"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "amber"
  | "pink"
  | "red"
  /** Neutral glass, for secondary controls such as "Search user". */
  | "slate";

export interface ToneSpec {
  /** The tone itself, as "r, g, b": rims, glows, fills. */
  rgb: string;
  /** A lighter, brighter cut of it, as "r, g, b": text and icons on dark glass. */
  hi: string;
  /** Two stops for gradient fills (icon tiles, CTA-like fills), light -> deep. */
  ink: [string, string];
  /** Text colour on pale glass in light mode, where `hi` would vanish. */
  lt: string;
}

export const TONES: Record<NeonTone, ToneSpec> = {
  violet: { rgb: "139, 92, 246", hi: "196, 181, 253", ink: ["#b794ff", "#6d3df5"], lt: "#6d28d9" },
  magenta: { rgb: "222, 64, 255", hi: "244, 176, 255", ink: ["#f07bff", "#9b2cf0"], lt: "#a21caf" },
  blue: { rgb: "59, 130, 246", hi: "147, 197, 253", ink: ["#6fb2ff", "#2b5cf0"], lt: "#1d4ed8" },
  cyan: { rgb: "34, 211, 238", hi: "165, 243, 252", ink: ["#67e8f9", "#0891b2"], lt: "#0e7490" },
  teal: { rgb: "16, 224, 160", hi: "134, 247, 210", ink: ["#5ef2c4", "#059b72"], lt: "#0f766e" },
  green: { rgb: "52, 211, 120", hi: "150, 245, 180", ink: ["#6ff0a0", "#16a34a"], lt: "#15803d" },
  amber: { rgb: "245, 165, 36", hi: "253, 214, 128", ink: ["#ffd27a", "#e08a0b"], lt: "#b45309" },
  pink: { rgb: "255, 79, 176", hi: "255, 176, 218", ink: ["#ff8fcf", "#e0288a"], lt: "#be185d" },
  red: { rgb: "255, 45, 85", hi: "255, 150, 170", ink: ["#ff7a92", "#e0133f"], lt: "#be123c" },
  slate: { rgb: "148, 163, 204", hi: "226, 232, 245", ink: ["#c7d2fe", "#475569"], lt: "#334155" },
};

/**
 * The tone as custom properties, for a component's root `style`:
 *
 *   --tone     "r, g, b"   rgba(var(--tone), a)
 *   --tone-hi  "r, g, b"   the bright cut, for text and icons
 *   --tone-a / --tone-b    the gradient stops, as colours
 *   --tone-lt              light-mode text colour
 *
 * Each component sets its own, so a chip inside a stat tile inside a
 * panel keeps its colour without anything leaking down from the parent.
 */
export function toneVars(tone: NeonTone): React.CSSProperties {
  const t = TONES[tone];
  return {
    "--tone": t.rgb,
    "--tone-hi": t.hi,
    "--tone-a": t.ink[0],
    "--tone-b": t.ink[1],
    "--tone-lt": t.lt,
  } as React.CSSProperties;
}

/* ------------------------------------------------------------------
   Packages
   ------------------------------------------------------------------ */

/** The glyph each package wears, drawn by `PackageIcon`. */
export type PackageGlyph =
  | "layers"
  | "bolt"
  | "shield"
  | "shield-plus"
  | "diamond"
  | "crown"
  | "rocket"
  | "gear"
  | "cube";

interface PackageLook {
  tone: NeonTone;
  glyph: PackageGlyph;
}

/*
 * From the Key Generator mockup, which is the one that shows every
 * package side by side. Keys are the name upper-cased with everything
 * but letters and digits removed, so "Aim Silent EXE", "AIMSILENT EXE"
 * and "aimsilent-exe" all land on the same entry. The short labels the
 * reseller table uses (lib/packages.ts SHORT_LABELS) are listed too, so
 * a chip built from either spelling matches.
 */
const PACKAGE_LOOKS: Record<string, PackageLook> = {
  BASICPANEL: { tone: "magenta", glyph: "layers" },
  BASIC: { tone: "magenta", glyph: "layers" },
  AIMSILENTEXE: { tone: "teal", glyph: "bolt" },
  AIMSILENT: { tone: "teal", glyph: "bolt" },
  UIDBYPASS: { tone: "amber", glyph: "shield" },
  UID: { tone: "amber", glyph: "shield" },
  EXTERNALPANEL: { tone: "blue", glyph: "shield-plus" },
  EXTERNAL: { tone: "blue", glyph: "shield-plus" },
  PVTAIMKILL: { tone: "pink", glyph: "diamond" },
  PRIVATEAIMKILL: { tone: "pink", glyph: "diamond" },
  VAULTPANEL: { tone: "cyan", glyph: "crown" },
  VAULT: { tone: "cyan", glyph: "crown" },
  LIBBYPASS: { tone: "red", glyph: "rocket" },
  LIB: { tone: "red", glyph: "rocket" },
  FPSBOOSTER: { tone: "violet", glyph: "gear" },
  FPS: { tone: "violet", glyph: "gear" },
};

/** Tones a package the map does not know may be given; red is kept for danger. */
const FALLBACK_TONES: NeonTone[] = ["violet", "blue", "cyan", "teal", "magenta", "amber", "pink", "green"];

function packageKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * A package added upstream after this map was written still needs a
 * colour, and it should be the same one on every page and every load --
 * so it is hashed from the name (FNV-1a), never picked at random.
 */
function hashTone(key: string): NeonTone {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return FALLBACK_TONES[(h >>> 0) % FALLBACK_TONES.length];
}

/** Tone and glyph for a package name, case- and spacing-insensitive. */
export function packageLook(name: string): PackageLook {
  const key = packageKey(name);
  return PACKAGE_LOOKS[key] ?? { tone: hashTone(key), glyph: "cube" };
}

/** The tone a package is drawn in. Unknown names get a stable hashed tone. */
export function packageTone(name: string): NeonTone {
  return packageLook(name).tone;
}

/* ------------------------------------------------------------------
   Status
   ------------------------------------------------------------------ */

export type NeonStatus = "success" | "warning" | "info" | "danger" | "neutral";

export const STATUS_TONES: Record<NeonStatus, NeonTone> = {
  success: "green",
  warning: "amber",
  info: "blue",
  danger: "red",
  neutral: "slate",
};
