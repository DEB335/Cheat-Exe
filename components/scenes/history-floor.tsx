"use client";

import { useMemo } from "react";

import { useSvgIds } from "@/components/holo";

import styles from "./scene-history.module.css";

/*
 * A true perspective floor, drawn in the ambience's own pixels (the
 * viewBox is the measured box, rounded to 8px, so the stretch to the
 * real box is too small to see), so a wide, short panel header never
 * stretches the cells: a camera over a flat plane, the horizon HORIZON
 * of the way down, the nearest row on the box's bottom edge. Farther
 * rows crowd toward the horizon and the columns converge on the centre.
 */
export const HORIZON = 0.42;
/** World size of a cell; the nearest row sits at depth 1. */
const CELL = 0.3;
/** Farthest row drawn; beyond it the mask has faded the floor out anyway. */
const Z_FAR = 8;
/** Screen px per world unit at depth 1, as a share of the box height. */
const FOCAL = 0.6;

const n = (v: number) => v.toFixed(1);

function floorPath(w: number, h: number) {
  const horizon = h * HORIZON;
  const drop = h - horizon;
  const focal = h * FOCAL;
  const x = (u: number, z: number) => w / 2 + (focal * u) / z;
  const y = (z: number) => horizon + drop / z;

  let d = "";
  for (let z = 1; z <= Z_FAR; z += CELL) d += `M0 ${n(y(z))}H${w}`;
  // Enough columns that the floor still reaches both sides three rows
  // back; the outer ones start off the box and slant in from the sides.
  const reach = Math.ceil((3 * w) / 2 / (focal * CELL));
  for (let k = -reach; k <= reach; k++) {
    const u = k * CELL;
    d += `M${n(x(u, 1))} ${n(y(1))}L${n(x(u, Z_FAR))} ${n(y(Z_FAR))}`;
  }
  return d;
}

/**
 * The ambience's holographic floor: a faint violet-to-blue perspective
 * grid. Static, so it is painted once.
 */
export function HistoryFloor({ w, h }: { w: number; h: number }) {
  const { id, url } = useSvgIds("khf");
  const d = useMemo(() => floorPath(w, h), [w, h]);

  return (
    <div className={styles.floor}>
      <div className={styles.floorBase}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className={styles.floorSvg}>
          <defs>
            <linearGradient id={id("across")} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
              {/* Inline style, not the stopColor attribute: attributes do not resolve var(). */}
              <stop offset="0" style={{ stopColor: "rgb(var(--holo-a))" }} />
              <stop offset="0.5" style={{ stopColor: "rgb(var(--holo-b))" }} />
              <stop offset="1" style={{ stopColor: "rgb(var(--holo-c))" }} />
            </linearGradient>
          </defs>
          <path d={d} fill="none" stroke={url("across")} strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
