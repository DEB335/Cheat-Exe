"use client";

import { CalendarIcon, ClockIcon, TrashIcon, UserIcon } from "@/components/icons";
import { CrownIcon, IconTile, NeonButton, NeonPanel, StatusPill, toneVars, type NeonRim, type NeonTone } from "@/components/neon";
import { EntryAvatar, type EntryAvatarVariant } from "@/components/scenes/WhitelistScene";
import type { WhitelistEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { regionName } from "./whitelist-shared";

/**
 * Rims cycle down the grid so neighbouring cards never share a colour;
 * the icon tile and calendar take the matching tone. An expired entry
 * leaves the cycle for the danger rim, so it stands out without reading
 * its pill.
 */
const CYCLE: { rim: NeonRim; tone: NeonTone }[] = [
  { rim: "blue", tone: "blue" },
  { rim: "violet", tone: "violet" },
  { rim: "cyan", tone: "cyan" },
  { rim: "pink", tone: "magenta" },
];
const EXPIRED_LOOK: { rim: NeonRim; tone: NeonTone } = { rim: "danger", tone: "red" };

/** One whitelisted UID: who it is, where, until when, and its two actions. */
export function EntryCard({
  entry,
  left,
  index,
  avatar,
  busy,
  onEdit,
  onDelete,
}: {
  entry: WhitelistEntry;
  /** Whole days until expiry (negative once past), or null with no date: `daysLeft`. */
  left: number | null;
  /** Position in the grid, for the rim colour. */
  index: number;
  avatar: EntryAvatarVariant;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const expired = left !== null && left < 0;
  const soon = left !== null && left >= 0 && left <= 3;
  const look = expired ? EXPIRED_LOOK : CYCLE[index % CYCLE.length];

  return (
    <NeonPanel size="md" rim={look.rim} className="flex flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone={look.tone} size="sm">
          <UserIcon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] leading-none font-bold tracking-[1px] text-[#9fb0dd] uppercase lt:text-slate-500">
            UID
          </span>
          <div className="mt-1.5 text-[18px] leading-tight font-bold tracking-[0.3px] break-all text-white tabular-nums lt:text-slate-900">
            {entry.uid}
          </div>
        </div>
        {/* Blue in its last three days, the same warning the countdown
            line below gives, but still "Active": it still works. */}
        <StatusPill
          status={expired ? "danger" : "success"}
          tone={soon ? "blue" : undefined}
          caps
          size="xs"
        >
          {expired ? "Expired" : "Active"}
        </StatusPill>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Player" value={entry.name || "—"} />
        <Field
          label="Region"
          value={entry.region}
          title={regionName(entry.region) ?? entry.region}
          align="right"
        />
        <Field label="Note" value={entry.note || "—"} />
        {/* The TX999 account the entry sits under, which is always the
            key's owner -- hence the crown. */}
        <Field
          label="Added By"
          value={entry.createdBy || "—"}
          align="right"
          icon={entry.createdBy ? <CrownIcon /> : undefined}
          className={entry.createdBy ? "text-[#fdd680] lt:text-amber-700" : undefined}
        />
      </dl>

      {/* Top-aligned so the label sits level with the calendar on every
          card, with or without a countdown line; only the avatar is
          centred in the row. */}
      <div style={toneVars(look.tone)} className="mt-4 flex items-start gap-3">
        <CalendarIcon
          aria-hidden
          className="size-7 shrink-0 text-[rgb(var(--tone-hi))] drop-shadow-[0_0_6px_rgba(var(--tone),0.8)] lt:text-[var(--tone-lt)] lt:drop-shadow-none"
        />
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] leading-none font-bold tracking-[1px] text-[#9fb0dd] uppercase lt:text-slate-500">
            Expire Date
          </span>
          <div className="mt-1.5 text-[16px] font-bold text-white tabular-nums lt:text-slate-900">
            {entry.expireDate || "—"}
          </div>
          {left !== null && (
            <div
              className={cn(
                "mt-0.5 text-[13px] font-semibold",
                expired
                  ? "text-[#ff8aa0] lt:text-rose-600"
                  : soon
                    ? "text-[#93c5fd] lt:text-blue-700"
                    : "text-[#cdd6f4] lt:text-slate-600",
              )}
            >
              {expired
                ? `Expired ${-left} day${left === -1 ? "" : "s"} ago`
                : left === 0
                  ? "Expires today"
                  : `${left} day${left === 1 ? "" : "s"} left`}
            </div>
          )}
        </div>
        <EntryAvatar variant={avatar} className="size-[76px] shrink-0 self-center" />
      </div>

      <div className="mt-auto flex gap-2.5 pt-5">
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
      <dt className="text-[11px] leading-none font-bold tracking-[1px] text-[#9fb0dd] uppercase lt:text-slate-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-white lt:text-slate-900",
          "[&>svg]:size-4 [&>svg]:shrink-0",
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
