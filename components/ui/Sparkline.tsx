import { useId } from "react";

import { cn } from "@/lib/utils";

const W = 88;
const H = 32;
/** Room above the peak for the glow and the end dot. */
const PAD_TOP = 5;
const PAD_BOTTOM = 3;
const PAD_X = 3;

/**
 * Monotone cubic through the points (Fritsch-Carlson), so the curve never
 * swings above a peak or below a trough that is not in the data. A plain
 * Catmull-Rom would, and on a running total that reads as a dip nobody had.
 */
function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push((points[i + 1][1] - points[i][1]) / dx[i]);
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangent[i] = (3 * a * slope[i]) / h;
      tangent[i + 1] = (3 * b * slope[i]) / h;
    }
  }

  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const step = dx[i] / 3;
    d += ` C${(x0 + step).toFixed(2)},${(y0 + tangent[i] * step).toFixed(2)}`;
    d += ` ${(x1 - step).toFixed(2)},${(y1 - tangent[i + 1] * step).toFixed(2)}`;
    d += ` ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

/**
 * The little trend line in the corner of an overview tile, drawn in the
 * tile's accent: its `--stat` triplet, or `--spark` where the line wants
 * to be brighter than the border. Colours go through `style`, not the
 * SVG attributes, because a presentation attribute cannot read var().
 *
 * `values` null means there is no history to draw: the tile gets a faint
 * dashed baseline in the same footprint, so the row does not jump about
 * and nothing pretends to be a measurement.
 */
export function Sparkline({
  values,
  label,
  className,
}: {
  values: number[] | null;
  /** Read out in place of the picture, e.g. "Licenses over the last 7 days". */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const fillId = `${id}-fill`;

  const frame = cn("h-8 w-[88px] min-w-[44px] shrink overflow-visible", className);

  if (!values || values.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={frame} aria-hidden>
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - 8}
          y2={H - 8}
          style={{ stroke: "rgb(var(--stat))" }}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = values.length > 1 ? (W - PAD_X * 2) / (values.length - 1) : 0;
  // A flat series sits low rather than mid-height, where it would read
  // as a level that happens to be halfway up something.
  const y = (v: number) =>
    span === 0 ? H - PAD_BOTTOM - 6 : PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const points = values.map((v, i): [number, number] => [PAD_X + i * step, y(v)]);
  const line = smoothPath(points);
  const [endX, endY] = points[points.length - 1];
  const area = `${line} L${endX.toFixed(2)},${H} L${points[0][0].toFixed(2)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={frame} role="img" aria-label={label}>
      {label ? <title>{label}</title> : null}
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--stat))", stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--stat))", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      {/* Static drop-shadow, not an animated one: the bloom costs one
          rasterisation per render, never a repaint per frame. */}
      <path
        d={line}
        fill="none"
        style={{ stroke: "rgb(var(--spark, var(--stat)))" }}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_3px_rgba(var(--stat),0.9)] lt:drop-shadow-none"
      />
      <circle
        cx={endX}
        cy={endY}
        r={2.25}
        fill="#fff"
        className="drop-shadow-[0_0_4px_rgb(var(--stat))] transition-transform duration-300 ease-back [transform-box:fill-box] [transform-origin:center] group-hover:scale-150 lt:fill-[rgb(var(--stat))]"
      />
    </svg>
  );
}
