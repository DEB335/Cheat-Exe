"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import styles from "./border-runner.module.css";

/**
 * The shared clock. Every dash's CSS animation is pinned to start at this
 * moment -- fixed when the module loads, not when the card mounts -- so
 * where the light is depends on the time alone. The card remounts on a
 * failed sign-in (it is keyed to replay its shake); without this the
 * light would snap back to the start of its lap every time.
 */
const EPOCH = typeof performance !== "undefined" ? performance.now() : 0;

/** Seconds per lap of the card. The offset runs linearly, so the speed is constant. */
const LAP_S = 6.5;

/**
 * Seconds for the neon to run once through its colours (see the neon
 * keyframes). Deliberately not a multiple of the lap, so each corner
 * sees a different colour from one lap to the next.
 */
const CYCLE_S = 9;

/**
 * Every rect is given this pathLength, so dash lengths and offsets are
 * percentages of the perimeter at any card size -- and a lap is always
 * exactly one run of the dash pattern.
 */
const LOOP = 100;

/**
 * The corner radius the light runs round. The card is rounded-[32px] at
 * every breakpoint, and its rim (glass-edge) is the 1px ring just inside
 * that edge. The runner is inset half a pixel, so its centreline is the
 * rim's centreline, whose radius is half a pixel less than the card's.
 */
const RADIUS = 31.5;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

interface Runner {
  /** Where the head is at the start of each lap: percent of the loop, clockwise from where the top edge leaves the top-left corner. */
  start: number;
  /** Scales the opacity of every stroke. */
  strength: number;
  /** How far through the colour cycle this runner is, 0..1. */
  hue: number;
}

interface Stroke {
  /** Length back from the head, in percent of the loop. */
  len: number;
  width: number;
  opacity: number;
  /** The white-hot filament at the head, rather than the neon colour. */
  core?: boolean;
}

const RUNNERS: readonly Runner[] = [
  // The comet. Parked (reduced motion) it lights the top-left corner,
  // where the rim already catches the most light.
  { start: 0, strength: 1, hue: 0 },
  // Half a lap behind and half a colour cycle apart, a dimmer echo, so
  // one side of the card is never left dark and the two never match.
  { start: LOOP / 2, strength: 0.6, hue: 0.5 },
];

/**
 * The line: sharp strokes only, no blur, so it reads as a crisp neon
 * tube. A gradient cannot follow a path, so the tail's fade is built
 * from dashes that all end at the head and stack up brightest at the
 * front. Many faint dashes of one width, spaced evenly, rather than a
 * few strong ones: that keeps the fade a smooth ramp with no visible
 * steps in brightness or thickness. Longest first, so the bright tip
 * and the white filament paint on top.
 */
const RAMP_LENGTHS = [24, 21, 18, 15, 12, 9.5, 7, 5, 3.5];

const TRAIL: readonly Stroke[] = [
  ...RAMP_LENGTHS.map((len) => ({ len, width: 2.25, opacity: 0.16 })),
  { len: 2, width: 2.75, opacity: 1 },
  { len: 1.2, width: 1.25, opacity: 1, core: true },
];

/**
 * Only the first mount fades in; carried across mounts with the clock so
 * a remount after a failed sign-in shows the light straight away.
 */
const shared = { revealed: false };

/**
 * A comet of neon light running round the login card's border, exactly
 * on the rim, at constant speed, cycling through neon colours, with a
 * dimmer echo half a lap (and half a colour cycle) behind.
 *
 * Render inside the card element (position: relative, rounded-[32px]).
 * It sits at z-15, over the glass, the rim and the content (z-10), but
 * it only ever draws on the edge. Its tight glow spills a few px outside
 * the card and nothing else leaves it: the background video stays
 * untouched.
 *
 * Decorative only: no pointer events, hidden from assistive tech, and
 * parked in place for reduced motion.
 */
export function BorderRunner() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Before paint: put this mount's dashes on the shared clock.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Marked live before anything below reads styles, so on a remount
    // the first style computed is already visible and there is no fade
    // to replay. (Strict Mode re-runs this on the same node, which
    // already carries data-live, so the first load still fades in.)
    if (shared.revealed && root.dataset.live === undefined) root.dataset.instant = "";
    root.dataset.live = "";
    shared.revealed = true;

    // Each CSS animation starts when its element is first styled.
    // Pinning every start to EPOCH makes the phase a function of the
    // clock alone. On the first load this re-phase is a jump, which the
    // fade-in hides.
    const align = () => {
      for (const animation of root.getAnimations({ subtree: true })) {
        // Only the keyframe animations: the fade-in is a transition and
        // must run from now.
        if ("animationName" in animation) animation.startTime = EPOCH;
      }
    };
    align();
    // Turning reduced motion back off creates the animations afresh.
    const reduced = window.matchMedia(REDUCED_MOTION);
    reduced.addEventListener("change", align);
    return () => reduced.removeEventListener("change", align);
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{ "--lap": `${LAP_S}s`, "--cycle": `${CYCLE_S}s` } as CSSProperties}
      className={cn("pointer-events-none absolute inset-[0.5px] z-[15]", styles.root)}
    >
      {RUNNERS.map((runner) => (
        <RunnerLine key={runner.start} runner={runner} />
      ))}
    </div>
  );
}

/**
 * One runner: an SVG covering the card whose rects are all the card's
 * outline; only the dash differs. Each runner is its own <svg> because
 * the colour cycle and the glow live on it -- CSS filters on elements
 * inside an SVG are not supported everywhere, on the <svg> box they are.
 * overflow-visible, because the stroke is centred on the edge and half
 * of it lies outside.
 */
function RunnerLine({ runner }: { runner: Runner }) {
  return (
    <svg
      className={cn("absolute inset-0 size-full overflow-visible", styles.runner)}
      // A negative delay starts this runner part-way through the cycle.
      style={{ animationDelay: `${-runner.hue * CYCLE_S}s` }}
    >
      {TRAIL.map((stroke, s) => (
        <rect
          key={s}
          width="100%"
          height="100%"
          rx={RADIUS}
          ry={RADIUS}
          pathLength={LOOP}
          fill="none"
          strokeOpacity={stroke.opacity * runner.strength}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeDasharray={`${stroke.len} ${LOOP - stroke.len}`}
          // Joined by hand, not with cn(): this file's module classes all
          // start "border-runner-module__", which tailwind-merge reads as
          // rival border utilities and keeps only the last -- dropping the
          // dash class, and with it the motion.
          className={`${styles.dash} ${stroke.core ? styles.core : styles.neon}`}
          style={dashOffsets(runner.start, stroke.len)}
        />
      ))}
    </svg>
  );
}

/**
 * The dash covers [-offset, -offset + len] along the path, so its head is
 * at len - offset. For the head to run from `start` to `start + LOOP` the
 * offset runs from len - start down to len - start - LOOP -- different
 * per dash, which is what keeps every dash's head in the same place.
 */
function dashOffsets(start: number, len: number) {
  return {
    "--from": String(len - start),
    "--to": String(len - start - LOOP),
  } as CSSProperties;
}
