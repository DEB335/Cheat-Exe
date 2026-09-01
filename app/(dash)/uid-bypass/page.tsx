"use client";

import { useMemo } from "react";

import {
  CheckCircleIcon,
  CpuChipIcon,
  LockIcon,
  RefreshIcon,
  XSquareIcon,
} from "@/components/icons";
import { RoleBadge } from "@/components/ui/Badge";
import { TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { UID_BYPASS_PACKAGE } from "@/lib/packages";
import { useDashboard } from "@/lib/store";
import { useStoredFlag } from "@/lib/use-external";
import { cn } from "@/lib/utils";

import { isExpired, useWhitelist } from "./use-whitelist";

const AUTO_KEY = "uidBypassAutoRefresh";

export default function UidBypassOverviewPage() {
  const [auto] = useStoredFlag(AUTO_KEY);
  const { entries, loading, error, reload } = useWhitelist(auto);

  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);

  const expired = useMemo(() => entries.filter(isExpired).length, [entries]);
  const active = entries.length - expired;
  const activeShare = entries.length === 0 ? 0 : Math.round((active / entries.length) * 100);

  // The row for this very session carries the address and platform the
  // panel saw at sign-in, which is exactly what the provider's own
  // overview reports. No second source needed.
  const session = db.cheatExeDevices.find((device) => device.sessionId === user?.sessionId);

  const accountExpiry =
    user && user.role === "RESELLER"
      ? (db.cheatExeUsers[user.username]?.expiresAt ?? "Never")
      : "Never";

  const bySync = useMemo(() => {
    let api = 0;
    let bot = 0;
    for (const entry of entries) {
      if (entry.sync === "external") api += 1;
      else bot += 1;
    }
    return { api, bot };
  }, [entries]);

  return (
    <>
      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        <StatCard
          accent="cyan"
          icon={<CpuChipIcon className="size-5" />}
          value={loading ? "…" : entries.length}
          label="Whitelisted UIDs"
        />
        <StatCard
          accent="green"
          icon={<CheckCircleIcon className="size-5" />}
          value={loading ? "…" : active}
          label="Active"
        />
        <StatCard
          accent="red"
          icon={<XSquareIcon className="size-5" />}
          value={loading ? "…" : expired}
          label="Expired"
        />
        <StatCard
          accent="orange"
          icon={<LockIcon className="size-5" />}
          value={user ? <RoleBadge role={user.role} /> : "—"}
          label="Account Role"
        />
      </div>

      <div className="grid gap-[30px] lg:grid-cols-2">
        <Card flat>
          <CardHeader title="Account Information" subtitle="How this session reaches the service." />

          <dl className="flex flex-col gap-2.5">
            <InfoRow label="Registered IP" value={session?.ip ?? "—"} mono />
            <InfoRow label="Browser / Platform" value={session?.device ?? "—"} />
            <InfoRow label="Account Expiry" value={accountExpiry} mono={accountExpiry !== "Never"} />
            <InfoRow
              label="Package Access"
              value={UID_BYPASS_PACKAGE}
              tone={user?.role === "OWNER" ? "blue" : "green"}
            />
          </dl>
        </Card>

        <Card flat>
          <CardHeader
            title="Whitelist Usage"
            subtitle="Live counts read straight from the provider."
            actions={
              <TintButton tone="green" onClick={() => void reload()}>
                <RefreshIcon className="size-[13px]" />
                Refresh
              </TintButton>
            }
          />

          <div className="mb-2 flex items-baseline gap-3">
            <span className="font-display text-[40px] leading-none font-extrabold text-fg">
              {loading ? "—" : `${activeShare}%`}
            </span>
            <span className="text-[11px] font-bold tracking-[1px] text-muted uppercase">
              Still Active
            </span>
          </div>

          <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)] transition-[width] duration-700 ease-smooth"
              style={{ width: `${activeShare}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MiniTile label="Active" value={loading ? "—" : active} dot="#22d3ee" />
            <MiniTile label="Expired" value={loading ? "—" : expired} dot="#a855f7" />
            <MiniTile
              label="Sync Platform"
              value={
                <span className="text-[13px]">
                  <span className="text-[#60a5fa]">API: {bySync.api}</span>{" "}
                  <span className="text-muted">Bot: {bySync.bot}</span>
                </span>
              }
            />
            <MiniTile
              label="Engine Sync"
              value={
                <span className={error ? "text-[#f87171]" : "text-[#34d399]"}>
                  {error ? "UNREACHABLE" : "STABLE"}
                </span>
              }
              dot={error ? "#ef4444" : "#10b981"}
            />
          </div>

          {error && <p className="mt-4 text-[12px] leading-relaxed text-[#f87171]">{error}</p>}
        </Card>
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "green" | "blue";
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/2 px-5 py-3.5">
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd
        className={cn(
          "truncate text-[13px] font-semibold",
          mono && "font-mono",
          tone === "green" && "text-[#34d399]",
          tone === "blue" && "text-[#60a5fa]",
          !tone && "text-fg",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function MiniTile({
  label,
  value,
  dot,
}: {
  label: string;
  value: React.ReactNode;
  dot?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/2 px-4 py-3.5">
      <div className="mb-1.5 text-[10px] font-bold tracking-[1px] text-muted uppercase">{label}</div>
      <div className="flex items-center gap-2 font-display text-[18px] leading-none font-extrabold text-fg">
        {dot && (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
          />
        )}
        {value}
      </div>
    </div>
  );
}
