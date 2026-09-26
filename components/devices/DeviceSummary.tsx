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
  /** Signed-in sessions -- one per row of the table. */
  online: number;
  /** Distinct accounts those sessions belong to. */
  accounts: number;
  /** IP / device block rules in force. */
  blocked: number;
  uniqueIps: number;
}

type IconComponent = (p: React.SVGProps<SVGSVGElement>) => React.ReactNode;

/**
 * The design's four chips. Its "Pending" and "Total Sessions" slots have
 * no data behind them in this panel, so they carry the distinct accounts
 * and addresses instead -- same colours and places, numbers that exist.
 * `rgb` drives border and glow, `ink` the brighter mark on the right.
 */
const CHIPS: Array<{
  stat: keyof DeviceSummaryStats;
  label: string;
  rgb: string;
  ink: string;
  Icon: IconComponent;
  Mark: IconComponent;
}> = [
  { stat: "online", label: "Online Devices", rgb: "16, 214, 160", ink: "#3dffc0", Icon: UserIcon, Mark: TrendUpIcon },
  { stat: "accounts", label: "Accounts", rgb: "59, 130, 246", ink: "#7ab8ff", Icon: UsersIcon, Mark: ClockIcon },
  { stat: "blocked", label: "Blocked", rgb: "255, 45, 122", ink: "#ff5c93", Icon: BanIcon, Mark: ShieldCheckIcon },
  { stat: "uniqueIps", label: "Unique IPs", rgb: "139, 84, 255", ink: "#b692ff", Icon: GlobeIcon, Mark: BarChartIcon },
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

const MAX_TILT = 8;

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
  const tilt = useTilt();
  const shown = useCountUp(value);

  return (
    // The perspective lives on the parent so the tile itself can rotate
    // inside it; on the tile, it would flatten its own children.
    <div style={{ "--chip": rgb, "--ink": ink } as React.CSSProperties} className="min-w-0 [perspective:900px]">
      <div
        onPointerMove={tilt.move}
        onPointerLeave={tilt.leave}
        className={cn(
          // No overflow-hidden or backdrop-blur here: either one flattens
          // preserve-3d, and the disc and mark would lose their depth.
          // The clipped, blurred glass is the first layer inside instead.
          "group relative flex h-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 sm:px-3.5",
          "border-[rgba(var(--chip),0.75)]",
          "bg-[linear-gradient(135deg,rgba(var(--chip),0.24)_0%,rgba(6,10,36,0.86)_55%,rgba(var(--chip),0.1)_100%)]",
          "shadow-[0_0_18px_-3px_rgba(var(--chip),0.55),0_14px_26px_-18px_rgba(var(--chip),0.9),inset_0_0_18px_rgba(var(--chip),0.12),inset_0_1px_0_rgba(255,255,255,0.09)]",
          "lt:border-[rgba(var(--chip),0.45)] lt:bg-none lt:bg-white/85",
          "lt:shadow-[0_10px_24px_-16px_rgba(var(--chip),0.7),inset_0_1px_0_rgba(255,255,255,0.9)]",
          // Pointer-driven tilt: the handlers write the angles, the lift and
          // the transition speed -- quick while following, slow settling back.
          "[transform-style:preserve-3d]",
          "[transform:translateY(var(--lift,0px))_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]",
          "transition-[transform,box-shadow] ease-smooth [transition-duration:var(--tilt-ms,600ms)]",
          "hover:shadow-[0_0_26px_-2px_rgba(var(--chip),0.75),0_20px_30px_-18px_rgba(var(--chip),0.95),inset_0_0_22px_rgba(var(--chip),0.18),inset_0_1px_0_rgba(255,255,255,0.12)]",
          "lt:hover:shadow-[0_16px_30px_-16px_rgba(var(--chip),0.75)]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] backdrop-blur-md"
        >
          {/* Gloss that follows the pointer across the glass. */}
          <span
            className={cn(
              "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
              "bg-[radial-gradient(180px_circle_at_var(--mx,50%)_var(--my,0%),rgba(255,255,255,0.16),transparent_60%)]",
              "lt:bg-[radial-gradient(180px_circle_at_var(--mx,50%)_var(--my,0%),rgba(var(--chip),0.12),transparent_60%)]",
            )}
          />
          {/* Hairline sheen along the top edge. */}
          <span className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] lt:opacity-0" />
        </span>

        {/* The disc stands forward of the glass; the float runs on the
            inner element so it never fights the depth transform. */}
        <div className="shrink-0 [transform:translateZ(26px)]">
          <div
            className={cn(
              "animate-float-y flex size-9 items-center justify-center rounded-full border sm:size-10",
              "border-[rgba(var(--chip),0.8)] text-white",
              "bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.35)_0%,rgba(var(--chip),0.75)_28%,rgba(var(--chip),0.28)_62%,rgba(4,8,30,0.95)_100%)]",
              "shadow-[0_0_0_3px_rgba(var(--chip),0.14),0_0_16px_rgba(var(--chip),0.6),0_8px_14px_-6px_rgba(0,0,0,0.7),inset_0_-5px_8px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
              "lt:bg-none lt:bg-[rgba(var(--chip),0.14)] lt:text-[rgb(var(--chip))]",
              "lt:shadow-[0_0_0_3px_rgba(var(--chip),0.08),0_6px_12px_-6px_rgba(var(--chip),0.7)]",
            )}
          >
            <Icon className="size-[17px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:size-[18px] lt:drop-shadow-none" strokeWidth={2.2} />
          </div>
        </div>

        {/* Left on the glass: lifted in 3D, the number and label would be
            drawn ~2% oversize and soft even with the tile at rest.
            Positioned so it paints after the blurred glass layer above;
            left in flow, that absolute layer painted over it and blurred it. */}
        <div className="relative min-w-0 flex-1">
          <div
            className="font-display text-[21px] leading-none font-extrabold text-white tabular-nums [text-shadow:0_0_14px_rgba(var(--chip),0.6)] sm:text-[22px] lt:text-fg lt:[text-shadow:none]"
          >
            {shown}
          </div>
          {/* Two lines on a phone rather than "Online Devic…"; one from sm up. */}
          <div className="mt-1.5 line-clamp-2 text-[11.5px] leading-tight font-medium text-[#c9d6f2] sm:truncate sm:text-[12.5px] lt:text-muted">
            {label}
          </div>
        </div>

        <Mark
          aria-hidden
          className="hidden size-5 shrink-0 text-[var(--ink)] drop-shadow-[0_0_6px_rgba(var(--chip),0.85)] [transform:translateZ(22px)] sm:block lt:text-[rgb(var(--chip))] lt:drop-shadow-none"
          strokeWidth={2.2}
        />
      </div>
    </div>
  );
}

/**
 * Tilts the tile toward the pointer. Writes CSS variables straight onto
 * the element, so following the cursor re-renders nothing and no frame
 * loop runs while it is idle. Off for reduced motion and touch screens.
 */
function useTilt() {
  const enabled = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
    const sync = () => {
      enabled.current = !query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (!enabled.current || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--lift", "-3px");
    el.style.setProperty("--tilt-ms", "120ms");
  };

  const leave = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    for (const name of ["--ry", "--rx", "--lift"]) el.style.removeProperty(name);
    el.style.setProperty("--tilt-ms", "600ms");
  };

  return { move, leave };
}

/**
 * Counts from where the number last stood to its new value over `ms`,
 * easing out. One short frame loop per change; it stops when it lands.
 * Server and first client render both show 0, so hydration agrees.
 */
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
      // Kept current, so a change mid-count carries on from here.
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return shown;
}
