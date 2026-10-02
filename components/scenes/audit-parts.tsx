"use client";

import type { CSSProperties } from "react";

import styles from "./scene-audit.module.css";

/*
 * The Audit Logs hologram's custom parts: the server tower (real CSS 3D)
 * and the small glass screens floating round it. Sized in cqw of the
 * scene's .fit box, so they scale with whatever box the caller gives.
 */

// Top slab first. Each has its own flicker offset, so the lit slots
// never pulse in unison.
const SLABS = [0, 1, 2, 3] as const;

/**
 * A glowing server tower: four stacked glass slabs with lit slots and
 * status lights, the lid carrying a ringed emblem. Turned to show its
 * front, right side and lid, and leaning toward the pointer (--hx/--hy
 * on the scene root). Only the three faces that can face the viewer are
 * built; the lean never turns far enough to show the others.
 */
export function AuditTower() {
  return (
    <div className={styles.tower}>
      <div className={styles.towerLean}>
        <div className={styles.towerIdle}>
          {SLABS.map((i) => (
            <div key={i} className={styles.slab} style={{ "--i": i, "--at": `${-i * 1.3}s` } as CSSProperties}>
              <div className={`${styles.face} ${styles.lid}`}>{i === 0 ? <span className={styles.emblem} /> : null}</div>
              <div className={`${styles.face} ${styles.front}`}>
                <span className={styles.slot} />
                <span className={styles.slotDim} />
                <span className={styles.leds} />
              </div>
              <div className={`${styles.face} ${styles.side}`}>
                <span className={styles.vent} />
                <span className={styles.sideSlot} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ScreenKind = "rows" | "bars" | "chart" | "lines";

interface Screen {
  /** Top-left corner, % of the scene box. */
  x: number;
  y: number;
  /** Size in cqw of the scene box. */
  w: number;
  h: number;
  /** Turn toward the tower, degrees. */
  ry: number;
  kind: ScreenKind;
  /** Farther back: smaller, dimmer. */
  far?: boolean;
  /** Magenta edge instead of the scene's cyan, as on the mockup's odd panel. */
  pink?: boolean;
  /** Float phase, seconds. */
  at: number;
}

// Round the tower at different depths, each turned toward it, like the
// mockup's floating dashboards.
const SCREENS: readonly Screen[] = [
  { x: 15, y: 18, w: 14, h: 9.5, ry: 30, kind: "rows", at: 0 },
  { x: 4, y: 47, w: 10, h: 7, ry: 34, kind: "bars", far: true, pink: true, at: 2.2 },
  { x: 62, y: 3, w: 10, h: 7, ry: -26, kind: "lines", far: true, at: 1.1 },
  { x: 79, y: 26, w: 12, h: 9, ry: -32, kind: "chart", at: 3.4 },
  { x: 85, y: 55, w: 9, h: 6.5, ry: -36, kind: "rows", far: true, pink: true, at: 4.6 },
];

function ScreenContent({ kind }: { kind: ScreenKind }) {
  switch (kind) {
    case "rows":
      return (
        <>
          <span className={styles.row} style={{ top: "22%", width: "58%" }} />
          <span className={styles.row} style={{ top: "46%", width: "44%" }} />
          <span className={styles.row} style={{ top: "70%", width: "52%" }} />
        </>
      );
    case "bars":
      return (
        <>
          {[46, 72, 34, 60].map((h, i) => (
            <span key={i} className={styles.bar} style={{ left: `${16 + i * 19}%`, height: `${h}%` }} />
          ))}
        </>
      );
    case "chart":
      return (
        <svg className={styles.chart} viewBox="0 0 40 26" preserveAspectRatio="none">
          <path d="M3 21 L10 15 L16 18 L23 9 L29 12 L37 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M3 23.5 H37" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        </svg>
      );
    case "lines":
      return (
        <>
          <span className={styles.row} style={{ top: "24%", width: "36%" }} />
          <span className={`${styles.row} ${styles.rowDim}`} style={{ top: "50%", width: "64%" }} />
          <span className={`${styles.row} ${styles.rowDim}`} style={{ top: "72%", width: "48%" }} />
        </>
      );
  }
}

/** The floating glass screens, each drifting on its own phase. */
export function AuditScreens() {
  return (
    <>
      {SCREENS.map((s, i) => (
        <div
          key={i}
          className={[styles.screen, s.far ? styles.far : "", s.pink ? styles.pink : ""].join(" ")}
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.w}cqw`,
              height: `${s.h}cqw`,
              "--ry": `${s.ry}deg`,
              animationDelay: `${-s.at}s`,
            } as CSSProperties
          }
        >
          <ScreenContent kind={s.kind} />
        </div>
      ))}
    </>
  );
}

interface Streak {
  x: number;
  /** Length, % of the scene height. */
  h: number;
  dur: number;
  at: number;
}

// Faint data rising off the platform round the tower.
const STREAKS: readonly Streak[] = [
  { x: 28, h: 22, dur: 3.8, at: 0.4 },
  { x: 34, h: 30, dur: 4.6, at: 2.6 },
  { x: 67, h: 26, dur: 4.2, at: 1.3 },
  { x: 73, h: 18, dur: 3.4, at: 3.1 },
  { x: 62, h: 34, dur: 5.2, at: 0.9 },
];

export function AuditStreaks() {
  return (
    <>
      {STREAKS.map((s, i) => (
        <span
          key={i}
          className={styles.streak}
          style={
            { left: `${s.x}%`, height: `${s.h}%`, "--rise-time": `${s.dur}s`, animationDelay: `${-s.at}s` } as CSSProperties
          }
        />
      ))}
    </>
  );
}

interface Glint {
  x: number;
  y: number;
  /** cqw */
  size: number;
  at: number;
}

// Four-point star glints on the near side, flaring in turn.
const GLINTS: readonly Glint[] = [
  { x: 24, y: 12, size: 4.2, at: 0.3 },
  { x: 78, y: 16, size: 5, at: 2.4 },
  { x: 88, y: 46, size: 3.2, at: 1.2 },
  { x: 14, y: 66, size: 3.6, at: 3.6 },
  { x: 57, y: 30, size: 2.6, at: 4.4 },
  { x: 36, y: 8, size: 2.4, at: 1.8 },
];

export function AuditGlints() {
  return (
    <>
      {GLINTS.map((g, i) => (
        <span
          key={i}
          className={styles.glint}
          style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.size}cqw`, animationDelay: `${-g.at}s` }}
        />
      ))}
    </>
  );
}
