"use client";

import { FileTextIcon, UserIcon } from "@/components/icons";
import {
  NeonCell,
  NeonChip,
  NeonEmpty,
  NeonRow,
  NeonTable,
  STATUS_TONES,
  StatusPill,
  packageTone,
  toneVars,
  type NeonColumn,
} from "@/components/neon";
import type { AuditLog } from "@/lib/types";
import { formatStampForDisplay } from "@/lib/utils";

import { STATUS_LOOK, auditDetails, auditStatus, splitGenerated, splitUser } from "./derive";

// The action is the one column whose length varies, so it takes what the
// others leave; the rest are sized to what they hold.
const COLUMNS: NeonColumn[] = [
  { label: "Timestamp", className: "w-[250px]" },
  { label: "User", className: "w-[270px]" },
  "Action",
  { label: "Details", className: "w-[190px]" },
  { label: "IP Address", className: "w-[210px]" },
  { label: "Status", align: "right", className: "w-[120px]" },
];

// A 100-row log reads better denser than the kit's 56px rows.
const CELL = "h-[46px] py-1.5";

/** Package names are lit in their own package colour, as their chips are elsewhere. */
function PackageName({ name }: { name: string }) {
  return (
    <span
      style={toneVars(packageTone(name))}
      className="font-semibold text-[rgb(var(--tone-hi))] lt:text-[var(--tone-lt)]"
    >
      {name}
    </span>
  );
}

function AuditRow({ log, index }: { log: AuditLog; index: number }) {
  const status = auditStatus(log.action);
  const look = STATUS_LOOK[status];
  const { name, role } = splitUser(log.user);
  const generated = splitGenerated(log.action);
  const details = auditDetails(log.action);

  return (
    // Logs are stored newest first, so row 0 is the latest event.
    <NeonRow index={index} highlight={index === 0}>
      <NeonCell className={`${CELL} whitespace-nowrap`}>
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full border border-[rgba(147,197,253,0.8)] bg-[radial-gradient(circle_at_50%_35%,#60a5fa,#2563eb)] text-white shadow-[0_0_12px_-3px_rgba(59,130,246,0.9)] lt:border-blue-300 lt:bg-blue-50 lt:bg-none lt:text-blue-600 lt:shadow-none"
          >
            <UserIcon className="size-3.5" />
          </span>
          {formatStampForDisplay(log.timestamp)}
        </span>
      </NeonCell>

      <NeonCell className={`${CELL} whitespace-nowrap`}>
        <span className="flex items-center gap-2.5">
          <UserIcon
            aria-hidden
            className={
              role === "RESELLER"
                ? "size-4 shrink-0 text-[#93c5fd] lt:text-blue-600"
                : "size-4 shrink-0 text-[#c4b5fd] lt:text-violet-600"
            }
          />
          <span className="font-semibold text-fg">{name}</span>
          {role ? (
            <NeonChip tone={role === "OWNER" ? "violet" : "blue"} size="xs">
              {role}
            </NeonChip>
          ) : null}
        </span>
      </NeonCell>

      <NeonCell className={`${CELL} min-w-[280px]`}>
        <span className="flex items-start gap-2.5">
          <span
            aria-hidden
            style={toneVars(STATUS_TONES[look.pill])}
            className="mt-[7px] size-2 shrink-0 rounded-full bg-[rgb(var(--tone-hi))] shadow-[0_0_8px_rgb(var(--tone))] lt:bg-[var(--tone-lt)] lt:shadow-none"
          />
          <span className="break-words">
            {generated ? (
              <>
                {generated.lead}
                <PackageName name={generated.pkg} />
              </>
            ) : (
              log.action
            )}
          </span>
        </span>
      </NeonCell>

      <NeonCell className={`${CELL} whitespace-nowrap`}>
        {details === null ? (
          <span className="text-[#7c8bb8] lt:text-slate-400">–</span>
        ) : details.pkg ? (
          <PackageName name={details.text} />
        ) : (
          details.text
        )}
      </NeonCell>

      <NeonCell mono className={`${CELL} text-[#94a3b8] lt:text-slate-500`}>
        {log.ip || "127.0.0.1"}
      </NeonCell>

      <NeonCell align="right" className={CELL}>
        <StatusPill status={look.pill} size="xs" className="ml-auto">
          {look.label}
        </StatusPill>
      </NeonCell>
    </NeonRow>
  );
}

/**
 * Row keys taken from the record itself, numbered from the oldest end,
 * so a new event arriving on top leaves every existing row's key -- and
 * so its mounted row -- alone. Keyed by position, every row would
 * remount on each refresh that brought something in, and the whole log
 * would replay its entrance. Records alike in all four fields are told
 * apart by how many came before them.
 */
function rowKeys(logs: AuditLog[]): string[] {
  const seen = new Map<string, number>();
  const keys = new Array<string>(logs.length);
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const { timestamp, user, action, ip } = logs[i];
    const base = `${timestamp}|${user}|${action}|${ip}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    keys[i] = `${base}|${n}`;
  }
  return keys;
}

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  const keys = rowKeys(logs);
  return (
    // A row tipping in is a few px wider than the table for half a
    // second; clipping the table's sizing box sideways (it is exactly
    // as wide as the scroller, so nothing visible is cut) stops that
    // flashing a scrollbar under the log on every arrival.
    <NeonTable
      columns={COLUMNS}
      minWidth={960}
      className="[&>.overflow-x-auto>div]:overflow-x-clip"
      empty={<NeonEmpty icon={<FileTextIcon />}>No logs available.</NeonEmpty>}
    >
      {logs.map((log, index) => (
        <AuditRow key={keys[index]} log={log} index={index} />
      ))}
    </NeonTable>
  );
}
