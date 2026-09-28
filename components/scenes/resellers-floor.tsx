"use client";

import { rgb, PALETTES, useSvgIds } from "@/components/holo";

import styles from "./scene-resellers.module.css";

/*
 * The scene is laid out in a square "rig" 100 units a side (see
 * ResellerScene). The kit's pedestal decides where the floor is: its box
 * is twice as wide as it is tall, and its floor rings are centred 75% of
 * the way down it (HoloPedestal's cy 90 of 120). With the pedestal 80
 * units wide and lifted 6 off the bottom, the floor under its centre is
 * 84 units down, and everything here is drawn round that point.
 */
export const PED_SIZE = 0.8;
export const PED_BOTTOM = 6;
const FLOOR_Y = 100 - PED_BOTTOM - PED_SIZE * 100 * 0.5 * 0.25;
/** Ellipses on the floor share the kit pedestal's ~14deg view: ry = 0.24 rx. */
const SQUASH = 0.24;

/*
 * The grid is a true perspective floor: a camera over a flat plane,
 * placed so that at the pedestal's depth a world unit spans the rig and
 * a circle squashes by SQUASH, like the pedestal. Farther rows crowd
 * toward the horizon; the columns converge on the centre.
 */
const Z0 = 1.3;
const FOCAL = 100 * Z0;
const EYE = SQUASH * Z0;
const HORIZON = FLOOR_Y - FOCAL * (EYE / Z0);
const CELL = 0.1;

const px = (x: number, z: number) => 50 + (FOCAL * x) / z;
const py = (z: number) => HORIZON + (FOCAL * EYE) / z;
const n = (v: number) => v.toFixed(2);

const Z_NEAR = 0.8;
const Z_FAR = 2.6;

const ROWS = Array.from({ length: Math.round((Z_FAR - Z_NEAR) / CELL) + 1 }, (_, i) => Z_NEAR + i * CELL)
  .map((z) => `M0 ${n(py(z))}H100`)
  .join("");

const COLUMNS = Array.from({ length: 25 }, (_, i) => (i - 12) * CELL)
  .map((x) => `M${n(px(x, Z_NEAR))} ${n(py(Z_NEAR))}L${n(px(x, Z_FAR))} ${n(py(Z_FAR))}`)
  .join("");

// Spokes out from under the pedestal, like the floor markings of a pad.
// Those pointing at the viewer stop where the grid does, at Z_NEAR.
const SPOKES = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2)
  .map((a) => {
    const at = (r: number) => {
      const z = Z0 + Math.sin(a) * r;
      return `${n(px(Math.cos(a) * r, z))} ${n(py(z))}`;
    };
    const reach = Math.sin(a) < 0 ? Math.min(1.1, (Z0 - Z_NEAR) / -Math.sin(a)) : 1.1;
    return `M${at(0.34)}L${at(reach)}`;
  })
  .join("");

const p = PALETTES.aurora;

/**
 * The floor the reseller hologram stands on: a perspective grid fading
 * into the dark, rings round the pedestal (blue on the left, magenta on
 * the right, like the mockup), and HUD dashes turning on the floor.
 *
 * The SVG is static and painted once; the HUD rings are planes tipped
 * into the floor with a transform and spun inside it, so the only
 * motion is compositor work.
 */
export function ResellerFloor() {
  const { id, url } = useSvgIds("rf");

  return (
    <>
      <svg viewBox="0 0 100 100" aria-hidden className={styles.floor}>
        <defs>
          <linearGradient id={id("across")} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={rgb(p.c)} />
            <stop offset="0.5" stopColor={rgb(p.b)} />
            <stop offset="1" stopColor={rgb(p.a)} />
          </linearGradient>
          <radialGradient
            id={id("fade")}
            cx="50"
            cy={FLOOR_Y}
            r="52"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`translate(50 ${FLOOR_Y}) scale(1 0.62) translate(-50 ${-FLOOR_Y})`}
          >
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.4" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={id("mask")} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill={url("fade")} />
          </mask>
          <filter id={id("bloom")} x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        </defs>

        <g mask={url("mask")} fill="none" stroke={url("across")} className={styles.grid}>
          <path d={ROWS} strokeWidth="0.26" />
          <path d={COLUMNS} strokeWidth="0.26" />
          <path d={SPOKES} strokeWidth="0.22" strokeDasharray="1.2 1.6" opacity="0.7" />
        </g>

        {/* Rings round the pedestal, beyond the kit's own floor rings. */}
        <g fill="none">
          <ellipse cx="50" cy={FLOOR_Y} rx="46.5" ry={46.5 * SQUASH} stroke={url("across")} strokeWidth="1.2" filter={url("bloom")} opacity="0.8" />
          <ellipse cx="50" cy={FLOOR_Y} rx="46.5" ry={46.5 * SQUASH} stroke={url("across")} strokeWidth="0.45" />
          <ellipse
            cx="50"
            cy={FLOOR_Y}
            rx="49.4"
            ry={49.4 * SQUASH}
            stroke={url("across")}
            strokeOpacity="0.5"
            strokeWidth="0.3"
            strokeDasharray="0.5 1.3"
          />
        </g>
      </svg>

      <div className={`${styles.floorPlane} ${styles.hudDashes}`} style={{ top: `${FLOOR_Y}%` }}>
        <span />
      </div>
      <div className={`${styles.floorPlane} ${styles.hudArcs}`} style={{ top: `${FLOOR_Y}%` }}>
        <span />
      </div>
    </>
  );
}
