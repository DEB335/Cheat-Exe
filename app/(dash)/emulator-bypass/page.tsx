"use client";

import { useDashboard } from "@/lib/store";
import { LibBypassGeneratorPanel } from "@/components/emulator-bypass/LibBypassGeneratorPanel";
import { ActiveLibBypassTable } from "@/components/emulator-bypass/ActiveLibBypassTable";
import { cn } from "@/lib/utils";

export default function EmulatorBypassPage() {
  const db = useDashboard((s) => s.db);
  const maint = db.emulatorBypassMaintenance;
  const isMaintenance = Boolean(maint?.active);
  const maintenanceReason = maint?.reason;

  const isV2Maintenance = maint?.v2Maintenance !== undefined 
    ? Boolean(maint.v2Maintenance) 
    : Boolean(maint?.active && (maint?.engine === "V2" || maint?.engine === "ALL"));
  const isV1Maintenance = maint?.v1Maintenance !== undefined 
    ? Boolean(maint.v1Maintenance) 
    : true;

  return (
    <div className="space-y-8 pb-10">
      {/* Dynamic Engine Status Overview Banner with glowing neon hover effect */}
      {(isV1Maintenance || isV2Maintenance || isMaintenance) && (
        <div className="group/banner relative overflow-hidden rounded-2xl border border-amber-500/40 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.2),transparent_70%),linear-gradient(180deg,#140f05_0%,#0b0802_100%)] p-4 sm:p-5 shadow-[0_0_24px_rgba(245,158,11,0.18)] transition-all duration-300 hover:border-amber-400 hover:shadow-[0_0_42px_rgba(245,158,11,0.42),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:scale-[1.004]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Icon & Title/Subtitle */}
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="text-2xl shrink-0 mt-0.5 sm:mt-0 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                ⚠️
              </span>
              <div>
                <h4 className="text-[13.5px] sm:text-sm font-bold tracking-wide flex flex-wrap items-center gap-2">
                  {isV1Maintenance && !isV2Maintenance && (
                    <>
                      <span className="text-amber-400">Lib Bypass V1 is Under Maintenance</span>
                      <span className="text-slate-600 font-normal">|</span>
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span>🚀</span> Lib Bypass V2 is Online &amp; Working
                      </span>
                    </>
                  )}
                  {isV2Maintenance && !isV1Maintenance && (
                    <>
                      <span className="text-amber-400">Lib Bypass V2 is Under Maintenance</span>
                      <span className="text-slate-600 font-normal">|</span>
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span>⚡</span> Lib Bypass V1 is Online &amp; Working
                      </span>
                    </>
                  )}
                  {isV1Maintenance && isV2Maintenance && (
                    <span className="text-amber-400">Lib Bypass Service is Under Maintenance</span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {maintenanceReason || "Lib Bypass service is currently under scheduled maintenance. Please try again later."}
                </p>
              </div>
            </div>

            {/* Right: V1 & V2 Status Badges */}
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
              {/* V1 Badge */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider",
                  isV1Maintenance
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
                )}
              >
                <span className="text-amber-400">⚡ V1:</span>
                {isV1Maintenance ? (
                  <span className="flex items-center gap-1.5">
                    <span>🛠️</span>
                    <span>IN MAINTENANCE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>100% OPERATIONAL</span>
                  </span>
                )}
              </div>

              {/* V2 Badge */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider",
                  isV2Maintenance
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
                )}
              >
                <span className="text-red-400">🚀 V2:</span>
                {isV2Maintenance ? (
                  <span className="flex items-center gap-1.5">
                    <span>🛠️</span>
                    <span>IN MAINTENANCE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>100% OPERATIONAL</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Generator Panel (At the top, directly on the page) */}
      <LibBypassGeneratorPanel />

      {/* 2. Active Lib Bypass Keys Table (Directly below the generator) */}
      <ActiveLibBypassTable />
    </div>
  );
}
