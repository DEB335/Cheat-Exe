"use client";

import { useMemo, useState } from "react";

import {
  CheckIcon,
  CopyIcon,
  CpuChipIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  WifiOffIcon,
  XSquareIcon,
} from "@/components/icons";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { IconButton, SmallButton, TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/form";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del, postJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";
import type { BanScope } from "@/lib/types";

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
    <>
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

      <BlockedDevices />
    </>
  );
}

const BLOCK_COLUMNS = ["TYPE", "VALUE", "RAISED FROM", "REASON", "ADDED", "ACTIONS"];

const SCOPE_META: Record<BanScope, { label: string; icon: typeof WifiOffIcon; hint: string }> = {
  ip: {
    label: "IP",
    icon: WifiOffIcon,
    hint: "Blocks the address. Home connections change theirs, so this ages out.",
  },
  hwid: {
    label: "HWID",
    icon: CpuChipIcon,
    hint: "Blocks the browser device id. Survives a new account, not cleared site data.",
  },
  fingerprint: {
    label: "SIGNATURE",
    icon: CpuChipIcon,
    hint: "Blocks the device signature. Survives cleared cookies, but is coarser.",
  },
};

/**
 * Blocks that sit in front of the password check.
 *
 * The vault above bans *accounts*: the person just makes another one.
 * These rules turn away the connection itself, so a blocked address or
 * machine cannot sign in to anything, and every open session it holds is
 * closed the moment the rule lands.
 */
function BlockedDevices() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const bans = useDashboard((s) => s.db.cheatExeBans);

  const [scope, setScope] = useState<BanScope>("ip");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!value.trim()) {
      toast("Enter a value to block.", "error");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/bans", {
        rules: [{ scope, value: value.trim() }],
        reason: reason.trim() || undefined,
      });
      setValue("");
      setReason("");
      await refresh();
      toast(`${SCOPE_META[scope].label} blocked.`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const lift = async (rule: { scope: BanScope; value: string }) => {
    if (!confirm(`Lift the block on ${rule.value}?`)) return;
    try {
      await del(`/api/bans?scope=${rule.scope}&value=${encodeURIComponent(rule.value)}`);
      await refresh();
      toast("Block lifted.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <Card flat className="mt-6">
      <CardHeader
        title="Blocked Devices & Networks"
        subtitle="Checked before any password. A blocked device reaches no account at all."
      />

      <div className="mb-5 flex flex-wrap items-end gap-2.5">
        <div className="flex gap-1.5">
          {(Object.keys(SCOPE_META) as BanScope[]).map((key) => (
            <button
              key={key}
              type="button"
              title={SCOPE_META[key].hint}
              onClick={() => setScope(key)}
              className={
                scope === key
                  ? "rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.12)] px-3 py-2 text-[11.5px] font-bold text-[#f87171]"
                  : "rounded-lg border border-line bg-white/2 px-3 py-2 text-[11.5px] font-bold text-muted transition-colors hover:text-fg"
              }
            >
              {SCOPE_META[key].label}
            </button>
          ))}
        </div>

        <div className="min-w-[180px] flex-1">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={scope === "ip" ? "203.0.113.7" : "Device id from the vault row"}
          />
        </div>

        <div className="min-w-[160px] flex-1">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional)"
          />
        </div>

        <SmallButton tone="danger" disabled={busy} onClick={add}>
          <XSquareIcon className="size-3" />
          Block
        </SmallButton>
      </div>

      <DataTable columns={BLOCK_COLUMNS} dense>
        {bans.length === 0 ? (
          <EmptyRow colSpan={BLOCK_COLUMNS.length}>
            Nothing is blocked. Use Ban IP or Ban HWID on the Active Devices page, or add one above.
          </EmptyRow>
        ) : (
          bans.map((rule) => {
            const meta = SCOPE_META[rule.scope];
            const Icon = meta.icon;
            return (
              <Row key={`${rule.scope}:${rule.value}`}>
                <Cell dense>
                  <span
                    title={meta.hint}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-2 py-[3px] text-[10px] font-bold text-[#f87171]"
                  >
                    <Icon className="size-2.5" />
                    {meta.label}
                  </span>
                </Cell>

                <Cell dense className="max-w-[220px] truncate font-mono text-[12px] text-fg">
                  {rule.value}
                </Cell>

                <Cell dense className="text-[#94a3b8]">
                  {rule.user ?? "\u2014"}
                </Cell>

                <Cell dense className="max-w-[200px] truncate text-[#94a3b8]">
                  {rule.reason}
                </Cell>

                <Cell dense className="text-[#94a3b8]">
                  {rule.at}
                </Cell>

                <Cell dense>
                  <SmallButton tone="success" onClick={() => lift(rule)}>
                    <CheckIcon className="size-3" />
                    Lift
                  </SmallButton>
                </Cell>
              </Row>
            );
          })
        )}
      </DataTable>
    </Card>
  );
}
