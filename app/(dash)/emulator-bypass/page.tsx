"use client";

import { GamepadIcon } from "@/components/icons";
import { MaintenanceNotice } from "@/components/ui/MaintenanceNotice";
import { useDashboard } from "@/lib/store";
import { LibBypassGeneratorPanel } from "@/components/emulator-bypass/LibBypassGeneratorPanel";
import { ActiveLibBypassTable } from "@/components/emulator-bypass/ActiveLibBypassTable";

export default function EmulatorBypassPage() {
  const db = useDashboard((s) => s.db);
  const isMaintenance = Boolean(db.emulatorBypassMaintenance?.active);
  const maintenanceReason = db.emulatorBypassMaintenance?.reason;

  return (
    <div className="space-y-8 pb-10">
      {/* Maintenance Notice if active */}
      {isMaintenance && (
        <MaintenanceNotice
          title="Emulator Bypass is under maintenance"
          description="The Emulator Bypass service is undergoing updates and maintenance. Key generation is temporarily paused until it is back. Existing keys keep working."
          serviceName="Emulator Bypass"
          tone="pink"
          icon={<GamepadIcon className="size-7" />}
          reason={maintenanceReason}
        />
      )}

      {/* 1. Generator Panel (At the top, directly on the page) */}
      <LibBypassGeneratorPanel />

      {/* 2. Active Lib Bypass Keys Table (Directly below the generator) */}
      <ActiveLibBypassTable />
    </div>
  );
}
