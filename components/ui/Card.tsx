import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The original markup pairs `.card` with `.card-flat` for the wide
   * table panels: flat translucent fill, gentler lift.
   */
  flat?: boolean;
}

/**
 * No backdrop blur: the page behind is flat navy now the video is gone,
 * so it changed nothing on screen, yet it re-ran a full-card blur every
 * time anything in the card repainted.
 *
 * Hover never repaints the card itself. The reddish hover border and the
 * brighter top highlight are pre-painted on ::before and faded in with
 * opacity over the resting ones. That border is opaque, mixed to what
 * --border-hover (20% red; 15% in light mode) gives over the card's own
 * fill, so it covers the resting border -- including a caller's colour,
 * as on PerformanceCard -- much as the old colour change did. The
 * highlight is the amount that lifts the resting 0.08 white line to the
 * hover one. The lift stays as it was: instant, since the transition
 * names `transform` and the lift uses the translate/scale properties.
 */
export function Card({ flat = false, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "glow-ring relative rounded-[20px] border border-line p-[30px]",
        "transition-[transform] duration-[400ms] ease-smooth",
        "before:pointer-events-none before:absolute before:inset-[-1px] before:rounded-[inherit] before:border",
        "before:opacity-0 before:transition-opacity before:duration-[400ms] before:ease-smooth hover:before:opacity-100",
        "lt:before:shadow-none",
        flat
          ? [
              "bg-[rgba(10,15,30,0.72)] shadow-[var(--card-shadow)]",
              "before:border-[rgb(58,16,41)] before:shadow-[inset_0_1px_1px_rgba(255,255,255,0.044)]",
              "lt:before:border-[rgb(250,222,226)]",
              "hover:-translate-y-1 hover:scale-[1.005]",
              "hover:glow-ring-slow lt:bg-white/70",
            ]
          : [
              "card-surface",
              "before:border-[rgb(57,13,35)] before:shadow-[inset_0_1px_1px_rgba(255,255,255,0.076)]",
              "lt:before:border-[rgb(251,223,227)]",
              "hover:-translate-y-1.5 hover:scale-[1.005]",
              "hover:glow-ring-on",
            ],
        className,
      )}
    >
      {/* The red ring, turned by the compositor (see glow-ring in
          globals.css). First rather than last, so a caller's space-y or
          last: never counts it; its z-index keeps it on top. */}
      <span aria-hidden className="glow-ring-track" />
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered on the right of the header row. */
  actions?: React.ReactNode;
}

export function CardHeader({ title, subtitle, actions, className, ...rest }: CardHeaderProps) {
  return (
    // The title keeps at least ~220px; actions that would squeeze it below
    // that wrap under it instead. On a phone, two buttons beside it left
    // the title a word or two wide, wrapping onto four lines -- a lone
    // icon still fits beside it and stays on the right.
    <div
      {...rest}
      className={cn("mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}
    >
      <div className="min-w-[min(100%,220px)] flex-1">
        <h3 className="font-display text-[18px] leading-tight font-bold text-fg">{title}</h3>
        {subtitle ? <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
