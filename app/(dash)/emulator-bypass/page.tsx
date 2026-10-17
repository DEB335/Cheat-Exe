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
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,45,90,0.35)] bg-[radial-gradient(ellipse_at_top_left,rgba(255,45,90,0.14),transparent_70%),linear-gradient(180deg,#18050c_0%,#0e0207_100%)] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-[rgba(255,45,90,0.6)] hover:shadow-[0_0_30px_rgba(255,31,90,0.25)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Icon & Title/Subtitle */}
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="text-2xl shrink-0 mt-0.5 sm:mt-0 text-red-400 drop-shadow-[0_0_8px_rgba(255,45,90,0.5)]">
                ⚠️
              </span>
              <div>
                <h4 className="text-[13.5px] sm:text-sm font-bold tracking-wide flex flex-wrap items-center gap-2">
                  {isV1Maintenance && !isV2Maintenance && (
                    <>
                      <span className="text-red-400">Lib Bypass V1 is Under Maintenance</span>
                      <span className="text-slate-600 font-normal">|</span>
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span>🚀</span> Lib Bypass V2 is Online &amp; Working
                      </span>
                    </>
                  )}
                  {isV2Maintenance && !isV1Maintenance && (
                    <>
                      <span className="text-red-400">Lib Bypass V2 is Under Maintenance</span>
                      <span className="text-slate-600 font-normal">|</span>
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span>⚡</span> Lib Bypass V1 is Online &amp; Working
                      </span>
                    </>
                  )}
                  {isV1Maintenance && isV2Maintenance && (
                    <span className="text-red-400">Lib Bypass Service is Under Maintenance</span>
                  )}
                </h4>
                <p className="text-xs text-[#ffd1dc]/80 mt-1 font-medium">
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
                    ? "border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(255,31,90,0.2)]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
                )}
              >
                <span className="text-red-400">⚡ V1:</span>
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
                    ? "border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(255,31,90,0.2)]"
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
