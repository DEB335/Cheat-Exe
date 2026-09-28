"use client";

import { AuditStats } from "@/components/audit-logs/AuditStats";
import { AuditTable } from "@/components/audit-logs/AuditTable";
import { FileTextIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { NeonButton, NeonPanel, PanelHeader } from "@/components/neon";
import { AuditScene } from "@/components/scenes/AuditScene";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

export default function AuditLogsPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const logs = useDashboard((s) => s.db.cheatExeAuditLogs);
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  const clear = async () => {
    if (!confirm("Clear all audit logs?")) return;
    try {
      await del("/api/audit");
      await refresh();
      toast("Audit logs cleared.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <NeonPanel rim="aurora" className="overflow-hidden">
      {/* The hologram takes the room the stats leave on the right: below
          the header buttons, a little smaller, while the stats are two
          by two, and beside the buttons at full size once a window is
          wide enough (104rem, about 1660 real px) for all four stats on
          one row, as in the mockup. The min-height then keeps the table
          clear of its platform, and the stats drop level with the tower
          so that spare height is not all left under them. Below lg the
          stats need the full width, so it is not drawn at all.
          Breakpoints in rem so Tailwind orders them after lg. */}
      <AuditScene className="pointer-events-none absolute top-[92px] right-4 hidden h-[264px] w-[405px] lg:block min-[104rem]:top-0 min-[104rem]:right-[300px] min-[104rem]:h-[300px] min-[104rem]:w-[460px]" />

      <div className="relative z-[1] mb-6 min-[104rem]:min-h-[244px]">
        <PanelHeader
          icon={<FileTextIcon />}
          iconTone="violet"
          iconTone2="blue"
          title="System Audit Logs"
          subtitle="Complete history of system and user actions."
          actions={
            <>
              <NeonButton
                tone="teal"
                icon={<RefreshIcon />}
                onClick={async () => {
                  await refresh();
                  toast("Audit logs refreshed.", "success");
                }}
              >
                Refresh Logs
              </NeonButton>
              {isOwner && (
                <NeonButton tone="red" icon={<TrashIcon strokeWidth={2.5} />} onClick={clear}>
                  Clear Logs
                </NeonButton>
              )}
            </>
          }
        />
        <AuditStats
          logs={logs}
          className="lg:mr-[425px] min-[104rem]:mr-[744px] min-[104rem]:pt-9 min-[104rem]:grid-cols-4"
        />
      </div>

      <AuditTable logs={logs} />
    </NeonPanel>
  );
}
