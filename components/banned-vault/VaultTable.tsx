"use client";

import { BanIcon, CheckIcon, CopyIcon, LockIcon, TrashIcon } from "@/components/icons";
import {
  NeonButton,
  NeonCell,
  NeonChip,
  NeonEmpty,
  NeonRow,
  NeonTable,
  PackageChip,
  StatusPill,
  type NeonColumn,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import type { BannedUser } from "@/lib/types";
import { splitStampForDisplay } from "@/lib/utils";

const COLUMNS: NeonColumn[] = [
  "STATUS",
  "USER ACCOUNT",
  "PASSWORD (VAULT)",
  "ROLE & PACKAGES",
  "IP / DEVICE",
  "KICKED TIME",
  { label: "ACTIONS", align: "right" },
];

/**
 * The vault's records as the neon table. `onAct` is the page's unban
 * (restore = true) or delete-record handler; the table only lays the
 * rows out. `query` is the active search, so an empty result can say
 * whether the vault is empty or the search simply matched nothing.
 */
export function VaultTable({
  records,
  query,
  onAct,
  className,
}: {
  records: BannedUser[];
  query: string;
  onAct: (username: string, restore: boolean) => void;
  className?: string;
}) {
  const toast = useToast();
  const searching = query.trim() !== "";

  return (
    <NeonTable
      columns={COLUMNS}
      minWidth={1120}
      tone="pink"
      className={className}
      empty={
        <NeonEmpty icon={<BanIcon />} tone="pink">
          {searching ? `Nothing in the vault matches "${query.trim()}".` : "No banned records found."}
        </NeonEmpty>
      }
    >
      {records.map((record, index) => {
        const kicked = splitStampForDisplay(record.kickedTime);
        return (
          <NeonRow key={`${record.username}-${index}`} index={index}>
            <NeonCell>
              <StatusPill status="danger" size="xs">
                Kicked / Banned
              </StatusPill>
            </NeonCell>

            <NeonCell className="font-semibold text-white lt:text-slate-900">{record.username}</NeonCell>

            <NeonCell>
              {/* Passwords are bcrypt hashes now, so there is nothing
                plaintext to reveal. Use Pass on the reseller row to set
                a new one. */}
              <span
                title="Passwords are hashed and cannot be recovered. Set a new one from the Reseller page."
                className="inline-flex w-max items-center gap-2 rounded-[9px] border border-[rgba(129,140,248,0.3)] bg-[rgba(10,14,44,0.6)] px-2.5 py-1.5 lt:border-slate-200 lt:bg-slate-50"
              >
                <LockIcon aria-hidden className="size-3.5 text-[#8b93c9] lt:text-slate-400" />
                <span className="font-mono text-[13px] text-[#a9b8e0] lt:text-slate-500">not recoverable</span>
              </span>
            </NeonCell>

            <NeonCell>
              <NeonChip tone={record.role === "OWNER" ? "red" : "blue"} size="xs">
                {record.role}
              </NeonChip>
              {/* Each package as its glyph chip, named by its tooltip; the
                full list stays on the row's tooltip as before. */}
              <div title={record.packages.join(", ")} className="mt-1.5 flex max-w-[200px] flex-wrap gap-1">
                {record.packages.length > 0 ? (
                  // Stored lists aren't deduplicated, so the index keeps keys unique.
                  record.packages.map((name, i) => <PackageChip key={`${name}-${i}`} name={name} size="xs" iconOnly />)
                ) : (
                  <span className="text-[11px] font-semibold tracking-[0.6px] text-[#7f8bb8] lt:text-slate-400">
                    NONE
                  </span>
                )}
              </div>
            </NeonCell>

            <NeonCell className="whitespace-nowrap">
              <div className="font-mono text-[13.5px] font-semibold text-white lt:text-slate-900">{record.ip}</div>
              <div
                title={record.device}
                className="mt-1 max-w-[200px] truncate text-[12px] text-[#8b98c9] lt:text-slate-500"
              >
                {record.device}
              </div>
            </NeonCell>

            <NeonCell className="whitespace-nowrap">
              <div className="text-[13.5px] text-white lt:text-slate-900">{kicked.date}</div>
              <div className="mt-0.5 text-[12px] text-[#8b98c9] lt:text-slate-500">{kicked.time}</div>
            </NeonCell>

            <NeonCell align="right">
              <div className="flex items-center justify-end gap-2">
                <NeonButton
                  tone="green"
                  variant="filled"
                  size="xs"
                  icon={<CheckIcon />}
                  onClick={() => onAct(record.username, true)}
                >
                  Unban / Restore
                </NeonButton>

                <NeonButton
                  tone="cyan"
                  variant="filled"
                  size="xs"
                  title="Copy username"
                  aria-label="Copy username"
                  icon={<CopyIcon />}
                  onClick={async () => {
                    await navigator.clipboard.writeText(record.username);
                    toast("Username copied!", "success");
                  }}
                />

                <NeonButton
                  tone="red"
                  variant="filled"
                  size="xs"
                  title="Delete record"
                  aria-label="Delete record"
                  icon={<TrashIcon />}
                  onClick={() => onAct(record.username, false)}
                />
              </div>
            </NeonCell>
          </NeonRow>
        );
      })}
    </NeonTable>
  );
}
