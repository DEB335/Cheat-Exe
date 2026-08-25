import { cn } from "@/lib/utils";

export type StatAccent = "purple" | "red" | "cyan" | "green" | "orange";

/**
 * The original used :nth-child() to tint each tile; here the accent is
 * explicit, which keeps the colours stable if the order ever changes.
 */
const ACCENTS: Record<StatAccent, { rgb: string; token: string }> = {
  purple: { rgb: "168, 85, 247", token: "var(--accent-purple)" },
  red: { rgb: "255, 31, 90", token: "var(--accent-red)" },
  cyan: { rgb: "6, 182, 212", token: "var(--accent-cyan)" },
  green: { rgb: "16, 185, 129", token: "var(--accent-green)" },
  orange: { rgb: "245, 158, 11", token: "var(--accent-orange)" },
};

export function StatCard({
  accent,
  icon,
  value,
  label,
}: {
  accent: StatAccent;
  icon: React.ReactNode;
  value: React.ReactNode;
  label: React.ReactNode;
}) {
  const { rgb, token } = ACCENTS[accent];

  return (
    <div
      style={{ "--stat": rgb, "--stat-token": token } as React.CSSProperties}
      className={cn(
        "group glow-ring card-surface relative flex items-center gap-4 overflow-hidden",
        "rounded-2xl border border-line p-6",
        "transition-[transform,box-shadow,border-color] duration-[400ms] ease-smooth",
        "hover:glow-ring-on hover:-translate-y-1.5 hover:scale-[1.02]",
        "hover:border-[rgb(var(--stat))] hover:shadow-[0_20px_40px_rgba(var(--stat),0.15)]",
      )}
    >
      {/* 4px accent bar that fades in on hover */}
      <span className="absolute inset-y-0 left-0 w-1 bg-[rgb(var(--stat))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div
        className={cn(
          "flex size-[46px] shrink-0 items-center justify-center rounded-xl border",
          "border-[rgba(var(--stat),0.15)] text-[rgb(var(--stat))]",
          "bg-[linear-gradient(135deg,rgba(var(--stat),0.18)_0%,rgba(var(--stat),0.01)_100%)]",
          "transition-transform duration-[400ms] ease-back group-hover:scale-110 group-hover:rotate-6",
        )}
      >
        {icon}
      </div>

      <div>
        <div className="mb-1.5 font-display text-[24px] leading-none font-extrabold text-fg">
          {value}
        </div>
        <div className="flex items-center text-[11px] font-bold tracking-[1px] text-muted uppercase">
          {label}
        </div>
      </div>
    </div>
  );
}

/** The small "LIVE" pip beside the Devices label. */
export function LivePip() {
  return (
    <span className="ml-1 inline-flex items-center gap-[3px] rounded-[10px] border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.15)] px-1.5 py-px text-[9px] font-bold text-[#10b981]">
      <span className="inline-block size-1 rounded-full bg-[#10b981] shadow-[0_0_4px_#10b981]" />
      LIVE
    </span>
  );
}
