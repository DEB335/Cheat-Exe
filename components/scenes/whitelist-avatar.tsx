"use client";

import { useSvgIds } from "@/components/holo";
import { cn } from "@/lib/utils";

import styles from "./scene-whitelist-avatar.module.css";

export type EntryAvatarVariant = "user" | "group" | "add";

type Ids = ReturnType<typeof useSvgIds>;

/** A figure in the 80 x 80 box: a head, the rounded bust under it, and a glint along its near shoulder. */
interface Person {
  cx: number;
  cy: number;
  r: number;
  bust: string;
  glint: string;
}

/**
 * A figure with its head at (cx, cy, r) and a bust from x0 to x1, the
 * shoulders rising to `top` and the base flat at `base`.
 */
function person(cx: number, cy: number, r: number, x0: number, x1: number, top: number, base: number): Person {
  const mid = (x0 + x1) / 2;
  const w = x1 - x0;
  const h = base - top;
  const shoulder = top + h * 0.3;
  return {
    cx,
    cy,
    r,
    bust:
      `M${x0} ${base - 2.5} C${x0} ${shoulder} ${mid - w * 0.28} ${top} ${mid} ${top} ` +
      `C${mid + w * 0.28} ${top} ${x1} ${shoulder} ${x1} ${base - 2.5} ` +
      `Q${x1} ${base} ${x1 - 2.5} ${base} L${x0 + 2.5} ${base} Q${x0} ${base} ${x0} ${base - 2.5} Z`,
    glint: `M${x0 + w * 0.1} ${top + h * 0.6} C${x0 + w * 0.12} ${top + h * 0.3} ${mid - w * 0.24} ${top + h * 0.1} ${mid - w * 0.06} ${top + h * 0.08}`,
  };
}

const SOLO = person(40, 26, 11, 21, 59, 40, 62.5);

// The group: one figure in front, two a little smaller behind it,
// showing past its shoulders.
const GROUP_FRONT = person(40, 28.5, 9.6, 24.5, 55.5, 43, 63);
const GROUP_BACK = [person(23.5, 26.5, 7.6, 10.5, 36.5, 38.5, 57), person(56.5, 26.5, 7.6, 43.5, 69.5, 38.5, 57)];

// The add glyph: the figure steps left to make room for the plus.
const ADDER = person(35, 26, 10.4, 17, 53, 40, 62.5);
const PLUS = "M60 46 V64 M51 55 H69";

/**
 * The glowing glass user at the right of a whitelist entry card: one
 * figure ("user"), a group of three ("group") or a figure with a plus
 * ("add"), standing on a small lit platform in front of a faint glass
 * prism, over a soft base glow. Still: one sits on every entry card.
 *
 * Lit in the colours of the NeonPanel it sits in (its rim vars). Around
 * 64-80px; the caller positions and sizes it (default 72px square).
 * Decorative only: hidden from assistive tech, never takes the pointer.
 */
export function EntryAvatar({ variant, className }: { variant: EntryAvatarVariant; className?: string }) {
  const ids = useSvgIds("wl-av");
  const { id, url } = ids;

  return (
    <div
      aria-hidden
      className={`${styles.avatar} ${cn("pointer-events-none relative aspect-square w-[72px]", className)}`}
    >
      <span className={styles.glow} />
      <svg className={styles.layer} viewBox="0 0 80 80">
        <defs>
          <linearGradient id={id("pane")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.stopB} stopOpacity="0.2" />
            <stop offset="1" className={styles.stopC} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* The glass prism behind the figure, seen corner-on. */}
        <path d="M16 25 L40 14.5 L64 25 V55 L40 65.5 L16 55 Z" fill={url("pane")} className={styles.paneLine} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M16 25 L40 35 L64 25 M40 35 V65.5" fill="none" className={styles.paneEdge} strokeWidth="0.7" />
        {/* The platform it stands on. */}
        <ellipse cx="40" cy="66" rx="27" ry="6.4" className={styles.ring} strokeWidth="0.9" />
        <ellipse cx="40" cy="66" rx="17" ry="3.9" fill="none" className={styles.ringInner} strokeWidth="0.7" />
      </svg>
      <svg className={styles.layer} viewBox="0 0 80 80">
        <defs>
          <linearGradient id={id("glass")} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" className={styles.stopA} stopOpacity="0.95" />
            <stop offset="0.5" className={styles.stopB} stopOpacity="0.9" />
            <stop offset="1" className={styles.stopC} stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id={id("orb")} cx="0.34" cy="0.26" r="0.78">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.32" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          {/* The edge burns near-white, cooling into the rim colour at the far corner. */}
          <linearGradient id={id("edge")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" className={styles.stopA} />
          </linearGradient>
          <filter id={id("bloom")} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        {variant === "group" ? (
          <>
            <g opacity="0.62">
              {GROUP_BACK.map((p) => (
                <Figure key={p.cx} person={p} ids={ids} />
              ))}
            </g>
            <Figure person={GROUP_FRONT} ids={ids} />
          </>
        ) : variant === "add" ? (
          <>
            <Figure person={ADDER} ids={ids} />
            {/* A dark gap round the plus parts it from the bust it overlaps. */}
            <path d={PLUS} className={styles.gap} strokeWidth="9" strokeLinecap="round" />
            <path d={PLUS} className={`${styles.bloom} ${styles.bloomFill}`} strokeWidth="5.5" strokeLinecap="round" filter={url("bloom")} />
            <path d={PLUS} className={styles.edge} stroke={url("edge")} strokeWidth="4.2" strokeLinecap="round" />
          </>
        ) : (
          <Figure person={SOLO} ids={ids} />
        )}
      </svg>
    </div>
  );
}

/**
 * One glass figure, back to front: a blurred copy for the neon bloom,
 * dark glass, the tinted fill, a white orb highlight on each part, the
 * near-white edge, and a glint on the head and the near shoulder.
 */
function Figure({ person: { cx, cy, r, bust, glint }, ids: { url } }: { person: Person; ids: Ids }) {
  const shapes = (props: React.SVGProps<SVGCircleElement> & React.SVGProps<SVGPathElement>) => (
    <>
      <circle cx={cx} cy={cy} r={r} {...props} />
      <path d={bust} strokeLinejoin="round" {...props} />
    </>
  );

  return (
    <g>
      <g className={`${styles.bloom} ${styles.bloomFill}`} filter={url("bloom")} strokeWidth="3.4">
        {shapes({})}
      </g>
      {shapes({ className: styles.base })}
      {shapes({ fill: url("glass") })}
      {shapes({ fill: url("orb") })}
      {shapes({ fill: "none", stroke: url("edge"), strokeWidth: 1.5, className: styles.edge })}
      <ellipse
        cx={cx - r * 0.34}
        cy={cy - r * 0.4}
        rx={r * 0.34}
        ry={r * 0.2}
        fill="#fff"
        fillOpacity="0.7"
        transform={`rotate(-26 ${cx - r * 0.34} ${cy - r * 0.4})`}
      />
      <path d={glint} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}
