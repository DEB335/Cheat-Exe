import { useId } from "react";

import { ArrowRightIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import type { Trend } from "@/lib/trends";
import { cn } from "@/lib/utils";

import { Sparkline } from "./Sparkline";

export type StatAccent = "purple" | "red" | "cyan" | "green" | "orange";

/**
 * The original used :nth-child() to tint each tile; here the accent is
 * explicit, which keeps the colours stable if the order ever changes.
 *
 * `rgb` is the tile's border and glow. It is tuned to the overview
 * design rather than reusing the --accent-* tokens: those are pitched
 * for text on a card, and at 1.5px of border the purple read grey and
 * the cyan read green. `ink` is the icon's two-stop gradient and
 * `spark`, where set, a brighter line than the border would give.
 */
const ACCENTS: Record<StatAccent, { rgb: string; ink: [string, string]; spark?: string }> = {
  purple: { rgb: "139, 84, 255", ink: ["#ff9fe8", "#9d6cff"], spark: "150, 112, 255" },
  red: { rgb: "255, 45, 122", ink: ["#ff7aa8", "#ff2d6a"] },
  cyan: { rgb: "53, 132, 236", ink: ["#8ccbff", "#3d8bff"], spark: "66, 150, 255" },
  green: { rgb: "16, 196, 138", ink: ["#6ff7c6", "#10c98c"], spark: "34, 222, 158" },
  orange: { rgb: "236, 172, 64", ink: ["#ffdc8f", "#f5a524"], spark: "245, 184, 72" },
};

/*
 * Layered on one element so the tile stays a single box: the fills are
 * clipped to the padding box, and the last two layers show only through
 * the transparent border -- a border that is brightest bottom-left and
 * fades toward the top-right, the way light falls on it in the design.
 * The hover rule paints a solid accent border over the lot.
 */
const SURFACE = [
  "radial-gradient(95% 85% at 0% 100%, rgba(var(--stat), 0.17), transparent 70%) padding-box",
  "radial-gradient(70% 70% at 100% 115%, rgba(var(--stat), 0.1), transparent 70%) padding-box",
  "linear-gradient(180deg, rgba(var(--stat), 0.05), transparent 45%) padding-box",
  "linear-gradient(180deg, #070a26 0%, #04061a 100%) padding-box",
  "linear-gradient(to top, rgba(var(--stat), 0.65), transparent 55%) border-box",
  "linear-gradient(to right, rgba(var(--stat), 0.95), rgba(var(--stat), 0.28) 55%, rgba(var(--stat), 0.4)) border-box",
].join(", ");

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
  const { rgb, ink, spark } = ACCENTS[accent];
  const inkId = useId();

  return (
    <div
      style={
        { "--stat": rgb, "--spark": spark ?? rgb, "--tile-bg": SURFACE } as React.CSSProperties
      }
      className={cn(
        "group glow-ring relative flex min-w-0 flex-col overflow-hidden",
        "rounded-[18px] border-[1.5px] border-transparent px-[22px] pt-[22px] pb-[18px]",
        "[background:var(--tile-bg)] lt:[background:var(--card-bg)] lt:border-[rgba(var(--stat),0.45)]",
        "shadow-[0_0_20px_-4px_rgba(var(--stat),0.42),0_12px_28px_-16px_rgba(var(--stat),0.6),inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-26px_36px_-26px_rgba(var(--stat),0.4)]",
        "lt:shadow-[0_8px_24px_-14px_rgba(var(--stat),0.5)]",
        "transition-[transform,box-shadow,border-color] duration-[400ms] ease-smooth",
        "hover:glow-ring-on hover:-translate-y-1.5 hover:scale-[1.02]",
        "hover:border-[rgb(var(--stat))] lt:hover:border-[rgb(var(--stat))]",
        "hover:shadow-[0_20px_40px_rgba(var(--stat),0.15),0_0_28px_-2px_rgba(var(--stat),0.55),inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-26px_36px_-22px_rgba(var(--stat),0.5)]",
        "lt:hover:shadow-[0_20px_40px_rgba(var(--stat),0.15)]",
      )}
    >
      {/* 4px accent bar that fades in on hover */}
      <span className="absolute inset-y-0 left-0 w-1 bg-[rgb(var(--stat))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Paint server for the icon's gradient stroke. userSpaceOnUse on the
          icons' 24-unit grid, because a bounding-box gradient paints
          nothing on a perfectly straight line -- half the CPU glyph. */}
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
            "flex size-14 shrink-0 items-center justify-center rounded-2xl border",
            "border-[rgba(var(--stat),0.55)] text-[rgb(var(--stat))]",
            "bg-[linear-gradient(145deg,rgba(var(--stat),0.42)_0%,rgba(var(--stat),0.14)_55%,rgba(var(--stat),0.26)_100%)]",
            "shadow-[0_0_18px_-4px_rgba(var(--stat),0.55),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_14px_rgba(var(--stat),0.22)]",
            "lt:shadow-none",
            "[&>svg]:size-7 [&>svg]:[stroke:var(--ink)] [&>svg]:[stroke-width:2.2] [&>svg]:drop-shadow-[0_0_6px_rgba(var(--stat),0.6)]",
            "transition-transform duration-[400ms] ease-back group-hover:scale-110 group-hover:rotate-6",
          )}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="font-display text-[30px] leading-none font-extrabold text-fg [text-shadow:0_0_18px_rgba(var(--stat),0.35)] lt:[text-shadow:none]">
            {value}
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-none font-semibold text-[#d5def2] uppercase lt:text-muted">
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

/**
 * The change, its caption and the sparkline along the bottom of a tile.
 *
 * With no change to report it still takes the same room -- a flat arrow,
 * a dash and a dashed baseline -- so a tile without history lines up
 * with its neighbours instead of collapsing, and never shows a number
 * nobody measured.
 */
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
    <div className="mt-auto flex items-end justify-between gap-2 pt-4 pl-1.5">
      <div className="shrink-0">
        <div
          className={cn(
            "flex items-center gap-1.5 text-[14px] leading-none font-semibold whitespace-nowrap",
            direction > 0 && "text-[#22dd98] lt:text-emerald-600",
            direction < 0 && "text-[#ff5a7e] lt:text-rose-600",
            direction === 0 && "text-[#c9d4ee] lt:text-slate-600",
          )}
        >
          <Arrow className="size-3.5 shrink-0" strokeWidth={2.75} />
          <span>{text}</span>
          {trend.metric && (
            <span className="text-[12px] font-medium text-[#8091bc] lt:text-muted">{trend.metric}</span>
          )}
        </div>
        <div className="mt-2 text-[12.5px] leading-none whitespace-nowrap text-[#8091bc] lt:text-muted">
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

/** The "LIVE" pill beside the Devices label. The dot pings only on hover. */
export function LivePip() {
  return (
    <span
      className={cn(
        // Taller than the label it sits beside; the negative margin keeps
        // it from pushing the Devices tile taller than its neighbours.
        "-my-1 inline-flex h-[21px] items-center gap-[5px] rounded-full border px-[7px]",
        "border-[rgba(16,185,129,0.5)] bg-[rgba(5,90,68,0.42)]",
        "text-[10.5px] leading-none font-bold tracking-[0.4px] text-[#2ff0b0]",
        "shadow-[0_0_12px_-3px_rgba(16,185,129,0.6),inset_0_0_8px_rgba(16,185,129,0.16)]",
        "lt:border-emerald-300 lt:bg-emerald-50 lt:text-emerald-600 lt:shadow-none",
      )}
    >
      <span className="relative inline-flex size-1.5">
        <span className="absolute inset-0 rotate-45 rounded-[1px] bg-current opacity-0 group-hover:animate-ping group-hover:opacity-75" />
        <span className="relative size-1.5 rotate-45 rounded-[1px] bg-current shadow-[0_0_6px_#10b981]" />
      </span>
      LIVE
    </span>
  );
}
