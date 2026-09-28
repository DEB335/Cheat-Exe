"use client";

import type { CSSProperties } from "react";

import { HoloGlyph, resolvePalette, rgb, useSvgIds, type PaletteInput, type RGB } from "@/components/holo";

import styles from "./scene-banned.module.css";

/*
 * The pieces the vault holograms add on top of the holo kit: orbit
 * ellipses that pass behind and in front of an object, star glints, a
 * network router in CSS 3D with a wifi signal over it, circuit traces
 * on the floor, and the vault cube's padlock face.
 *
 * Every piece is laid out in its scene's "view": a fixed-aspect box
 * (see .fit in scene-banned.module.css) whose SVGs share one viewBox,
 * so an SVG line and an HTML element positioned in % of the same box
 * always meet. Only transform and opacity animate; the SVG is static,
 * painted once, and whatever moves over it is an HTML element.
 */

/** A scene's view box, in the units its orbits and traces are drawn in. */
export type View = readonly [width: number, height: number];

// Computed style values are rounded: the server's and the browser's
// trig can differ in the last digit, which would fail hydration.
const round = (v: number) => Math.round(v * 1000) / 1000;
const pct = (v: number, of: number) => `${round((v / of) * 100)}%`;

// ---- Orbits -------------------------------------------------------------

export interface Orbit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Clockwise tilt in degrees: positive drops the right end. */
  tilt: number;
  /** Stroke colours from the left end to the right. */
  from: RGB;
  to: RGB;
  width?: number;
  /** Beads riding the ring: start angle (deg, 0 = the far side) and seconds per lap. */
  beads?: readonly { at: number; lap: number; color: RGB }[];
}

/**
 * One depth half of a scene's orbits: the far arcs ("back", drawn before
 * the object) or the near ones ("front", drawn after it), so a ring
 * visibly passes round the hologram rather than across it.
 *
 * A bead rides each ring with no per-frame work: a circle of the ring's
 * width is squashed into the ellipse and tilted, a child spins inside it,
 * and the bead on the child's rim spins back and unsquashes, which leaves
 * it round and exactly on the ellipse. Each half clips its copy of the
 * bead to its own half, so one bead goes behind the object and comes out
 * the other side.
 */
export function OrbitLayer({ orbits, half, view }: { orbits: readonly Orbit[]; half: "back" | "front"; view: View }) {
  const { id, url } = useSvgIds(`bo${half}`);
  const [w, h] = view;

  return (
    <div className={`${styles.layer} ${half === "back" ? styles.orbitBack : ""}`}>
      <svg className={styles.layer} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          {orbits.map((o, i) => (
            <linearGradient
              key={i}
              id={id(`g${i}`)}
              gradientUnits="userSpaceOnUse"
              x1={o.cx - o.rx}
              y1={o.cy}
              x2={o.cx + o.rx}
              y2={o.cy}
              gradientTransform={`rotate(${o.tilt} ${o.cx} ${o.cy})`}
            >
              <stop offset="0" stopColor={rgb(o.from)} />
              <stop offset="0.5" stopColor={rgb(mixMid(o.from, o.to))} />
              <stop offset="1" stopColor={rgb(o.to)} />
            </linearGradient>
          ))}
          <filter id={id("bloom")} x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        {orbits.map((o, i) => {
          const d = halfArc(o, half);
          const stroke = o.width ?? 1.2;
          return (
            <g key={i} fill="none" strokeLinecap="round">
              <path className={styles.orbitBloom} d={d} stroke={url(`g${i}`)} strokeWidth={stroke * 3.2} filter={url("bloom")} />
              <path d={d} stroke={url(`g${i}`)} strokeWidth={stroke} />
              <path d={d} stroke="#fff" strokeOpacity="0.35" strokeWidth={stroke * 0.35} className={styles.orbitCore} />
            </g>
          );
        })}
      </svg>
      {orbits.map((o, i) =>
        o.beads?.map((bead, j) => (
          <div
            key={`${i}-${j}`}
            className={`${styles.beadRing} ${half === "back" ? styles.clipBack : styles.clipFront}`}
            style={
              {
                left: pct(o.cx - o.rx, w),
                top: pct(o.cy - o.rx, h),
                width: pct(o.rx * 2, w),
                height: pct(o.rx * 2, h),
                transform: `rotate(${o.tilt}deg) scaleY(${round(o.ry / o.rx)})`,
                "--lap": `${bead.lap}s`,
                "--lap-at": `${round((-bead.at / 360) * bead.lap)}s`,
                "--unsquash": round(o.rx / o.ry),
                "--bead": bead.color.join(" "),
              } as CSSProperties
            }
          >
            <span className={styles.beadSpin}>
              <i className={styles.bead} />
            </span>
          </div>
        )),
      )}
    </div>
  );
}

/** The far (upper) or near (lower) half of a tilted ellipse, left end to right end. */
function halfArc({ cx, cy, rx, ry, tilt }: Orbit, half: "back" | "front") {
  const t = (tilt * Math.PI) / 180;
  const dx = rx * Math.cos(t);
  const dy = rx * Math.sin(t);
  const sweep = half === "back" ? 1 : 0;
  return `M${round(cx - dx)} ${round(cy - dy)} A${rx} ${ry} ${tilt} 0 ${sweep} ${round(cx + dx)} ${round(cy + dy)}`;
}

function mixMid(a: RGB, b: RGB): RGB {
  return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)];
}

// ---- Glints -------------------------------------------------------------

export interface Glint {
  /** Centre, in % of the scene's view box. */
  x: number;
  y: number;
  /** Diameter in % of the view box's width. */
  size: number;
  /** Seconds into the twinkle, so the glints never flash together. */
  at: number;
  /** A four-point star, or a soft round mote that drifts up. */
  kind?: "star" | "mote";
}

/**
 * Sparkle in front of the hologram. The canvas particle field sits
 * behind the object; these few glints sit before it, so the sparkle has
 * a near side too without a second canvas.
 */
export function SceneGlints({ glints }: { glints: readonly Glint[] }) {
  return (
    <div className={styles.layer}>
      {glints.map((g, i) => (
        <span
          key={i}
          className={g.kind === "mote" ? styles.mote : styles.glint}
          style={
            {
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: `${g.size}cqw`,
              animationDelay: `${-g.at}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ---- Router and wifi --------------------------------------------------

// Link and activity lights, left to right: the last one is the alert
// pink the mockup ends the row with.
const LEDS: readonly { color: string; blink: number; at: number }[] = [
  { color: "226 238 255", blink: 2.6, at: 0.4 },
  { color: "96 165 250", blink: 1.3, at: 0.9 },
  { color: "226 238 255", blink: 3.4, at: 1.7 },
  { color: "96 165 250", blink: 0.9, at: 0.2 },
  { color: "192 132 252", blink: 2.1, at: 1.1 },
  { color: "255 79 216", blink: 1.7, at: 0.6 },
];

/**
 * A small network router in real CSS 3D: a lit lid, a front face with
 * a row of blinking lights, and a side with ports, turned to show three
 * faces and leaning toward the pointer (--hx/--hy on the scene root).
 * The faces are near-opaque, so only the three that face the viewer are
 * built.
 */
export function NetworkRouter() {
  return (
    <div className={styles.router}>
      <div className={styles.routerShadow} />
      <div className={styles.routerLean}>
        <div className={styles.routerIdle}>
          <div className={styles.routerBody}>
            <span className={`${styles.rFace} ${styles.rTop}`}>
              <span className={styles.rVents} />
              <span className={styles.rBadge} />
            </span>
            <span className={`${styles.rFace} ${styles.rFront}`}>
              <span className={styles.rLeds}>
                {LEDS.map((led, i) => (
                  <i
                    key={i}
                    className={styles.led}
                    style={
                      {
                        "--led": led.color,
                        animationDuration: `${led.blink}s`,
                        animationDelay: `${-led.at}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            </span>
            <span className={`${styles.rFace} ${styles.rSide}`}>
              <span className={styles.rPorts} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Three neon arcs and a dot, lighting up from the dot outward. */
export function WifiSignal() {
  const { id, url } = useSvgIds("bw");
  const p = resolvePalette("blue");
  const arcs = [9, 16, 23];
  const arcPath = (r: number) => {
    const dx = r * Math.SQRT1_2;
    return `M${round(24 - dx)} ${round(34 - dx)} A${r} ${r} 0 0 1 ${round(24 + dx)} ${round(34 - dx)}`;
  };

  return (
    <div className={styles.wifi}>
      <svg className={styles.layer} viewBox="0 0 48 40" overflow="visible">
        <defs>
          <linearGradient id={id("stroke")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={rgb(p.hot)} />
            <stop offset="0.45" stopColor={rgb(p.a)} />
            <stop offset="1" stopColor={rgb([139, 92, 246])} />
          </linearGradient>
          <filter id={id("bloom")} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
        </defs>
        <circle cx="24" cy="34" r="3.4" fill={url("stroke")} />
        <circle cx="24" cy="34" r="4.6" fill={rgb(p.a)} filter={url("bloom")} className={styles.orbitBloom} />
      </svg>
      {/* Each arc is its own layer so it can pulse on the compositor; the
          negative delays keep them in step from the first frame. */}
      {arcs.map((r, i) => (
        <svg
          key={r}
          className={`${styles.layer} ${styles.wifiArc}`}
          viewBox="0 0 48 40"
          overflow="visible"
          style={{ animationDelay: `${i * 0.28 - 2.4}s` }}
        >
          <path d={arcPath(r)} fill="none" stroke={rgb(p.a)} strokeWidth="5.5" strokeLinecap="round" filter={url("bloom")} className={styles.orbitBloom} />
          <path d={arcPath(r)} fill="none" stroke={url("stroke")} strokeWidth="3.6" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

// ---- Circuit floor ----------------------------------------------------

export interface Trace {
  /** Polyline in view units, from the platform outward. */
  points: readonly (readonly [number, number])[];
  color: RGB;
  /** Seconds for a pulse to run the first segment; omit for no pulse. */
  pulse?: number;
  at?: number;
}

/**
 * Circuit traces running out across the floor from the platform, fading
 * toward the scene's edges, with a node at every bend and a pulse of
 * light running the first leg of some. The traces are one static SVG;
 * the pulses are HTML, turned onto their leg and slid along it.
 */
export function CircuitFloor({ traces, view }: { traces: readonly Trace[]; view: View }) {
  const [w, h] = view;
  return (
    <div className={`${styles.layer} ${styles.circuit}`}>
      <svg className={styles.layer} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {traces.map((t, i) => (
          <g key={i}>
            <polyline
              points={t.points.map((pt) => pt.join(",")).join(" ")}
              fill="none"
              stroke={rgb(t.color, 0.55)}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {t.points.slice(1).map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r="1.8" fill={rgb(t.color, 0.85)} />
            ))}
          </g>
        ))}
      </svg>
      {traces.map((t, i) => {
        if (!t.pulse) return null;
        const [[x1, y1], [x2, y2]] = t.points as [[number, number], [number, number]];
        return (
          <span
            key={i}
            className={styles.pulse}
            style={
              {
                left: pct(x1, w),
                top: pct(y1, h),
                "--angle": `${round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI)}deg`,
                "--run": `${round((Math.hypot(x2 - x1, y2 - y1) / w) * 100)}cqw`,
                "--pulse": t.color.join(" "),
                animationDuration: `${t.pulse}s`,
                animationDelay: `${-(t.at ?? 0)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

// ---- Vault cube face ----------------------------------------------------

/**
 * The vault cube's front face: the kit's glass padlock, with circuit
 * traces running from its body out between the corner brackets to the
 * edges of the face. Drawn in the cube's 40 x 40 glyph box; the traces
 * overhang it (overflow visible) to reach the face's rim.
 */
export function VaultLockFace({ tone }: { tone: PaletteInput }) {
  const { id, url } = useSvgIds("bvl");
  const p = resolvePalette(tone);
  const traces = [
    "M7.5 26 H2.5 L-0.5 23 H-7",
    "M7.5 31 H0.5 L-2 33.5 H-7",
    "M32.5 26 H37.5 L40.5 23 H47",
    "M32.5 31 H39.5 L42 33.5 H47",
    "M16 37 V39.5 L14 41.5 H10.5",
    "M24 37 V39.5 L26 41.5 H29.5",
  ];
  const nodes: readonly (readonly [number, number])[] = [
    [-7, 23],
    [-7, 33.5],
    [47, 23],
    [47, 33.5],
    [10.5, 41.5],
    [29.5, 41.5],
  ];

  return (
    <svg className="size-full" viewBox="0 0 40 40" overflow="visible">
      <g fill="none" stroke={rgb(p.a, 0.5)} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
        {traces.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {nodes.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r="0.9" fill={rgb(p.hot, 0.9)} />
      ))}
      <HoloGlyph glyph="lock" p={p} id={id} url={url} x={0} y={0} size={40} />
    </svg>
  );
}

// ---- Globe graticule --------------------------------------------------

/**
 * Meridians and parallels drawn on the network globe's glass sphere. The
 * particle globe paints faint points and hairlines: sparse on the navy
 * panel, where the mockup's globe is a lit wireframe, and all but gone on
 * the frosted light one. This keeps the sphere reading as a globe in both
 * (stroke and glow per theme in the CSS). Static SVG, painted once.
 */
export function GlobeGraticule() {
  const meridians = [14, 30, 44];
  const parallels = [
    [26, 38],
    [50, 49],
    [74, 38],
  ] as const;

  return (
    <svg className={`${styles.layer} ${styles.graticule}`} viewBox="0 0 100 100">
      <g fill="none" strokeWidth="0.8">
        <circle cx="50" cy="50" r="49" />
        <line x1="50" y1="1" x2="50" y2="99" />
        {meridians.map((rx) => (
          <ellipse key={rx} cx="50" cy="50" rx={rx} ry="49" />
        ))}
        {parallels.map(([y, rx]) => (
          <ellipse key={y} cx="50" cy={y} rx={rx} ry={rx * 0.16} />
        ))}
      </g>
    </svg>
  );
}
