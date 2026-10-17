"use client";

import { ClockIcon, ShieldCheckIcon, UserIcon } from "@/components/icons";
import { AlertTriangleIcon } from "@/components/neon";
import { StatCard } from "@/components/ui/StatCard";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils";

import { auditStats } from "./derive";
import { useMinute } from "./useMinute";

/**
 * The four stats over the audit log, styled with StatCard matching Owner Key History.
 */
export function AuditStats({ logs, className }: { logs: AuditLog[]; className?: string }) {
  const now = useMinute();
  const stats = auditStats(logs, now);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <StatCard
        accent="red"
        icon={<UserIcon className="size-6" />}
        label="TOTAL EVENTS"
        value={stats.total}
      />
      <StatCard
        accent="red"
        icon={<ShieldCheckIcon className="size-6" />}
        label="SUCCESSFUL"
        value={stats.success}
      />
      <StatCard
        accent="red"
        icon={<AlertTriangleIcon className="size-6" />}
        label="FAILED"
        value={stats.failed}
      />
      <StatCard
        accent="red"
        icon={<ClockIcon className="size-6" />}
        label="LAST 24 HOURS"
        value={stats.lastDay ?? 0}
      />
    </div>
  );
}
