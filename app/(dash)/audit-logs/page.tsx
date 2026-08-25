"use client";

import { RefreshIcon, TrashIcon } from "@/components/icons";
import { TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

const COLUMNS = ["Timestamp", "User", "Action", "IP Address"];

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
    <Card flat>
      <CardHeader
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
              <RefreshIcon className="size-[13px]" />
              Refresh Logs
            </TintButton>
            {isOwner && (
              <TintButton tone="red" onClick={clear}>
                <TrashIcon className="size-[13px]" strokeWidth={2.5} />
                Clear Logs
              </TintButton>
            )}
          </>
        }
      />

      <DataTable columns={COLUMNS} dense>
        {logs.length === 0 ? (
          <EmptyRow colSpan={COLUMNS.length}>No logs available.</EmptyRow>
        ) : (
          logs.map((log, index) => (
            <Row key={`${log.timestamp}-${index}`}>
              <Cell dense>{log.timestamp}</Cell>
              <Cell dense className="font-semibold text-fg">
                {log.user}
              </Cell>
              <Cell dense>{log.action}</Cell>
              <Cell dense className="font-mono text-[#94a3b8]">
                {log.ip || "127.0.0.1"}
              </Cell>
            </Row>
          ))
        )}
      </DataTable>
    </Card>
  );
}
