"use client";

import { BanIcon } from "@/components/icons";
import { SmallButton } from "@/components/ui/buttons";
import { RoleBadge } from "@/components/ui/Badge";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

const OVERVIEW_COLUMNS = ["STATUS", "USER ACCOUNT", "DEVICE & BROWSER", "IP ADDRESS", "LOGGED IN", "ACTION"];
const FULL_COLUMNS = [
  "STATUS",
  "USER ACCOUNT",
  "ROLE",
  "DEVICE / BROWSER",
  "IP ADDRESS",
  "LOGIN TIME",
  "ACTIONS",
];

export function DevicesTable({ variant }: { variant: "overview" | "full" }) {
  const toast = useToast();
  const devices = useDashboard((s) => s.db.cheatExeDevices);
  const user = useDashboard((s) => s.user);
  const refresh = useDashboard((s) => s.refresh);

  const isOverview = variant === "overview";
  const columns = isOverview ? OVERVIEW_COLUMNS : FULL_COLUMNS;

  const kick = async (sessionId: string, name: string) => {
    if (!confirm(`Kick and ban the session for ${name}?`)) return;
    try {
      await del(`/api/devices/${encodeURIComponent(sessionId)}`);
      toast(`Device session for user '${name}' has been kicked!`, "success");
      await refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <DataTable columns={columns} dense>
      {devices.length === 0 ? (
        <EmptyRow colSpan={columns.length}>No active sessions.</EmptyRow>
      ) : (
        devices.map((device) => {
          const isCurrent = device.sessionId === user?.sessionId;
          const cleanUser = device.user.split(" ")[0] ?? device.user;
          const role = device.user.includes("OWNER") ? "OWNER" : "RESELLER";

          return (
            <Row key={device.sessionId}>
              <Cell dense>
                <span
                  className={
                    isCurrent
                      ? "rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] px-2 py-[3px] text-[10px] font-bold text-[#34d399]"
                      : "rounded-xl border border-[rgba(16,185,129,0.1)] bg-[rgba(16,185,129,0.05)] px-2 py-[3px] text-[10px] font-bold text-[#10b981]"
                  }
                >
                  &#9679; ONLINE{isCurrent ? " (This Device)" : ""}
                </span>
              </Cell>

              <Cell dense className="font-semibold text-fg">
                {isOverview ? `${cleanUser} (${role})` : cleanUser}
              </Cell>

              {!isOverview && (
                <Cell dense>
                  <RoleBadge role={role} />
                </Cell>
              )}

              <Cell dense>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/2 px-3 py-1.5 text-[12.5px] text-fg shadow-[0_2px_8px_rgba(0,0,0,0.2)] lt:bg-slate-100">
                  <span className="text-[12px]">&#128187;</span>
                  {device.device}
                </span>
              </Cell>

              <Cell dense className="font-mono text-[#94a3b8]">
                {device.ip}
              </Cell>

              <Cell dense className="text-[#94a3b8]">
                {device.timestamp}
              </Cell>

              <Cell dense>
                {isCurrent ? (
                  <span className="text-[12px] font-semibold text-[#60a5fa]">
                    {isOverview ? "Active" : "Current Device"}
                  </span>
                ) : (
                  <SmallButton tone="danger" onClick={() => kick(device.sessionId, cleanUser)}>
                    <BanIcon className="size-2.5" />
                    Kick
                  </SmallButton>
                )}
              </Cell>
            </Row>
          );
        })
      )}
    </DataTable>
  );
}
