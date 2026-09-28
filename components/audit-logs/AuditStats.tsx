"use client";

import { ClockIcon, ShieldCheckIcon, UserIcon } from "@/components/icons";
import { AlertTriangleIcon, NeonStat } from "@/components/neon";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils";

import { auditStats, shareOf } from "./derive";
import { useMinute } from "./useMinute";

/**
 * The four tiles over the log. Every figure is counted from the log the
 * store holds (the server keeps the newest 100), with success and
 * failure decided by the same rule that colours each row's pill. The
 * mockup's trend chip on "Last 24 Hours" is left out: the log is capped,
 * so the day before is not reliably there to compare against.
 */
export function AuditStats({ logs, className }: { logs: AuditLog[]; className?: string }) {
  const now = useMinute();
  const stats = auditStats(logs, now);
  // Four to a row beside the hologram leaves each tile ~240px; tighter
  // padding keeps "Successful" whole next to its chip.
  const tile = "min-[104rem]:gap-3 min-[104rem]:px-4";

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <NeonStat
        tone="blue"
        iconShape="ring"
        icon={<UserIcon />}
        label="Total Events"
        value={stats.total}
        tintValue
        capsLabel={false}
        className={tile}
      />
      <NeonStat
        tone="green"
        iconShape="tile"
        icon={<ShieldCheckIcon />}
        label="Successful"
        value={stats.success}
        chip={shareOf(stats.success, stats.total)}
        tintValue
        capsLabel={false}
        className={tile}
      />
      <NeonStat
        tone="red"
        iconShape="tile"
        icon={<AlertTriangleIcon />}
        label="Failed"
        value={stats.failed}
        chip={shareOf(stats.failed, stats.total)}
        tintValue
        capsLabel={false}
        className={tile}
      />
      <NeonStat
        tone="blue"
        iconShape="ring"
        icon={<ClockIcon />}
        label="Last 24 Hours"
        value={stats.lastDay ?? "–"}
        tintValue
        capsLabel={false}
        className={tile}
      />
    </div>
  );
}
