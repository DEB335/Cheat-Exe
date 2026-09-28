"use client";

import { useLayoutEffect, useRef } from "react";

import { ParticleGlobe } from "@/components/effects/ParticleGlobe";
import {
  findPointerHost,
  HoloCube,
  HoloPedestal,
  HoloShield,
  paletteVars,
  ParticleField,
  resolvePalette,
  usePauseWhenHidden,
  usePointerLean,
  type RGB,
} from "@/components/holo";
import { cn } from "@/lib/utils";

import {
  CircuitFloor,
  GlobeGraticule,
  NetworkRouter,
  OrbitLayer,
  SceneGlints,
  VaultLockFace,
  WifiSignal,
  type Glint,
  type Orbit,
  type Trace,
  type View,
} from "./banned-parts";
import styles from "./scene-banned.module.css";

/*
 * The Banned & Kicked Vault's holograms. The caller places and sizes
 * each root (e.g. "absolute left-4 top-4 h-[230px] w-[220px]"); every
 * part inside is laid out relative to that box, so a scene keeps its
 * composition anywhere from about half to one and a half times the size
 * it was drawn at.
 *
 * Particle budget: the shield and the lock carry one ParticleField
 * canvas each, behind the object, with a few CSS glints in front for
 * the near side -- two canvases for the vault panel together. The
 * network scene is the existing ParticleGlobe plus CSS and SVG.
 *
 * Decorative only: aria-hidden, no pointer events (the pointer is read
 * from the panel, so its controls under a scene keep working), every
 * loop paused off screen and held still for reduced motion.
 */

const AURORA = resolvePalette("aurora");
// The network scene is blue: the router's glow and the glints.
const BLUE_TONE = resolvePalette("blue");

const MAGENTA: RGB = [255, 61, 242];
const VIOLET: RGB = [139, 92, 246];
const BLUE: RGB = [59, 130, 246];
const SKY: RGB = [96, 165, 250];
const CYAN: RGB = [34, 211, 238];
const INDIGO: RGB = [99, 102, 241];
const PINK: RGB = [255, 79, 216];
const WHITE: RGB = [240, 236, 255];

/** The shared root: a size container that leans its objects toward the pointer and rests off screen. */
function useSceneRoot() {
  const ref = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(ref);
  usePointerLean(ref);
  return ref;
}

const rootClass = (className?: string) => `${styles.root} ${cn("pointer-events-none relative", className)}`;

// ---- Shield ---------------------------------------------------------------

const SHIELD_GLINTS: readonly Glint[] = [
  { x: 14, y: 26, size: 9, at: 0.4 },
  { x: 86, y: 18, size: 11, at: 2.1 },
  { x: 84, y: 56, size: 6, at: 3.3 },
  { x: 11, y: 60, size: 6, at: 1.4 },
  { x: 60, y: 6, size: 5, at: 3.9 },
  { x: 28, y: 48, size: 3, at: 0.8, kind: "mote" },
  { x: 74, y: 70, size: 3, at: 4.2, kind: "mote" },
];

/**
 * The vault's emblem, far left of its hero panel: a violet glass shield
 * with a pink crossed circle, standing on a ringed pedestal in a swirl
 * of sparkle. Drawn at about 220 x 230.
 */
export function VaultShieldScene({ className }: { className?: string }) {
  const rootRef = useSceneRoot();
  const objectRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} aria-hidden className={rootClass(className)} style={paletteVars(AURORA)}>
      <ParticleField palette="aurora" shape="orbit" anchorRef={objectRef} density={0.7} radius={0.44} edgeFade />
      <div className={`${styles.fit} ${styles.shieldFit}`}>
        <div className={`${styles.halo} ${styles.shieldHalo}`} />
        <HoloPedestal tone="aurora" className={styles.shieldPedestal} />
        <div ref={objectRef} className={`${styles.object} ${styles.shieldObject}`}>
          <div className={styles.bob}>
            <HoloShield tone="aurora" glyph="x" />
          </div>
        </div>
        <SceneGlints glints={SHIELD_GLINTS} />
      </div>
    </div>
  );
}

// ---- Lock -----------------------------------------------------------------

const LOCK_VIEW: View = [400, 300];

// Deep blue glass with sky-blue edges and brackets, as on the mockup's
// vault cube; any lighter and six overlapping faces turn milky.
const LOCK_CUBE = "blue";

// Two rings round the cube's middle, crossing like an atom's. Nothing in
// this scene reaches into the left tenth of the view: the vault hero lays
// its last stat tile over that strip, and the tile is glass in light
// mode, so anything under it would show through.
const LOCK_ORBITS: readonly Orbit[] = [
  {
    cx: 200,
    cy: 164,
    rx: 142,
    ry: 42,
    tilt: 7,
    from: CYAN,
    to: VIOLET,
    width: 1.4,
    beads: [
      { at: 60, lap: 9, color: SKY },
      { at: 250, lap: 9, color: MAGENTA },
    ],
  },
  {
    cx: 200,
    cy: 180,
    rx: 154,
    ry: 38,
    tilt: -5,
    from: VIOLET,
    to: BLUE,
    width: 0.9,
    beads: [{ at: 140, lap: 14, color: WHITE }],
  },
];

// Out from the platform's floor ring, bending away toward the edges; the
// left ones stop short, for that same strip.
const LOCK_TRACES: readonly Trace[] = [
  { points: [[74, 258], [56, 258], [48, 250], [42, 250]], color: SKY, pulse: 1.6, at: 0.3 },
  { points: [[92, 280], [74, 294], [44, 294]], color: VIOLET },
  { points: [[70, 270], [50, 270], [42, 278]], color: BLUE, pulse: 1.8, at: 1.2 },
  { points: [[326, 258], [360, 258], [378, 240], [400, 240]], color: CYAN, pulse: 3.2, at: 1.1 },
  { points: [[308, 280], [334, 296], [392, 296]], color: PINK, pulse: 2.4, at: 1.6 },
  { points: [[330, 270], [372, 270], [390, 288]], color: INDIGO },
];

// None in the top-right corner, where the hero's Search user button sits.
const LOCK_GLINTS: readonly Glint[] = [
  { x: 17, y: 20, size: 5.5, at: 1.2 },
  { x: 64, y: 12, size: 7, at: 3.1 },
  { x: 90, y: 50, size: 4.5, at: 0.3 },
  { x: 15, y: 58, size: 4, at: 2.4 },
  { x: 40, y: 6, size: 3.5, at: 4 },
  { x: 30, y: 40, size: 2.2, at: 1.9, kind: "mote" },
  { x: 76, y: 62, size: 2.2, at: 5.1, kind: "mote" },
];

/**
 * The vault itself, centre-right of the hero panel: a glass cube with a
 * glowing padlock face and circuit traces, on a tiered platform, with
 * two orbit rings passing round it and traces running out across the
 * floor. Drawn at about 320 x 240.
 */
export function VaultLockScene({ className }: { className?: string }) {
  const rootRef = useSceneRoot();
  const objectRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} aria-hidden className={rootClass(className)} style={paletteVars(AURORA)}>
      <ParticleField palette="aurora" shape="dome" anchorRef={objectRef} density={0.85} radius={0.5} edgeFade />
      <div className={`${styles.fit} ${styles.lockFit}`}>
        <div className={`${styles.halo} ${styles.lockHalo}`} />
        <CircuitFloor traces={LOCK_TRACES} view={LOCK_VIEW} />
        <OrbitLayer orbits={LOCK_ORBITS} half="back" view={LOCK_VIEW} />
        <HoloPedestal tone="aurora" className={styles.lockPedestal} />
        <div ref={objectRef} className={`${styles.object} ${styles.lockObject}`}>
          <div className={styles.bob}>
            <HoloCube tone={LOCK_CUBE} glyph={<VaultLockFace tone={LOCK_CUBE} />} />
          </div>
        </div>
        <OrbitLayer orbits={LOCK_ORBITS} half="front" view={LOCK_VIEW} />
        <SceneGlints glints={LOCK_GLINTS} />
      </div>
    </div>
  );
}

// ---- Network globe ----------------------------------------------------------

const GLOBE_VIEW: View = [380, 170];

// One wide ring round both the globe and the router, kept flat and high:
// the panel's Block button sits under the scene's lower-right corner, and
// the ring's near arc has to pass above it.
const GLOBE_ORBITS: readonly Orbit[] = [
  {
    cx: 192,
    cy: 84,
    rx: 176,
    ry: 36,
    tilt: 2,
    from: VIOLET,
    to: MAGENTA,
    width: 1.3,
    beads: [
      { at: 75, lap: 16, color: MAGENTA },
      { at: 230, lap: 16, color: SKY },
    ],
  },
];

const GLOBE_GLINTS: readonly Glint[] = [
  { x: 8, y: 22, size: 3.2, at: 0.9 },
  { x: 95, y: 30, size: 3.6, at: 2.6 },
  { x: 52, y: 8, size: 2.4, at: 3.8 },
  { x: 62, y: 88, size: 2.6, at: 1.7 },
  { x: 20, y: 80, size: 1.2, at: 2.2, kind: "mote" },
];

/**
 * Blocked devices and networks, top-right of their panel: the particle
 * globe with a small router beside it, its lights blinking and a wifi
 * signal over it, and one tilted ring round the pair. Drawn at about
 * 380 x 170, with its lower-right corner (below y 120 of the view, right
 * of x 270) left empty for the button the panel puts there.
 */
export function NetworkGlobeScene({ className }: { className?: string }) {
  const rootRef = useSceneRoot();
  // The globe listens for the pointer on its host, and this scene takes
  // none: hand it the panel. Set before the globe's own effect reads it,
  // since layout effects all run before any passive one.
  const hostRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (rootRef.current) hostRef.current = findPointerHost(rootRef.current);
  }, [rootRef]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={rootClass(className)}
      style={paletteVars(BLUE_TONE)}
    >
      <div className={`${styles.fit} ${styles.globeFit}`}>
        <OrbitLayer orbits={GLOBE_ORBITS} half="back" view={GLOBE_VIEW} />
        <div className={styles.sphere}>
          <GlobeGraticule />
        </div>
        <div className={styles.globe}>
          <ParticleGlobe hostRef={hostRef} cy={0.54} radius={0.36} />
        </div>
        <OrbitLayer orbits={GLOBE_ORBITS} half="front" view={GLOBE_VIEW} />
        {/* On the ring's near side, so the ring passes behind it. */}
        <NetworkRouter />
        <WifiSignal />
        <SceneGlints glints={GLOBE_GLINTS} />
      </div>
    </div>
  );
}
