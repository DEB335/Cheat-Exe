"use client";

import { useMemo, useState } from "react";

import { CheckIcon, CopyIcon, RefreshIcon, SearchIcon, TrashIcon, XSquareIcon } from "@/components/icons";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { IconButton, SmallButton, TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

const COLUMNS = [
  "STATUS",
  "USER ACCOUNT",
  "PASSWORD (VAULT)",
  "ROLE & PACKAGES",
  "IP / DEVICE",
  "KICKED TIME",
  "ACTIONS",
];

export default function BannedVaultPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const banned = useDashboard((s) => s.db.cheatExeBannedUsers);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banned;
    return banned.filter(
      (b) =>
        b.username.toLowerCase().includes(q) ||
        b.ip.toLowerCase().includes(q) ||
        b.device.toLowerCase().includes(q),
    );
  }, [banned, query]);

  const act = async (username: string, restore: boolean) => {
    const label = restore ? "Unban and restore" : "Delete the vault record for";
    if (!confirm(`${label} ${username}?`)) return;
    try {
      await del(`/api/banned/${encodeURIComponent(username)}${restore ? "?restore=1" : ""}`);
      await refresh();
      toast(restore ? `${username} restored.` : `Record for ${username} deleted.`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear the entire vault?")) return;
    try {
      await del("/api/banned");
      await refresh();
      toast("Vault cleared.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <Card flat>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Kicked / Banned Users Vault
            <Badge tone="red">
              {banned.length} Banned User{banned.length === 1 ? "" : "s"}
            </Badge>
          </span>
        }
        subtitle="Accounts kicked from a session are suspended and listed here. Unban restores full access."
        actions={
          <>
            <div className="glow-ring hover:glow-ring-fast relative hidden items-center rounded-lg sm:flex">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 z-[2] size-3 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search user/IP..."
                className="w-[100px] rounded-lg border border-line bg-white/2 py-1.5 pr-2.5 pl-7 text-[12px] text-fg outline-none transition-all duration-300 ease-smooth hover:w-[200px] focus:w-[200px] focus:border-white/15"
              />
            </div>
            <TintButton
              tone="green"
              onClick={async () => {
                await refresh();
                toast("Vault refreshed.", "success");
              }}
            >
              <RefreshIcon className="size-2.5" />
              Refresh Vault
            </TintButton>
            <TintButton tone="red" onClick={clearAll}>
              <XSquareIcon className="size-2.5" />
              Clear Vault
            </TintButton>
          </>
        }
      />

      <DataTable columns={COLUMNS} dense>
        {filtered.length === 0 ? (
          <EmptyRow colSpan={COLUMNS.length}>No banned records found.</EmptyRow>
        ) : (
          filtered.map((record, index) => (
            <Row key={`${record.username}-${index}`}>
              <Cell dense>
                <span className="rounded-xl border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.1)] px-2 py-[3px] text-[10px] font-bold text-[#f87171]">
                  &#9679; KICKED / BANNED
                </span>
              </Cell>

              <Cell dense className="font-semibold text-fg">
                {record.username}
              </Cell>

              <Cell dense>
                {/* Passwords are bcrypt hashes now, so there is nothing
                    plaintext to reveal. Use Pass on the reseller row to set
                    a new one. */}
                <span
                  title="Passwords are hashed and cannot be recovered. Set a new one from the Reseller page."
                  className="inline-flex w-max items-center gap-1.5 rounded-md border border-line bg-white/2 px-2 py-1"
                >
                  <span className="font-mono text-[13px] text-muted">not recoverable</span>
                </span>
              </Cell>

              <Cell dense>
                <div>
                  <RoleBadge role={record.role} />
                </div>
                <div className="mt-0.5 text-[10px] text-[#64748b]">
                  {record.packages.length > 0 ? record.packages.join(", ") : "NONE"}
                </div>
              </Cell>

              <Cell dense>
                <div className="font-mono font-semibold text-fg">{record.ip}</div>
                <div className="mt-0.5 text-[10px] text-[#64748b]">{record.device}</div>
              </Cell>

              <Cell dense className="text-[#94a3b8]">
                {record.kickedTime}
              </Cell>

              <Cell dense>
                <div className="flex items-center gap-1.5">
                  <SmallButton tone="success" onClick={() => act(record.username, true)}>
                    <CheckIcon className="size-3" />
                    Unban / Restore
                  </SmallButton>

                  <IconButton
                    title="Copy username"
                    onClick={async () => {
                      await navigator.clipboard.writeText(record.username);
                      toast("Username copied!", "success");
                    }}
                    className="rounded-md border border-line bg-white/2 p-1.5"
                  >
                    <CopyIcon className="size-3.5" />
                  </IconButton>

                  <IconButton
                    title="Delete record"
                    onClick={() => act(record.username, false)}
                    className="rounded-md border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.05)] p-1.5 text-[#ef4444] hover:text-[#f87171]"
                  >
                    <TrashIcon className="size-3.5" />
                  </IconButton>
                </div>
              </Cell>
            </Row>
          ))
        )}
      </DataTable>
    </Card>
  );
}
