import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The original markup pairs `.card` with `.card-flat` for the wide
   * table panels: heavier blur, flat translucent fill, gentler lift.
   */
  flat?: boolean;
}

export function Card({ flat = false, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "glow-ring relative rounded-[20px] border border-line p-[30px]",
        "transition-[transform,box-shadow,border-color] duration-[400ms] ease-smooth",
        "hover:border-line-hover",
        flat
          ? [
              "bg-[rgba(10,15,30,0.72)] shadow-[var(--card-shadow)] backdrop-blur-[35px]",
              "hover:-translate-y-1 hover:scale-[1.005]",
              "hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]",
              "hover:glow-ring-slow lt:bg-white/70",
            ]
          : [
              "card-surface backdrop-blur-[25px]",
              "hover:-translate-y-1.5 hover:scale-[1.005]",
              "hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]",
              "hover:glow-ring-on",
            ],
        className,
      )}
    >
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
    <div {...rest} className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h3 className="font-display text-[18px] leading-tight font-bold text-fg">{title}</h3>
        {subtitle ? <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
