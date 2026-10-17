"use client";

import { CalendarIcon, ClockIcon, TrashIcon, UserIcon } from "@/components/icons";
import { CrownIcon, NeonButton, NeonPanel, StatusPill } from "@/components/neon";
import type { WhitelistEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { regionName } from "./whitelist-shared";

/** One whitelisted UID: who it is, where, until when, and its two actions. */
export function EntryCard({
  entry,
  left,
  busy,
  onEdit,
  onDelete,
}: {
  entry: WhitelistEntry;
  /** Whole days until expiry (negative once past), or null with no date: `daysLeft`. */
  left: number | null;
  index: number;
  avatar?: string;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const expired = left !== null && left < 0;
  const soon = left !== null && left >= 0 && left <= 3;

  return (
    <NeonPanel size="md" rim="danger" className="flex flex-col justify-between">
      <div>
        {/* Card Header: User icon + UID + Status Pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,45,90,0.35)] bg-[rgba(255,45,90,0.12)] text-[#ff4d79] shadow-[0_0_10px_rgba(255,45,90,0.2)]">
              <UserIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] leading-none font-extrabold tracking-[1px] text-[#ff8ba7] uppercase">
                UID
              </span>
              <div className="mt-1 text-[16.5px] leading-tight font-bold tracking-[0.3px] break-all text-white tabular-nums">
                {entry.uid}
              </div>
            </div>
          </div>

          <StatusPill
            status={expired ? "danger" : "success"}
            tone={soon ? "amber" : undefined}
            caps
            size="xs"
          >
            {expired ? "Expired" : "Active"}
          </StatusPill>
        </div>

        {/* Card Fields Grid */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[rgba(255,45,90,0.12)] bg-[rgba(16,3,8,0.45)] p-3">
          <Field label="Player" value={entry.name || "—"} />
          <Field
            label="Region"
            value={entry.region}
            title={regionName(entry.region) ?? entry.region}
            align="right"
          />
          <Field label="Note" value={entry.note || "—"} />
          <Field
            label="Added By"
            value={entry.createdBy || "—"}
            align="right"
            icon={entry.createdBy ? <CrownIcon /> : undefined}
            className={entry.createdBy ? "text-[#fdd680]" : undefined}
          />
        </dl>

        {/* Expire Date Row */}
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,5,13,0.7),rgba(14,2,7,0.85))] px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarIcon
              aria-hidden
              className="size-5 shrink-0 text-[#ff4d79] drop-shadow-[0_0_6px_rgba(255,45,90,0.4)]"
            />
            <div className="min-w-0">
              <span className="block text-[10px] leading-none font-extrabold tracking-[1px] text-[#ff8ba7] uppercase">
                Expire Date
              </span>
              <div className="mt-1 text-[14px] font-bold text-white tabular-nums">
                {entry.expireDate || "—"}
              </div>
            </div>
          </div>

          {left !== null && (
            <span
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-wide select-none",
                expired
                  ? "border border-rose-500/40 bg-rose-500/15 text-rose-300"
                  : soon
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
              )}
            >
              {expired
                ? `Expired ${-left}d ago`
                : left === 0
                  ? "Expires today"
                  : `${left} day${left === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2.5 pt-2">
        <NeonButton
          tone="green"
          size="md"
          icon={<ClockIcon />}
          onClick={onEdit}
          disabled={busy}
          className="flex-1"
        >
          Extend
        </NeonButton>
        <NeonButton
          tone="red"
          size="md"
          icon={<TrashIcon />}
          onClick={onDelete}
          disabled={busy}
          className="flex-1"
        >
          {busy ? "…" : "Delete"}
        </NeonButton>
      </div>
    </NeonPanel>
  );
}

function Field({
  label,
  value,
  title = value,
  align = "left",
  icon,
  className,
}: {
  label: string;
  value: string;
  title?: string;
  align?: "left" | "right";
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <dt className="text-[10px] leading-none font-extrabold tracking-[1px] text-[#ff8ba7] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-white",
          "[&>svg]:size-3.5 [&>svg]:shrink-0",
          align === "right" && "justify-end",
          className,
        )}
        title={title}
      >
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
