"use client";

import { useId, useRef } from "react";

import { MetricsChart, PerformanceTicker } from "@/components/charts/MetricsChart";
import { ServerStack3D } from "@/components/dashboard/ServerStack3D";
import { BarChartIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * The overview's headline card: real tile counts as a glowing line, the
 * live FPS/ping pills, and a decorative 3D server stack that leans toward
 * the pointer. The shared Card still owns the hover lift and the conic
 * ring; everything here sits inside it.
 */
export function PerformanceCard({ values, labels }: { values: number[]; labels: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  // useId can contain characters that break a url(#...) reference.
  const gradientId = `perf-bars-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <Card
      className={cn(
        "group/perf rounded-[22px] border-[#18225e] p-0",
        "lt:border-line",
      )}
    >
      <div ref={rootRef} className="relative">
        {/* Fill and glows on their own layer: the shared card-surface
            gradient is too translucent for the background video behind
            this one, and the stack's floor needs clipping to the corners. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-[21px]",
            "bg-[radial-gradient(ellipse_34%_70%_at_88%_38%,rgba(84,62,230,0.2),transparent_72%),radial-gradient(ellipse_40%_60%_at_40%_0%,rgba(60,70,200,0.08),transparent_70%),linear-gradient(180deg,rgba(5,8,38,0.94)_0%,rgba(2,4,26,0.96)_100%)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
            "lt:bg-[radial-gradient(ellipse_34%_70%_at_88%_38%,rgba(124,58,237,0.08),transparent_72%),linear-gradient(180deg,#ffffff,#f8fafc)] lt:shadow-none",
          )}
        >
          {/* Thin highlight along the top edge, like light catching the rim. */}
          <span className="absolute top-0 left-[38%] h-px w-[34%] bg-[linear-gradient(90deg,transparent,rgba(190,110,255,0.55),rgba(90,120,255,0.4),transparent)]" />
          <ServerStack3D hostRef={rootRef} className="hidden lg:block" />
        </div>

        <div className="relative z-[2] flex flex-wrap items-start justify-between gap-4 pt-[22px] pr-[33px] pl-[23px] max-sm:pr-[23px]">
          <div ref={titleRef} className="flex items-center gap-[17px]">
            <div
              className={cn(
                "relative size-[52px] shrink-0 rounded-2xl p-px",
                "bg-[linear-gradient(150deg,rgba(124,92,255,0.8)_0%,rgba(80,70,220,0.35)_45%,rgba(255,45,122,0.7)_100%)]",
                "shadow-[0_0_18px_rgba(110,80,255,0.25)]",
                "transition-transform duration-[400ms] ease-back group-hover/perf:scale-105 group-hover/perf:-rotate-3",
                "lt:shadow-none",
              )}
            >
              <div className="grid size-full place-items-center rounded-[15px] bg-[linear-gradient(160deg,#1b1450_0%,#0b0b2c_100%)] lt:bg-white">
                <svg aria-hidden width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="5" y1="0" x2="19" y2="0">
                      <stop offset="0" stopColor="#ff3d8b" />
                      <stop offset="0.5" stopColor="#d946ef" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <BarChartIcon
                  stroke={`url(#${gradientId})`}
                  strokeWidth={3.6}
                  className="size-[25px] drop-shadow-[0_0_6px_rgba(255,45,122,0.5)]"
                />
              </div>
              {/* The small glowing bead on the tile's rim. */}
              <span className="absolute -top-[4px] right-[12px] size-[9px] rounded-full bg-[#4f6bff] shadow-[0_0_10px_3px_rgba(79,107,255,0.7)]" />
            </div>
            <div>
              <h3 className="font-display text-[20px] leading-tight font-bold text-fg">System Performance</h3>
              <p className="mt-1 text-[14.5px] text-[#8ab3e0] lt:text-muted">Real-time metrics &amp; latency.</p>
            </div>
          </div>
          <div ref={pillsRef}>
            <PerformanceTicker />
          </div>
        </div>

        <div className="relative z-[2] mt-[8px] h-[262px] pr-[62px] pb-[7px] max-sm:h-[240px] max-sm:pr-4">
          <MetricsChart values={values} labels={labels} avoid={[titleRef, pillsRef]} />
        </div>
      </div>
    </Card>
  );
}
