"use client";

import { CalendarIcon, ClockIcon, CopyIcon, KeyIcon, UserIcon } from "@/components/icons";
import {
  InfinityIcon,
  NeonButton,
  NeonCell,
  NeonEmpty,
  NeonRow,
  NeonTable,
  PackageChip,
  type NeonColumn,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { keyValidity } from "@/lib/packages";
import { useDashboard } from "@/lib/store";
import type { KeyRecord } from "@/lib/types";
import { cn, formatStampForDisplay } from "@/lib/utils";

/**
 * The key table both history pages share. The owner's copy has a Copy
 * action per key; the reseller one names who generated each key instead,
 * as the two pages always have.
 */
export function KeyHistoryTable({
  records,
  showCreator = false,
  showCopy = false,
  emptyText,
}: {
  records: KeyRecord[];
  showCreator?: boolean;
  showCopy?: boolean;
  emptyText: string;
}) {
  const toast = useToast();
  const loading = useDashboard((s) => s.loading);

  const columns: NeonColumn[] = [
    "License Key",
    "Package",
    "Validity",
    ...(showCreator ? ["Creator"] : []),
    "Created On",
    ...(showCopy ? ["Actions"] : []),
  ];

  return (
    <NeonTable
      columns={columns}
      tone="violet"
      minWidth={showCreator ? 960 : 880}
      empty={
        <NeonEmpty icon={<KeyIcon />} tone="violet">
          {/* Before the first load the store is empty too; saying there
              are no keys then would contradict the tiles' dashes above. */}
          {loading ? "Loading key history…" : emptyText}
        </NeonEmpty>
      }
    >
      {records.map((item, i) => {
        const validity = keyValidity(item);
        const lifetime = validity.certain && validity.label === "Lifetime";
        return (
          <NeonRow key={item.key} index={i}>
            <NeonCell mono>
              <span className="flex items-center gap-3">
                {/* The dot repeats the validity column's colour: violet
                    for a confirmed lifetime key, green for a confirmed
                    term, grey when the validity was never confirmed. It
                    says nothing about whether the key is in use. */}
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    !validity.certain
                      ? "bg-[#7c89b0]"
                      : lifetime
                        ? "bg-[#b67cff] shadow-[0_0_8px_rgba(182,124,255,0.9)]"
                        : "bg-[#3ee88a] shadow-[0_0_8px_rgba(62,232,138,0.9)]",
                  )}
                />
                <KeyIcon
                  aria-hidden
                  className="size-[18px] shrink-0 text-[#a78bfa] drop-shadow-[0_0_6px_rgba(167,139,250,0.55)] lt:text-violet-600 lt:drop-shadow-none"
                />
                <span className="text-[#6ef3a5] [text-shadow:0_0_12px_rgba(110,243,165,0.35)] lt:text-emerald-700 lt:[text-shadow:none]">
                  {item.key}
                </span>
              </span>
            </NeonCell>
            <NeonCell>
              <PackageChip name={item.package} />
            </NeonCell>
            <ValidityCell item={item} />
            {showCreator ? (
              <NeonCell>
                <span className="flex items-center gap-2 font-semibold whitespace-nowrap text-[#ff6b86] lt:text-rose-700">
                  <UserIcon aria-hidden className="size-4 shrink-0 opacity-80" />
                  {item.creator}
                </span>
              </NeonCell>
            ) : null}
            <NeonCell>
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <CalendarIcon aria-hidden className="size-[18px] shrink-0 text-[#a78bfa] lt:text-violet-600" />
                {formatStampForDisplay(item.date)}
              </span>
            </NeonCell>
            {showCopy ? (
              <NeonCell>
                <NeonButton
                  tone="blue"
                  icon={<CopyIcon />}
                  className="min-w-[104px]"
                  onClick={async () => {
                    await navigator.clipboard.writeText(item.key);
                    toast("Copied!", "success");
                  }}
                >
                  Copy
                </NeonButton>
              </NeonCell>
            ) : null}
          </NeonRow>
        );
      })}
    </NeonTable>
  );
}

/** Shown for keys minted before the provider's own parameter name was used. */
const UNCONFIRMED_VALIDITY =
  "This is what was asked for, not what was confirmed. The key was generated before the panel " +
  "sent the validity under the name the provider reads, so the provider may have applied its own " +
  "default instead. Check the TERMINALX999 portal for this key.";

/**
 * The validity column.
 *
 * Keys minted before the panel sent `days` rather than `duration` may have
 * been given the provider's default instead of the number chosen, so those
 * are greyed and italic with the doubt in the tooltip. Printing one as
 * though it were confirmed is how a key the provider issued as 30 days
 * came to be listed here, flatly, as "10 Days". Only confirmed ones get
 * the lit colours.
 */
function ValidityCell({ item }: { item: KeyRecord }) {
  const { label, certain } = keyValidity(item);
  const lifetime = certain && label === "Lifetime";
  const Icon = lifetime ? InfinityIcon : ClockIcon;
  return (
    <NeonCell
      // lt:text-muted as well: NeonCell's own lt:text-slate-700 would
      // otherwise win in light mode and the doubt would lose its grey.
      className={certain ? undefined : "text-muted italic lt:text-muted"}
      title={certain ? undefined : UNCONFIRMED_VALIDITY}
    >
      <span
        className={cn(
          "flex items-center gap-2 whitespace-nowrap",
          certain &&
            (lifetime
              ? "font-semibold text-[#c4a5ff] lt:text-violet-700"
              : "font-semibold text-[#5ef59a] lt:text-emerald-700"),
        )}
      >
        <Icon aria-hidden className="size-[18px] shrink-0" />
        {label}
      </span>
    </NeonCell>
  );
}
