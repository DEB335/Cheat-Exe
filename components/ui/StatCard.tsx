import { useId } from "react";

import { ArrowRightIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import type { Trend } from "@/lib/trends";
import { cn } from "@/lib/utils";

import { Sparkline } from "./Sparkline";

export type StatAccent = "purple" | "red" | "cyan" | "green" | "orange";

const ACCENTS: Record<StatAccent, { rgb: string; ink: [string, string]; spark?: string }> = {
  purple: { rgb: "255, 45, 90", ink: ["#ff7aa8", "#ff2d6a"], spark: "255, 60, 110" },
  red: { rgb: "255, 31, 90", ink: ["#ff6688", "#ff1f5a"], spark: "255, 40, 90" },
  cyan: { rgb: "255, 75, 120", ink: ["#ffa0b8", "#ff4b78"], spark: "255, 80, 130" },
  green: { rgb: "255, 45, 90", ink: ["#ff7aa8", "#ff2d6a"], spark: "255, 40, 90" },
  orange: { rgb: "255, 60, 100", ink: ["#ff8ba7", "#ff3366"], spark: "255, 40, 90" },
};

export function StatCard({
  accent,
  icon,
  value,
  label,
  live = false,
  trend,
}: {
  accent: StatAccent;
  icon: React.ReactNode;
  value: React.ReactNode;
  label: React.ReactNode;
  /** Adds the LIVE pip beside the label. */
  live?: boolean;
  /** 7-day change and sparkline; omitted where a tile has none. */
  trend?: Trend;
}) {
  const { rgb, ink, spark } = ACCENTS[accent] ?? ACCENTS.red;
  const inkId = useId();

  return (
    <div
      style={
        { "--stat": rgb, "--spark": spark ?? rgb } as React.CSSProperties
      }
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden",
        "rounded-[20px] border border-[rgba(255,45,90,0.18)] px-[22px] pt-[22px] pb-[18px]",
        "bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] backdrop-blur-xl",
        "shadow-[0_14px_34px_-10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]",
        "transition-all duration-300 ease-smooth",
        "hover:-translate-y-1.5 hover:border-[rgba(255,45,90,0.45)] hover:shadow-[0_20px_42px_-10px_rgba(255,0,50,0.22)]",
        "lt:bg-white/80 lt:border-slate-200 lt:shadow-sm",
      )}
    >
      {/* Soft crimson ambient glow inside top of card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_180px_70px_at_50%_0%,rgba(255,45,90,0.12),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* Paint server for the icon's gradient stroke */}
      <svg aria-hidden className="pointer-events-none absolute size-0">
        <defs>
          <linearGradient id={inkId} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
            <stop offset="0" stopColor={ink[0]} />
            <stop offset="1" stopColor={ink[1]} />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex min-w-0 items-center gap-[18px]">
        <div
          style={{ "--ink": `url("#${inkId}") ${ink[1]}` } as React.CSSProperties}
          className={cn(
            "flex size-13 shrink-0 items-center justify-center rounded-2xl border",
            "border-[rgba(255,45,90,0.28)] text-[rgb(var(--stat))]",
            "bg-[linear-gradient(145deg,rgba(255,45,90,0.18)_0%,rgba(24,5,12,0.6)_100%)]",
            "shadow-[0_0_14px_rgba(255,30,60,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]",
            "lt:shadow-none lt:bg-slate-50",
            "[&>svg]:size-6 [&>svg]:[stroke:var(--ink)] [&>svg]:[stroke-width:2.2] [&>svg]:drop-shadow-[0_0_6px_rgba(255,45,90,0.35)]",
            "transition-transform duration-[400ms] ease-back group-hover:scale-110 group-hover:rotate-3",
          )}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="font-display text-[32px] sm:text-[34px] leading-none font-extrabold text-white tracking-tight [text-shadow:0_0_12px_rgba(255,45,90,0.2)] lt:[text-shadow:none] lt:text-slate-900">
            {value}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-none font-semibold text-[#c9b0b8] uppercase tracking-wide lt:text-muted">
            {label}
            {live && <LivePip />}
          </div>
        </div>
      </div>

      {trend && <TrendRow trend={trend} label={typeof label === "string" ? label : undefined} />}
    </div>
  );
}

/** Rounds the way a glance wants: whole percent from 10 up, one decimal below. */
function formatChange(change: number): { text: string; direction: -1 | 0 | 1 } {
  const abs = Math.abs(change);
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
  if (rounded === 0) return { text: "0%", direction: 0 };
  return change > 0 ? { text: `+${rounded}%`, direction: 1 } : { text: `−${rounded}%`, direction: -1 };
}

function TrendRow({ trend, label }: { trend: Trend; label?: string }) {
  const { text, direction } =
    trend.change !== null
      ? formatChange(trend.change)
      : trend.added !== undefined
        ? { text: trend.added > 0 ? `+${trend.added}` : "0", direction: trend.added > 0 ? (1 as const) : (0 as const) }
        : { text: "—", direction: 0 as const };

  const Arrow = direction > 0 ? TrendUpIcon : direction < 0 ? TrendDownIcon : ArrowRightIcon;
  const subject = trend.metric ?? label?.replace(/^total\s+/i, "");

  return (
    <div className="mt-auto flex items-end justify-between gap-2 pt-4 pl-1">
      <div className="shrink-0">
        <div
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] leading-none font-semibold whitespace-nowrap",
            direction > 0 && "text-[#ff4d79] lt:text-rose-600",
            direction < 0 && "text-[#ff5a7e] lt:text-rose-600",
            direction === 0 && "text-[#c9d4ee] lt:text-slate-600",
          )}
        >
          <Arrow className="size-3.5 shrink-0" strokeWidth={2.75} />
          <span>{text}</span>
          {trend.metric && (
            <span className="text-[12px] font-medium text-[#a89098] lt:text-muted">{trend.metric}</span>
          )}
        </div>
        <div className="mt-2 text-[12px] leading-none whitespace-nowrap text-[#a89098] lt:text-muted">
          {trend.caption}
        </div>
      </div>
      <Sparkline
        values={trend.series}
        label={subject ? `${subject} over the last 7 days` : undefined}
        className="mb-0.5"
      />
    </div>
  );
}

/** The "LIVE" pill beside the Devices label */
export function LivePip() {
  return (
    <span
      className={cn(
        "-my-1 inline-flex h-[20px] items-center gap-[5px] rounded-full border px-[7px]",
        "border-[rgba(255,45,90,0.5)] bg-[rgba(55,8,20,0.65)]",
        "text-[10px] leading-none font-bold tracking-[0.4px] text-[#ff4d79]",
        "shadow-[0_0_8px_rgba(255,45,90,0.3)]",
        "lt:border-rose-300 lt:bg-rose-50 lt:text-rose-600 lt:shadow-none",
      )}
    >
      <span className="relative inline-flex size-1.5">
        <span className="absolute inset-0 rotate-45 rounded-[1px] bg-current opacity-0 group-hover:animate-ping group-hover:opacity-75" />
        <span className="relative size-1.5 rotate-45 rounded-[1px] bg-current shadow-[0_0_4px_rgba(255,45,90,0.6)]" />
      </span>
      LIVE
    </span>
  );
}
