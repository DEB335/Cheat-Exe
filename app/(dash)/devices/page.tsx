"use client";

import { BanIcon, RefreshIcon } from "@/components/icons";
import { DevicesTable } from "@/components/tables/DevicesTable";
import { Badge } from "@/components/ui/Badge";
import { TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

export default function DevicesPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const count = useDashboard((s) => s.db.cheatExeDevices.length);

  const clear = async () => {
    if (!confirm("Clear every session except your own?")) return;
    try {
      await del("/api/devices");
      await refresh();
      toast("Active device list cleared.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
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
            <TintButton tone="red" onClick={clear}>
              <BanIcon className="size-3" strokeWidth={2} />
              Clear Live
            </TintButton>
          </>
        }
      />
      <DevicesTable variant="full" />
    </Card>
  );
}
