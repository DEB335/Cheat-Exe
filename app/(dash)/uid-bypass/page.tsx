"use client";

import { useMemo } from "react";

import {
  CheckCircleIcon,
  CpuChipIcon,
  GamepadIcon,
  KeyIcon,
  LockIcon,
  RefreshIcon,
  XSquareIcon,
} from "@/components/icons";
import { RoleBadge } from "@/components/ui/Badge";
import { TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { MaintenanceNotice } from "@/components/ui/MaintenanceNotice";
import { StatCard } from "@/components/ui/StatCard";
import { UID_BYPASS_PACKAGE } from "@/lib/packages";
import { useDashboard } from "@/lib/store";
import { useStoredFlag } from "@/lib/use-external";
import { cn } from "@/lib/utils";
import { daysLeft as accountDaysLeft, formatExpiry } from "@/lib/reseller";

import { isExpired, useWhitelist } from "./use-whitelist";

const AUTO_KEY = "uidBypassAutoRefresh";

export default function UidBypassOverviewPage() {
  const [auto] = useStoredFlag(AUTO_KEY);
  const { entries, loading, maintenance, reason, reload } = useWhitelist(auto);

  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);

  const expired = useMemo(() => entries.filter(isExpired).length, [entries]);
  const active = entries.length - expired;
  const activeShare = entries.length === 0 ? 0 : Math.round((active / entries.length) * 100);

  const session = db.cheatExeDevices.find((device) => device.sessionId === user?.sessionId);

  const accountExpiry = useMemo(() => {
    if (!user || user.role === "OWNER") return "Never (Permanent)";
    const record = db.cheatExeUsers[user.username];
    if (!record || !record.expiresAt) return "Never (Permanent)";
    const left = accountDaysLeft(record);
    const dateStr = formatExpiry(record);
    if (left === null) return "Never";
    if (left <= 0) return `${dateStr} (Expired)`;
    return `${dateStr} (${left} day${left === 1 ? "" : "s"} left)`;
  }, [user, db.cheatExeUsers]);

  // Region, not sync platform. The whitelist's move onto the admin API
  // took `sync_target` with it, so a tile reading that field would say
  // "Bot: everything" forever. Region is what became real in the same
  // move, and it is the figure worth watching: a customer whitelisted on
  // the wrong server is a spent credit.
  const byRegion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.region, (counts.get(entry.region) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const isOwner = user?.role === "OWNER";
  const showEmulatorStats = isOwner || Boolean(user?.emulatorBypassAccess);

  const emulatorKeysCount = useMemo(() => {
    if (!showEmulatorStats) return 0;
    if (isOwner) {
      return db.cheatExeKeyHistory.filter((k) => k.package === "EMULATOR BYPASS").length;
    }
    if (!user) return 0;
    return db.cheatExeKeyHistory.filter(
      (k) =>
        k.package === "EMULATOR BYPASS" &&
        k.creator.toLowerCase() === user.username.toLowerCase(),
    ).length;
  }, [showEmulatorStats, isOwner, db.cheatExeKeyHistory, user]);

  const emulatorCreditsDisplay = useMemo(() => {
    if (!showEmulatorStats) return 0;
    if (isOwner) return "Unlimited";
    if (!user) return 0;
    const record = Object.entries(db.cheatExeUsers).find(
      ([name]) => name.toLowerCase() === user.username.toLowerCase(),
    )?.[1];
    const totalCredits = record?.emulatorCredits ?? user.emulatorCredits ?? 0;
    if (totalCredits <= 0) return "Unlimited";
    const used = db.cheatExeKeyHistory.filter(
      (k) =>
        k.package === "EMULATOR BYPASS" &&
        k.creator.toLowerCase() === user.username.toLowerCase(),
    ).length;
    return Math.max(0, totalCredits - used);
  }, [showEmulatorStats, isOwner, db.cheatExeUsers, db.cheatExeKeyHistory, user]);

  const myEmulatorKeys = useMemo(() => {
    if (isOwner) {
      return db.cheatExeKeyHistory.filter((k) => k.package === "EMULATOR BYPASS");
    }
    if (!user) return [];
    return db.cheatExeKeyHistory.filter(
      (k) =>
        k.package === "EMULATOR BYPASS" &&
        k.creator.toLowerCase() === user.username.toLowerCase(),
    );
  }, [isOwner, db.cheatExeKeyHistory, user]);

  const { activeEmulatorKeys, expiredEmulatorKeys } = useMemo(() => {
    let act = 0;
    let exp = 0;
    const now = Date.now();
    for (const k of myEmulatorKeys) {
      const days = k.appliedDays ?? Number(k.duration) ?? 0;
      if (days <= 0) {
        act++;
        continue;
      }
      const parsedDate = Date.parse(k.date);
      if (Number.isFinite(parsedDate)) {
        const expiryMs = parsedDate + days * 86_400_000;
        if (now > expiryMs) {
          exp++;
        } else {
          act++;
        }
      } else {
        act++;
      }
    }
    return { activeEmulatorKeys: act, expiredEmulatorKeys: exp };
  }, [myEmulatorKeys]);

  const emulatorActiveShare = useMemo(() => {
    const total = myEmulatorKeys.length;
    if (total === 0) return 100;
    return Math.round((activeEmulatorKeys / total) * 100);
  }, [myEmulatorKeys.length, activeEmulatorKeys]);

  const uidMaintenance = maintenance;
  const uidReason = reason;
  const emulatorMaintenance = Boolean(db.emulatorBypassMaintenance?.active);
  const emulatorReason = db.emulatorBypassMaintenance?.reason;
  const bothUnderMaintenance = uidMaintenance && emulatorMaintenance;

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
        {showEmulatorStats && (
          <>
            <StatCard
              accent="purple"
              icon={<GamepadIcon className="size-5" />}
              value={emulatorKeysCount}
              label="Emulator Bypass Keys"
            />
            <StatCard
              accent="cyan"
              icon={<KeyIcon className="size-5" />}
              value={emulatorCreditsDisplay}
              label="Emulator Bypass Credits"
            />
          </>
        )}
        <StatCard
          accent="orange"
          icon={<LockIcon className="size-5" />}
          value={user ? <RoleBadge role={user.role} /> : "—"}
          label="Account Role"
        />
      </div>

      {/* Maintenance Notices */}
      {(() => {
        if (bothUnderMaintenance) {
          return (
            <div className="mb-[30px] grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MaintenanceNotice
                title="UID Bypass is under maintenance"
                serviceName="UID Bypass"
                tone="orange"
                compact
                reason={uidReason}
              />
              <MaintenanceNotice
                title="Emulator Bypass is under maintenance"
                description="The Emulator Bypass service is undergoing updates and maintenance. Key generation is temporarily paused until it is back. Existing keys keep working."
                serviceName="Emulator Bypass"
                tone="pink"
                icon={<GamepadIcon className="size-7" />}
                compact
                reason={emulatorReason}
              />
            </div>
          );
        }

        if (uidMaintenance) {
          return (
            <div className="mb-[30px]">
              <MaintenanceNotice
                title="UID Bypass is under maintenance"
                serviceName="UID Bypass"
                tone="orange"
                reason={uidReason}
              />
            </div>
          );
        }

        if (emulatorMaintenance) {
          return (
            <div className="mb-[30px]">
              <MaintenanceNotice
                title="Emulator Bypass is under maintenance"
                description="The Emulator Bypass service is undergoing updates and maintenance. Key generation is temporarily paused until it is back. Existing keys keep working."
                serviceName="Emulator Bypass"
                tone="pink"
                icon={<GamepadIcon className="size-7" />}
                reason={emulatorReason}
              />
            </div>
          );
        }

        return null;
      })()}

      <div
        className={cn(
          "grid gap-[30px]",
          showEmulatorStats && !maintenance && !emulatorMaintenance
            ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
            : (!maintenance || (showEmulatorStats && !emulatorMaintenance))
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1",
        )}
      >
        <Card flat>
          <CardHeader title="Account Information" subtitle="How this session reaches the service." />

          <dl className="flex flex-col gap-2.5">
            <InfoRow label="Registered IP" value={session?.ip ?? "—"} mono />
            <InfoRow label="Browser / Platform" value={session?.device ?? "—"} />
            <InfoRow
              label="Account Expiry"
              value={accountExpiry}
              mono={!accountExpiry.startsWith("Never")}
            />
            <InfoRow
              label="Package Access"
              value={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="rounded-md border border-[rgba(14,165,233,0.3)] bg-[rgba(14,165,233,0.1)] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#38bdf8] uppercase">
                    UID BYPASS
                  </span>
                  {showEmulatorStats && (
                    <span className="rounded-md border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.1)] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#f472b6] uppercase">
                      EMULATOR BYPASS
                    </span>
                  )}
                </div>
              }
            />
          </dl>
        </Card>

        {!maintenance && (
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
                label="Regions"
                value={
                  byRegion.length === 0 ? (
                    "—"
                  ) : (
                    <span className="text-[13px]">
                      <span className="text-[#60a5fa]">
                        {byRegion[0][0]}: {byRegion[0][1]}
                      </span>
                      {byRegion.length > 1 && (
                        <span className="text-muted"> +{byRegion.length - 1} more</span>
                      )}
                    </span>
                  )
                }
              />
              <MiniTile
                label="Engine Sync"
                value={<span className="text-[#34d399]">STABLE</span>}
                dot="#10b981"
              />
            </div>
          </Card>
        )}

        {showEmulatorStats && !emulatorMaintenance && (
          <Card flat>
            <CardHeader
              title="Emulator Bypass Usage"
              subtitle="Live key generation and engine metrics."
              actions={
                <TintButton tone="green" onClick={() => void reload()}>
                  <RefreshIcon className="size-[13px]" />
                  Refresh
                </TintButton>
              }
            />

            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-display text-[40px] leading-none font-extrabold text-fg">
                {emulatorActiveShare}%
              </span>
              <span className="text-[11px] font-bold tracking-[1px] text-muted uppercase">
                Still Active
              </span>
            </div>

            <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ec4899,#8b5cf6)] transition-[width] duration-700 ease-smooth"
                style={{ width: `${emulatorActiveShare}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MiniTile label="Active" value={activeEmulatorKeys} dot="#ec4899" />
              <MiniTile label="Expired" value={expiredEmulatorKeys} dot="#a855f7" />
              <MiniTile
                label="Bypass Core"
                value={<span className="text-[13px] font-bold text-[#ec4899]">V1 & V2 HYBRID</span>}
              />
              <MiniTile
                label="Engine Sync"
                value={<span className="text-[#34d399]">STABLE</span>}
                dot="#10b981"
              />
            </div>
          </Card>
        )}
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
  value: React.ReactNode;
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
        title={typeof value === "string" ? value : undefined}
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
            style={{ background: dot, boxShadow: `0 0 4px color-mix(in srgb, ${dot} 45%, transparent)` }}
          />
        )}
        {value}
      </div>
    </div>
  );
}
