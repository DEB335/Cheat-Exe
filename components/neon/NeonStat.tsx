import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils";

import { NeonChip } from "./chips";
import { IconTile } from "./IconTile";
import { toneVars, type NeonTone } from "./tones";

interface NeonStatProps {
  tone: NeonTone;
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  /** A line under the value, e.g. "of 128 total". */
  sub?: React.ReactNode;
  /** A small figure on the right, e.g. "90.1%". Omit rather than invent one. */
  chip?: React.ReactNode;
  /**
   * Trend line on the right, from real data. `null` draws the dashed
   * no-history baseline; leave it undefined for a tile without one.
   */
  spark?: number[] | null;
  /** Read out in place of the sparkline picture. */
  sparkLabel?: string;
  /** "ring" (history/audit tiles) or "tile" (vault tiles). Default "ring". */
  iconShape?: "ring" | "tile";
  /** Colour the value in the tone rather than white (audit, vault). */
  tintValue?: boolean;
  /** Upper-case, letter-spaced label (history, vault). Default true. */
  capsLabel?: boolean;
  className?: string;
}

/**
 * A stat tile in the neon language: a rim and inner glow in the tone,
 * the icon in a lit ring or tile, label over a big number, and an
 * optional chip or sparkline on the right.
 *
 * Numbers are the caller's, from the store -- the tile never makes one
 * up. Keeps StatCard's hover: the rotating glow ring, a lift and a
 * slight grow, the icon tipping over, the sparkline's end dot swelling.
 */
export function NeonStat({
  tone,
  icon,
  label,
  value,
  sub,
  chip,
  spark,
  sparkLabel,
  iconShape = "ring",
  tintValue = false,
  capsLabel = true,
  className,
}: NeonStatProps) {
  return (
    <div
      // Sparkline reads --stat; the kit's own classes read --tone.
      style={{ ...toneVars(tone), "--stat": "var(--tone)", "--spark": "var(--tone-hi)" } as React.CSSProperties}
      className={cn(
        "group glow-ring relative flex min-h-[104px] min-w-0 items-center gap-4 rounded-[18px] border px-5 py-4 sm:gap-5",
        "border-[rgba(var(--tone),0.5)]",
        "[background:radial-gradient(90%_120%_at_0%_50%,rgba(var(--tone),0.2),transparent_65%),radial-gradient(60%_80%_at_100%_100%,rgba(var(--tone),0.1),transparent_70%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_40%),linear-gradient(160deg,rgba(10,14,44,0.88),rgba(6,8,30,0.92))]",
        "shadow-[0_0_13px_-4px_rgba(var(--tone),0.32),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_24px_rgba(var(--tone),0.05)]",
        "transition-[translate,scale,box-shadow,border-color] duration-[400ms] ease-smooth",
        "hover:glow-ring-on hover:-translate-y-1.5 hover:scale-[1.02] hover:border-[rgba(var(--tone-hi),0.85)]",
        "hover:shadow-[0_12px_22px_-12px_rgba(var(--tone),0.36),0_0_16px_-4px_rgba(var(--tone),0.44),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_26px_rgba(var(--tone),0.07)]",
        "lt:border-[rgba(var(--tone),0.4)] lt:[background:linear-gradient(160deg,rgba(255,255,255,0.95),rgba(var(--tone),0.06))]",
        "lt:shadow-[0_6px_14px_-8px_rgba(var(--tone),0.27)] lt:hover:shadow-[0_10px_20px_-10px_rgba(var(--tone),0.36)] lt:hover:border-[rgba(var(--tone),0.7)]",
        className,
      )}
    >
      <IconTile
        tone={tone}
        variant={iconShape === "ring" ? "ring" : "glass"}
        size="lg"
        className="transition-transform duration-[400ms] ease-back group-hover:scale-110 group-hover:rotate-6"
      >
        {icon}
      </IconTile>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[13px] leading-tight",
            capsLabel
              ? "font-semibold tracking-[0.8px] text-[#cdd6f4] uppercase lt:text-slate-500"
              : "font-medium text-[#dbe4ff] lt:text-slate-600",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "mt-1.5 font-display text-[30px] leading-none font-bold tabular-nums",
            tintValue
              ? "text-[rgb(var(--tone-hi))] [text-shadow:0_0_8px_rgba(var(--tone),0.24)] lt:text-[var(--tone-lt)] lt:[text-shadow:none]"
              : "text-white [text-shadow:0_0_8px_rgba(var(--tone),0.18)] lt:text-slate-900 lt:[text-shadow:none]",
          )}
        >
          {value}
        </div>
        {sub ? <div className="mt-1.5 truncate text-[12px] text-[#a9b8e0] lt:text-slate-500">{sub}</div> : null}
      </div>

      {chip !== undefined && chip !== null ? (
        <NeonChip tone={tone} size="xs" caps={false} className="self-end">
          {chip}
        </NeonChip>
      ) : null}

      {spark !== undefined ? (
        <Sparkline values={spark} label={sparkLabel} className="h-10 w-[112px] shrink max-sm:hidden" />
      ) : null}

      {/* The hover ring, turned by the compositor (see glow-ring in
          globals.css). Absolute, so the flex gap never counts it. */}
      <span aria-hidden className="glow-ring-track" />
    </div>
  );
}
