"use client";

import { ArrowRightIcon, CpuIcon } from "@/components/icons";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";

/**
 * The "Real-Time Active Devices" header banner:
 * Clean, transparent red glassmorphic design without heavy 3D models.
 */
export function DevicesBanner({ online, onViewAll }: { online: number; onViewAll: () => void }) {
  return (
    <div
      className={cn(
        "group/banner relative isolate overflow-hidden border-b border-[rgba(255,45,90,0.18)]",
        "bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(14,3,8,0.72)_100%)] backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        "lt:border-line lt:bg-white/70",
      )}
    >
      {/* Ambient crimson light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            "radial-gradient(ellipse 400px 180px at 100px 50%, rgba(255, 31, 90, 0.15), transparent 70%)",
            "radial-gradient(ellipse 300px 100px at calc(100% - 200px) 50%, rgba(225, 29, 72, 0.12), transparent 70%)",
          ].join(","),
        }}
      />

      <div
        className={cn(
          "relative flex min-h-[100px] flex-col gap-4 px-6 py-5",
          "lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,45,90,0.3)] bg-[linear-gradient(145deg,rgba(255,45,90,0.2)_0%,rgba(30,6,14,0.6)_100%)] text-[#ff4d79] shadow-[0_0_16px_rgba(255,30,60,0.22)]">
            <CpuIcon className="size-6 drop-shadow-[0_0_6px_rgba(255,45,90,0.4)]" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h3 className="font-display text-[22px] leading-[1.2] font-bold text-white sm:text-[23px] lt:text-fg">
                Real-Time Active Devices
              </h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border border-[rgba(255,45,90,0.5)] px-3 py-[4px]",
                  "bg-[rgba(55,8,20,0.65)] backdrop-blur-md",
                  "text-[12px] leading-none font-bold whitespace-nowrap text-[#ff4d79] uppercase",
                  "shadow-[0_0_8px_rgba(255,45,90,0.3)]",
                  "lt:border-rose-300 lt:bg-rose-50 lt:text-rose-600 lt:shadow-none",
                )}
              >
                <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-[#ff4d79]" />
                {online} Online Now
              </span>
            </div>
            <p className="mt-[4px] text-[13.5px] leading-5 text-[#c9b0b8] sm:text-[14.5px] lt:text-muted">
              Live devices connected via authenticated sessions.
            </p>
          </div>
        </div>

        <GlowButton
          variant="vivid"
          onClick={onViewAll}
          trailingIcon={<ArrowRightIcon className="size-4" />}
          className="w-full shrink-0 sm:w-auto"
        >
          View All Devices &amp; Controls
        </GlowButton>
      </div>
    </div>
  );
}
