"use client";

import { useState } from "react";
import { AuditStats } from "@/components/audit-logs/AuditStats";
import { AuditTable } from "@/components/audit-logs/AuditTable";
import { RefreshIcon, TrashIcon } from "@/components/icons";
import { NeonPanel, PanelHeader } from "@/components/neon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { TintButton } from "@/components/ui/buttons";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

export default function AuditLogsPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const logs = useDashboard((s) => s.db.cheatExeAuditLogs);
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleConfirmClear = async () => {
    try {
      await del("/api/audit");
      await refresh();
      toast("Audit logs cleared.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <>
      <NeonPanel rim="danger" className="overflow-hidden">
        <div className="relative z-[1] mb-6">
        <PanelHeader
          title="System Audit Logs"
          subtitle="Complete history of system and user actions."
          actions={
            <>
              <TintButton
                tone="green"
                onClick={async () => {
                  await refresh();
                  toast("Audit logs refreshed.", "success");
                }}
              >
                <RefreshIcon className="size-3" />
                Refresh Logs
              </TintButton>
              {isOwner && (
                <TintButton
                  tone="red"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <TrashIcon className="size-3" strokeWidth={2} />
                  Clear Logs
                </TintButton>
              )}
            </>
          }
        />
        <AuditStats
          logs={logs}
          className="grid-cols-2 lg:grid-cols-4"
        />
      </div>

      <AuditTable logs={logs} />
    </NeonPanel>

    <ConfirmDialog
      isOpen={confirmClearOpen}
      title="Clear All Audit Logs"
      description="Are you sure you want to permanently delete all recorded audit activities and system event logs? This cannot be recovered."
      confirmText="Clear Logs"
      cancelText="Cancel"
      variant="danger"
      onConfirm={handleConfirmClear}
      onCancel={() => setConfirmClearOpen(false)}
    />
  </>
);
}
