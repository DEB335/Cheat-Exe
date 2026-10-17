"use client";

import { useId, useRef } from "react";

import { MetricsChart, PerformanceTicker } from "@/components/charts/MetricsChart";
import { BarChartIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Headline card for the overview: transparent red glassmorphic backdrop
 * with real tile counts as a glowing ruby/crimson curve and live FPS/latency pills.
 */
export function PerformanceCard({ values, labels }: { values: number[]; labels: string[] }) {
  const titleRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const gradientId = `perf-bars-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <Card
      className={cn(
        "group/perf relative overflow-hidden rounded-[22px] border border-[rgba(255,45,90,0.18)] p-0",
        "bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] backdrop-blur-xl",
        "shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)]",
        "transition-all duration-300 hover:border-[rgba(255,45,90,0.4)] hover:shadow-[0_22px_45px_-10px_rgba(255,0,50,0.2)]",
        "lt:border-line lt:bg-white/80",
      )}
    >
      <div className="relative">
        {/* Soft radial crimson glow at the top centre */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-[21px]",
            "bg-[radial-gradient(ellipse_65%_60%_at_50%_0%,rgba(255,30,60,0.14),transparent_70%)]",
            "lt:bg-none",
          )}
        >
          {/* Thin crimson highlight along the top rim */}
          <span className="absolute top-0 left-[25%] h-px w-[50%] bg-[linear-gradient(90deg,transparent,rgba(255,50,90,0.65),transparent)]" />
        </div>

        <div className="relative z-[2] flex flex-wrap items-start justify-between gap-4 pt-[22px] pr-[33px] pl-[23px] max-sm:pr-[23px]">
          <div ref={titleRef} className="flex items-center gap-[17px]">
            <div
              className={cn(
                "relative size-[52px] shrink-0 rounded-2xl p-px",
                "bg-[linear-gradient(150deg,rgba(255,45,90,0.85)_0%,rgba(190,18,60,0.4)_50%,rgba(255,45,90,0.7)_100%)]",
                "shadow-[0_0_16px_rgba(255,30,60,0.25)]",
                "transition-transform duration-[400ms] ease-back group-hover/perf:scale-105 group-hover/perf:-rotate-3",
                "lt:shadow-none",
              )}
            >
              <div className="grid size-full place-items-center rounded-[15px] bg-[linear-gradient(160deg,#24060f_0%,#0e0206_100%)] lt:bg-white">
                <svg aria-hidden width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="5" y1="0" x2="19" y2="0">
                      <stop offset="0" stopColor="#ff4d79" />
                      <stop offset="0.5" stopColor="#ff1f5a" />
                      <stop offset="1" stopColor="#e11d48" />
                    </linearGradient>
                  </defs>
                </svg>
                <BarChartIcon
                  stroke={`url(#${gradientId})`}
                  strokeWidth={3.6}
                  className="size-[25px] drop-shadow-[0_0_8px_rgba(255,31,90,0.45)]"
                />
              </div>
              <span className="absolute -top-[4px] right-[12px] size-[9px] rounded-full bg-[#ff2244] shadow-[0_0_8px_2px_rgba(255,30,60,0.6)]" />
            </div>
            <div>
              <h3 className="font-display text-[20px] leading-tight font-bold text-fg">System Performance</h3>
              <p className="mt-1 text-[14.5px] text-[#c9b0b8] lt:text-muted">Real-time metrics &amp; latency.</p>
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
