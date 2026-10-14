"use client";

import { useState } from "react";
import { LiveDevices } from "@/components/devices/LiveDevices";
import { BanIcon, RefreshIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

export default function DevicesPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const count = useDashboard((s) => s.db.cheatExeDevices.length);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await del("/api/devices");
      await refresh();
      toast("Active device list cleared.", "success");
      setShowConfirm(false);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleClear}
        title="Clear Connected Devices"
        description="Are you sure you want to kick and disconnect every active session except your own current device?"
        confirmText="Clear Sessions"
        confirmVariant="danger"
        loading={clearing}
      />

      <Card flat>
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              Connected Devices Live Monitor
              <Badge tone="green">{count} Online</Badge>
            </span>
          }
          subtitle="Real-time active sessions connected with your credentials across all devices & browsers."
          actions={
            <>
              <TintButton
                tone="green"
                onClick={async () => {
                  await refresh();
                  toast("Active devices refreshed.", "success");
                }}
              >
                <RefreshIcon className="size-3" />
                Refresh Live
              </TintButton>
              <TintButton tone="red" onClick={() => setShowConfirm(true)}>
                <BanIcon className="size-3" strokeWidth={2} />
                Clear Live
              </TintButton>
            </>
          }
        />
        <LiveDevices />
      </Card>
    </>
  );
}
