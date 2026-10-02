import { cn } from "@/lib/utils";

import { IconTile, type IconTileVariant } from "./IconTile";
import styles from "./neon-panel.module.css";
import type { NeonTone } from "./tones";

export type NeonRim = "aurora" | "violet" | "blue" | "cyan" | "teal" | "pink" | "amber" | "danger";

/**
 * Each rim is three rgb triplets, from the lit top-left corner to the
 * bottom-right. "aurora" is the mockups' default: magenta and pink down
 * the left, violet across, electric blue on the right.
 */
const RIMS: Record<NeonRim, [string, string, string]> = {
  aurora: ["255, 61, 242", "139, 92, 246", "59, 130, 246"],
  violet: ["217, 70, 239", "139, 92, 246", "99, 102, 241"],
  blue: ["34, 211, 238", "59, 130, 246", "99, 102, 241"],
  cyan: ["103, 232, 249", "34, 211, 238", "59, 130, 246"],
  teal: ["52, 211, 153", "16, 224, 160", "34, 211, 238"],
  pink: ["255, 79, 216", "244, 114, 182", "168, 85, 247"],
  amber: ["253, 186, 116", "245, 165, 36", "244, 63, 94"],
  danger: ["255, 45, 85", "244, 63, 94", "168, 85, 247"],
};

// Module classes are joined by hand, never through cn(): tailwind-merge
// only knows Tailwind's own names and is free to drop anything else.
const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

interface NeonPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rim colourway. Default "aurora". */
  rim?: NeonRim;
  /**
   * "lg" is the page panel (24px corners, 28-34px padding); "md" the
   * smaller card that sits in a grid inside one (20px, 20px).
   */
  size?: "lg" | "md";
  /** Turns off the hover lift and rotating rim, e.g. for a panel that holds a scrolling table. */
  static?: boolean;
}

/**
 * The big neon glass panel every restyled page is built from.
 *
 * Layers, back to front: the pane (fill, corner glows, sheen -- all on
 * the root), the bloom pre-painted at rest and at hover strength (hover
 * cross-fades the two), a blurred copy of the rim as its glow, the 1.5px
 * gradient rim itself, and three short streaks of white-hot light on
 * the straights. The decoration only ever draws on the edge, so it is
 * safe above the content and needs no wrapper: `className` lays out the
 * children directly, as it would on a plain div.
 *
 * Keeps the Card behaviour: the red `glow-ring` rotates round the rim
 * on hover while the panel lifts. Hover only moves and fades layers
 * (transform and opacity): nothing is repainted while it runs.
 */
export function NeonPanel({
  rim = "aurora",
  size = "lg",
  static: still = false,
  className,
  style,
  children,
  ...rest
}: NeonPanelProps) {
  const [a, b, c] = RIMS[rim];

  return (
    <div
      {...rest}
      style={{ "--rim-a": a, "--rim-b": b, "--rim-c": c, ...style } as React.CSSProperties}
      className={join(
        styles.panel,
        size === "md" && styles.md,
        cn(
          "glow-ring relative min-w-0 text-fg",
          size === "lg" ? "rounded-[24px] p-5 sm:p-7 xl:p-8" : "rounded-[20px] p-4 sm:p-5",
          "transition-[translate,scale] duration-[400ms] ease-smooth",
          !still &&
            (size === "lg"
              ? "hover:glow-ring-slow hover:-translate-y-1"
              : "hover:glow-ring-on hover:-translate-y-1.5 hover:scale-[1.01]"),
          className,
        ),
      )}
    >
      <span aria-hidden className={styles.bloom} />
      <span aria-hidden className={`${styles.bloom} ${styles.bloomHover}`} />
      <span aria-hidden className={styles.rimGlow}>
        <span className="glass-edge" />
      </span>
      <span aria-hidden className={`glass-edge ${styles.rim}`} />
      <span aria-hidden className={`${styles.streak} ${styles.streakTop}`} />
      <span aria-hidden className={`${styles.streak} ${styles.streakLeft}`} />
      <span aria-hidden className={`${styles.streak} ${styles.streakBottom}`} />
      {/* The red ring, turned by the compositor (see glow-ring in
          globals.css). Up here with the decoration rather than last, so
          a caller's space-y or last: never counts it; its z-index keeps
          it on top. */}
      <span aria-hidden className="glow-ring-track" />
      {children}
    </div>
  );
}

interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** The glyph for the header's icon tile. Omit for a header without one. */
  icon?: React.ReactNode;
  iconTone?: NeonTone;
  /** Bends a solid tile's gradient toward a second tone. */
  iconTone2?: NeonTone;
  iconVariant?: IconTileVariant;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Sits inline after the title, e.g. <NeonChip>BANNED USERS</NeonChip>. */
  badge?: React.ReactNode;
  /** Right-hand actions: NeonButtons, a search field. */
  actions?: React.ReactNode;
  /** Heading level of the title. Default "h3", as CardHeader. */
  titleAs?: "h2" | "h3" | "h4";
}

/**
 * Icon tile, title, one-line subtitle, and actions on the right.
 *
 * Wraps like CardHeader: the title keeps at least ~240px, and actions
 * that would squeeze it narrower drop onto their own row -- on a phone
 * two buttons beside it would leave the title a word wide.
 */
export function PanelHeader({
  icon,
  iconTone = "violet",
  iconTone2,
  iconVariant = "solid",
  title,
  subtitle,
  badge,
  actions,
  titleAs: Title = "h3",
  className,
  ...rest
}: PanelHeaderProps) {
  return (
    <div
      {...rest}
      className={cn("mb-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-4", className)}
    >
      <div className="flex min-w-[min(100%,240px)] flex-1 items-center gap-4">
        {icon ? (
          <IconTile
            tone={iconTone}
            tone2={iconTone2}
            variant={iconVariant}
            size="lg"
            className="max-sm:size-12 max-sm:rounded-[14px] max-sm:[&>svg]:size-6"
          >
            {icon}
          </IconTile>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Title className="font-display text-[21px] leading-tight font-bold text-white sm:text-[25px] lt:text-slate-900">
              {title}
            </Title>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1.5 text-[14px] leading-snug text-[#a9b8e0] sm:text-[15px] lt:text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/**
 * A darker recess inside a panel for a group of fields -- the "Enter
 * license key" well on Manage Key. Takes the panel's rim colours.
 */
export function NeonInset({
  rim = "aurora",
  className,
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { rim?: NeonRim }) {
  const [a, b, c] = RIMS[rim];
  return (
    <div
      {...rest}
      style={{ "--rim-a": a, "--rim-b": b, "--rim-c": c, ...style } as React.CSSProperties}
      className={join(styles.inset, cn("relative rounded-[18px] p-4 sm:p-6", className))}
    >
      <span aria-hidden className={styles.insetLine} />
      {children}
    </div>
  );
}
