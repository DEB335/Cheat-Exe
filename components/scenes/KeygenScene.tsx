"use client";

import { useRef, type CSSProperties } from "react";

import { mix, PALETTES, ParticleField, usePauseWhenHidden, usePointerLean, useSvgIds, type RGB } from "@/components/holo";
import { cn } from "@/lib/utils";

import styles from "./scene-generator.module.css";

// The mockup's neons, from the holo palettes so the sparkle matches the
// rest of the set: cyan and sky on the lit side, violet through magenta
// on the other.
const CYAN = PALETTES.cyan.a;
const SKY = PALETTES.blue.a;
const BLUE = PALETTES.aurora.c;
const VIOLET = PALETTES.aurora.b;
const MAGENTA = PALETTES.aurora.a;
const PINK = PALETTES.pink.a;

/** Particle colours. The first sets the white-hot tint, so the brightest specks read pale cyan. */
const SPARKLE: readonly RGB[] = [CYAN, MAGENTA, VIOLET, BLUE, SKY, PINK];
/** Fixed, so the field is the same on every mount and both layers draw one field. */
const SEED = 0x6e7_c0be;

/**
 * The tile's centre as fractions of the box: right of centre, leaving
 * room for the big glass cube low on the left. The CSS reads the same
 * numbers (--kg-x/--kg-y) and the particle orbit is centred on them.
 */
const TILE_X = 0.58;
const TILE_Y = 0.45;

interface Cube {
  /** Centre, as fractions of the box. */
  x: number;
  y: number;
  /** Edge, as a share of the tile's edge. */
  size: number;
  c1: RGB;
  c2: RGB;
  /** Roll in degrees, and seconds per turn, per bob and of head start. */
  roll: number;
  spin: number;
  bob: number;
  delay: number;
  /** Near cubes sit in front of the particles, far ones behind. */
  near?: boolean;
}

// Three glass dice at different depths, as in the mockup's corners:
// a far one up to the left, a pink one up on the right, and a big near
// one low on the left, in front of everything.
const CUBES: readonly Cube[] = [
  { x: 0.31, y: 0.2, size: 0.17, c1: CYAN, c2: VIOLET, roll: 12, spin: 34, bob: 7.5, delay: -3 },
  { x: 0.9, y: 0.24, size: 0.2, c1: MAGENTA, c2: VIOLET, roll: -18, spin: 26, bob: 6.2, delay: -1.5 },
  { x: 0.15, y: 0.66, size: 0.36, c1: CYAN, c2: MAGENTA, roll: 20, spin: 40, bob: 8.4, delay: -5, near: true },
];

const pct = (v: number) => `${v * 100}%`;
const triplet = (c: RGB) => c.join(" ");

/**
 * The Key Generator's hologram, for the space under the Generated Keys
 * console: a thick violet-blue glass tile with a glowing cyan key on its
 * face, tipped in 3D and floating inside a neon orbit ring with a comet
 * of light running round it, three small glass cubes drifting at
 * different depths, and a volume of sparkle particles circling the
 * tile, half behind it and half in front.
 *
 * The caller positions and sizes it -- it needs a definite width and
 * height (designed round ~480 x 260; anything within about 40% either
 * way keeps its proportions) -- and everything stays inside that box.
 * Decorative only: aria-hidden and pointer-events none throughout; the
 * tile leans toward the pointer over the nearest panel, the animations
 * pause off screen or in a hidden tab, and reduced motion gets one
 * still frame.
 */
export function KeygenScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  usePointerLean(rootRef);

  const vars = { "--kg-x": pct(TILE_X), "--kg-y": pct(TILE_Y) } as CSSProperties;

  // Both layers share every prop but the layer, so they split one field
  // at the tile's plane rather than drawing two.
  const field = (layer: "back" | "front") => (
    <ParticleField
      layer={layer}
      palette={SPARKLE}
      density={1.6}
      shape="orbit"
      cx={TILE_X}
      cy={TILE_Y}
      radius={0.56}
      spread={1.15}
      seed={SEED}
      edgeFade
      className={layer === "back" ? "z-0" : "z-[3]"}
    />
  );

  return (
    <div ref={rootRef} aria-hidden className={`${styles.root} ${cn("pointer-events-none relative", className)}`} style={vars}>
      {field("back")}
      <div className={styles.halo} />
      <div className={styles.pool} />
      {CUBES.filter((c) => !c.near).map((c) => (
        <GlassCube key={`${c.x}-${c.y}`} cube={c} />
      ))}
      <Orbit half="back" />
      <KeyTile />
      <Orbit half="front" />
      {field("front")}
      {CUBES.filter((c) => c.near).map((c) => (
        <GlassCube key={`${c.x}-${c.y}`} cube={c} />
      ))}
    </div>
  );
}

/** Corner radius as a share of the tile's edge (the CSS's 22%). */
const CORNER = 0.22;
/** Each corner is three flat facets, 30deg of the arc apiece; this is half a facet's angle. */
const HALF_FACET = Math.PI / 12;

// Wall colours round the edge by the direction a wall faces (0deg is
// right, clockwise): magenta on the right, violet below, cyan on the
// left and sky along the top, blending through the corners -- the same
// run as the face's rim.
const WALL_STOPS: readonly RGB[] = [MAGENTA, VIOLET, CYAN, SKY, MAGENTA];
const wallColour = (deg: number) => {
  const i = Math.floor(deg / 90) % 4;
  return mix(WALL_STOPS[i]!, WALL_STOPS[i + 1]!, (deg % 90) / 90);
};

/**
 * The slab's side walls, as fractions of the edge: four straights out
 * from the centre between the corners, and three facets round each
 * corner out from the corner's centre, a hair over a chord long so the
 * seams close.
 */
const WALLS = [
  ...[0, 90, 180, 270].map((a) => ({ ax: 0.5, ay: 0.5, a, d: 0.5, len: 1 - 2 * CORNER })),
  ...(
    [
      [1 - CORNER, 1 - CORNER, 0],
      [CORNER, 1 - CORNER, 90],
      [CORNER, CORNER, 180],
      [1 - CORNER, CORNER, 270],
    ] as const
  ).flatMap(([ax, ay, from]) =>
    [15, 45, 75].map((k) => ({
      ax,
      ay,
      a: from + k,
      d: CORNER * Math.cos(HALF_FACET),
      len: 2 * CORNER * Math.sin(HALF_FACET) * 1.08,
    })),
  ),
].map(({ ax, ay, a, d, len }) => ({
  key: `${ax}-${ay}-${a}`,
  style: {
    "--ax": pct(ax),
    "--ay": pct(ay),
    "--a": `${a}deg`,
    "--d": `calc(var(--s) * ${d})`,
    "--len": `calc(var(--s) * ${len})`,
    "--w": triplet(wallColour(a)),
  } as CSSProperties,
}));

/** The glass slab: back plate, walls all round for its depth, the lit face, the key off the glass. */
function KeyTile() {
  return (
    <div className={styles.tile}>
      <div className={styles.tileFloat}>
        <div className={styles.tileScene}>
          <div className={styles.tileLean}>
            <div className={styles.tileIdle}>
              <div className={styles.tilePose}>
                <div className={`${styles.slab} ${styles.back}`} />
                <div className={`${styles.slab} ${styles.rim} ${styles.backRim}`} />
                {WALLS.map((w) => (
                  <div key={w.key} className={styles.wall} style={w.style} />
                ))}
                <div className={`${styles.slab} ${styles.face}`}>
                  <div className={styles.sheen} />
                  <div className={styles.bevel} />
                  <div className={`${styles.slab} ${styles.rim}`} />
                </div>
                <div className={styles.glyphGlow} />
                <KeyGlyph />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The key on the tile's face, bow up to the right and bit down to the
 * left: a neon bloom underneath, a white-hot outline, then the glass
 * body over it (so the outline only shows round the edge, never where
 * the parts join), and two glints. Static SVG, painted once.
 */
function KeyGlyph() {
  const { id, url } = useSvgIds("kg");
  return (
    <svg className={styles.glyph} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={id("body")} gradientUnits="userSpaceOnUse" x1="14" y1="36" x2="86" y2="64">
          <stop offset="0" style={{ stopColor: "var(--kg-glyph-c)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--kg-glyph-b)" }} />
          <stop offset="0.8" style={{ stopColor: "var(--kg-glyph-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--kg-glyph-hot)" }} />
        </linearGradient>
        <filter id={id("bloom")} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <g transform="rotate(-38 50 50)">
        <g filter={url("bloom")} opacity="0.45">
          <KeyShape paint="var(--kg-glyph-bloom)" grow={2.4} />
        </g>
        <KeyShape paint="var(--kg-glyph-hot)" grow={1.5} />
        <KeyShape paint={url("body")} grow={0} />
        <path d="M59.5 40.5 A13 13 0 0 1 72 36.6" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 47.6 H44" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * The key's silhouette, lying flat (the caller turns it): a ring bow, a
 * collar, the shaft and two teeth. `grow` fattens every part by that
 * many units all round, for the outline and the bloom.
 */
function KeyShape({ paint, grow }: { paint: string; grow: number }) {
  const edge: CSSProperties = grow ? { stroke: paint, strokeWidth: grow * 2, strokeLinejoin: "round" } : {};
  return (
    <g style={{ fill: paint, ...edge }}>
      <circle cx="68" cy="50" r="14" style={{ fill: "none", stroke: paint, strokeWidth: 10 + grow * 2 }} />
      <rect x="47" y="42" width="6" height="16" rx="2" />
      <rect x="12" y="45.5" width="40" height="9" rx="3" />
      <rect x="14" y="52" width="7" height="13" rx="1.6" />
      <rect x="25.5" y="52" width="6" height="9.5" rx="1.6" />
    </g>
  );
}

/**
 * One half of the orbit ring: a glass tube drawn as a flat SVG ellipse
 * (bloom, gradient body, hot core), magenta on the left running to
 * cyan on the right, and the comet turning in the same tipped plane.
 * The back half also carries the faint floor ring under the tile.
 */
function Orbit({ half }: { half: "back" | "front" }) {
  const { id, url } = useSvgIds("ko");
  // The ellipse of a circle of radius 96 tipped 72deg (ry = 96 cos 72deg),
  // rolled 12deg, in a 200 x 200 box: the comet's plane, seen flat.
  const arc = half === "front" ? "M4 100 A96 29.7 0 0 0 196 100" : "M4 100 A96 29.7 0 0 1 196 100";
  return (
    <div className={`${styles.orbit} ${half === "front" ? styles.orbitFront : styles.orbitBack}`}>
      <svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id={id("tube")} gradientUnits="userSpaceOnUse" x1="4" y1="0" x2="196" y2="0">
            <stop offset="0" stopColor={`rgb(${triplet(MAGENTA)})`} />
            <stop offset="0.35" stopColor={`rgb(${triplet(VIOLET)})`} />
            <stop offset="0.7" stopColor={`rgb(${triplet(BLUE)})`} />
            <stop offset="1" stopColor={`rgb(${triplet(CYAN)})`} />
          </linearGradient>
          <filter id={id("bloom")} x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        {half === "back" ? (
          <ellipse
            cx="100"
            cy="136"
            rx="70"
            ry="16"
            fill="none"
            stroke={`rgb(${triplet(VIOLET)})`}
            strokeOpacity="0.45"
            strokeWidth="0.9"
            strokeDasharray="3 4"
          />
        ) : null}
        <g transform="rotate(12 100 100)" fill="none" strokeLinecap="round">
          <path d={arc} stroke={url("tube")} strokeOpacity="0.47" strokeWidth="9" filter={url("bloom")} />
          <path d={arc} stroke={url("tube")} strokeWidth="4.4" />
          <path d={arc} stroke="#fff" strokeOpacity="0.65" strokeWidth="1.1" />
        </g>
      </svg>
      <div className={styles.orbitPlane}>
        <span className={styles.comet} />
      </div>
    </div>
  );
}

/** A small glass die in real 3D, bobbing and turning on its own clock. */
function GlassCube({ cube }: { cube: Cube }) {
  const style = {
    "--cx": pct(cube.x),
    "--cy": pct(cube.y),
    "--cs": `calc(var(--s) * ${cube.size})`,
    "--c1": triplet(cube.c1),
    "--c2": triplet(cube.c2),
    "--roll": `${cube.roll}deg`,
    "--spin": `${cube.spin}s`,
    "--bob": `${cube.bob}s`,
    "--delay": `${cube.delay}s`,
    zIndex: cube.near ? 4 : 1,
  } as CSSProperties;
  return (
    <div className={styles.cube} style={style}>
      <div className={styles.cubeFloat}>
        <div className={styles.cubeSpin}>
          <span className={styles.cubeFace} />
          <span className={styles.cubeFace} />
          <span className={styles.cubeFace} />
          <span className={styles.cubeFace} />
          <span className={styles.cubeFace} />
          <span className={styles.cubeFace} />
        </div>
      </div>
    </div>
  );
}
