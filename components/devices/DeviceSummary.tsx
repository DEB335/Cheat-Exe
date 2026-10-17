"use client";

import { useEffect, useRef, useState } from "react";

import {
  BanIcon,
  BarChartIcon,
  ClockIcon,
  GlobeIcon,
  ShieldCheckIcon,
  TrendUpIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export interface DeviceSummaryStats {
  online: number;
  accounts: number;
  blocked: number;
  uniqueIps: number;
}

type IconComponent = (p: React.SVGProps<SVGSVGElement>) => React.ReactNode;

const CHIPS: Array<{
  stat: keyof DeviceSummaryStats;
  label: string;
  rgb: string;
  ink: string;
  Icon: IconComponent;
  Mark: IconComponent;
}> = [
  { stat: "online", label: "Online Devices", rgb: "255, 45, 90", ink: "#ff4d79", Icon: UserIcon, Mark: TrendUpIcon },
  { stat: "accounts", label: "Accounts", rgb: "255, 75, 120", ink: "#ff6688", Icon: UsersIcon, Mark: ClockIcon },
  { stat: "blocked", label: "Blocked", rgb: "255, 31, 90", ink: "#ff1f5a", Icon: BanIcon, Mark: ShieldCheckIcon },
  { stat: "uniqueIps", label: "Unique IPs", rgb: "255, 45, 90", ink: "#ff6b8b", Icon: GlobeIcon, Mark: BarChartIcon },
];

export function DeviceSummary({ stats, className }: { stats: DeviceSummaryStats; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4", className)}>
      {CHIPS.map(({ stat, ...chip }) => (
        <Chip key={stat} {...chip} value={stats[stat]} />
      ))}
    </div>
  );
}

function Chip({
  label,
  rgb,
  ink,
  Icon,
  Mark,
  value,
}: {
  label: string;
  rgb: string;
  ink: string;
  Icon: IconComponent;
  Mark: IconComponent;
  value: number;
}) {
  const shown = useCountUp(value);

  return (
    <div style={{ "--chip": rgb, "--ink": ink } as React.CSSProperties} className="min-w-0">
      <div
        className={cn(
          "group relative flex h-full min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3",
          "border-[rgba(255,45,90,0.18)]",
          "bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] backdrop-blur-xl",
          "shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]",
          "transition-all duration-300 ease-smooth",
          "hover:-translate-y-1 hover:border-[rgba(255,45,90,0.45)] hover:shadow-[0_16px_30px_-8px_rgba(255,0,50,0.22)]",
          "lt:border-slate-200 lt:bg-white/80 lt:shadow-sm",
        )}
      >
        {/* Soft gloss across the top */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-2xl bg-[radial-gradient(ellipse_120px_40px_at_50%_0%,rgba(255,45,90,0.12),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* Icon disc */}
        <div className="shrink-0">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border sm:size-10",
              "border-[rgba(var(--chip),0.4)] text-[var(--ink)]",
              "bg-[linear-gradient(145deg,rgba(var(--chip),0.18)_0%,rgba(24,5,12,0.6)_100%)]",
              "shadow-[0_0_12px_rgba(var(--chip),0.18),inset_0_1px_0_rgba(255,255,255,0.1)]",
              "lt:bg-slate-100 lt:border-slate-200",
            )}
          >
            <Icon className="size-[17px] sm:size-[18px]" strokeWidth={2.2} />
          </div>
        </div>

        {/* Number and label */}
        <div className="relative min-w-0 flex-1">
          <div className="font-display text-[22px] sm:text-[24px] leading-none font-extrabold text-white tabular-nums tracking-tight [text-shadow:0_0_8px_rgba(var(--chip),0.2)] lt:[text-shadow:none] lt:text-slate-900">
            {shown}
          </div>
          <div className="mt-1 line-clamp-1 text-[11.5px] leading-tight font-medium text-[#c9b0b8] sm:text-[12px] lt:text-muted">
            {label}
          </div>
        </div>

        <Mark
          aria-hidden
          className="hidden size-4 shrink-0 text-[var(--ink)] opacity-70 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-100 sm:block"
          strokeWidth={2.2}
        />
      </div>
    </div>
  );
}

function useCountUp(target: number, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let began = 0;
    const step = (now: number) => {
      if (!began) began = now;
      const progress = instant ? 1 : Math.min(1, (now - began) / ms);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return shown;
}
