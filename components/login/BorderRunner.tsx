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

type Tone = "head" | "body" | "mid" | "tail";

interface Runner {
  /** Where the head is at the start of each lap: percent of the loop, clockwise from where the top edge leaves the top-left corner. */
  start: number;
  /** Scales the opacity of every stroke. */
  strength: number;
  tones: Record<Tone, string>;
}

interface Stroke {
  /** Length back from the head, in percent of the loop. */
  len: number;
  width: number;
  tone: Tone;
  opacity: number;
}

const RUNNERS: readonly Runner[] = [
  // The comet: white-hot at the head, cooling through teal and cyan to
  // blue down the tail. Parked (reduced motion) it lights the top-left
  // corner, where the rim already catches the most light.
  { start: 0, strength: 1, tones: { head: "#e0f2fe", body: "#5eead4", mid: "#22d3ee", tail: "#3b82f6" } },
  // Half a lap behind, a dimmer blue echo, so one side of the card is
  // never left dark for long.
  { start: LOOP / 2, strength: 0.5, tones: { head: "#dbeafe", body: "#93c5fd", mid: "#60a5fa", tail: "#3b82f6" } },
];

/**
 * The line itself. A gradient cannot follow a path, so the tail's fade
 * is built from dashes of falling length and rising opacity that all end
 * at the head: they stack up brightest at the front. Longest first, so
 * the short bright ones paint on top.
 */
const TRAIL: readonly Stroke[] = [
  { len: 22, width: 2, tone: "tail", opacity: 0.25 },
  { len: 14, width: 2, tone: "tail", opacity: 0.35 },
  { len: 8, width: 2.25, tone: "mid", opacity: 0.6 },
  { len: 4, width: 2.5, tone: "body", opacity: 0.85 },
  { len: 1.5, width: 3, tone: "head", opacity: 1 },
];

/**
 * The bloom under it: wider, shorter strokes, blurred by the CSS, with
 * the widest at the head so it reads as a spark.
 */
const BLOOM: readonly Stroke[] = [
  { len: 16, width: 6, tone: "tail", opacity: 0.5 },
  { len: 7, width: 9, tone: "mid", opacity: 0.85 },
  { len: 2.5, width: 13, tone: "mid", opacity: 0.8 },
];

/**
 * Only the first mount fades in; carried across mounts with the clock so
 * a remount after a failed sign-in shows the light straight away.
 */
const shared = { revealed: false };

/**
 * A comet of light running round the login card's border, exactly on the
 * rim, at constant speed, with a dimmer echo half a lap behind.
 *
 * Render inside the card element (position: relative, rounded-[32px]).
 * It sits at z-15, over the glass, the rim and the content (z-10), but
 * it only ever draws on the edge. The glow spills a few px outside the
 * card and nothing else leaves it: the background video stays untouched.
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
      style={{ "--lap": `${LAP_S}s` } as CSSProperties}
      className={cn("pointer-events-none absolute inset-[0.5px] z-[15]", styles.root)}
    >
      <Layer strokes={BLOOM} className={styles.bloom} />
      <Layer strokes={TRAIL} className={styles.trail} />
    </div>
  );
}

/**
 * One SVG covering the card, holding each runner's strokes. The rects
 * are all the card's outline; only the dash differs. overflow-visible,
 * because the stroke is centred on the edge and half of it lies outside.
 */
function Layer({ strokes, className }: { strokes: readonly Stroke[]; className: string | undefined }) {
  return (
    <svg className={cn("absolute inset-0 size-full overflow-visible", className)}>
      {RUNNERS.flatMap((runner, r) =>
        strokes.map((stroke, s) => (
          <rect
            key={`${r}-${s}`}
            width="100%"
            height="100%"
            rx={RADIUS}
            ry={RADIUS}
            pathLength={LOOP}
            fill="none"
            stroke={runner.tones[stroke.tone]}
            strokeOpacity={stroke.opacity * runner.strength}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeDasharray={`${stroke.len} ${LOOP - stroke.len}`}
            className={styles.dash}
            style={dashOffsets(runner.start, stroke.len)}
          />
        )),
      )}
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
