"use client";

import { memo, useEffect, useState } from "react";

import {
  CalendarIcon,
  ClockIcon,
  CopyIcon,
  KeyIcon,
  LockIcon,
  UnlockIcon,
  UserIcon,
} from "@/components/icons";
import {
  InfinityIcon,
  NeonButton,
  NeonCell,
  NeonChip,
  NeonEmpty,
  NeonRow,
  NeonTable,
  PackageChip,
  SpinnerIcon,
  toneVars,
  type NeonColumn,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { keyValidity } from "@/lib/packages";
import { useDashboard } from "@/lib/store";
import type { KeyRecord } from "@/lib/types";
import { cn, formatStampForDisplay } from "@/lib/utils";

/** Rows painted with the table itself; enough to fill any screen several times over. */
const FIRST_ROWS = 150;
/** Rows added per idle slot after that -- small enough to fit in one. */
const MORE_ROWS = 100;

/**
 * How many of `total` rows to render right now.
 *
 * A long history used to go out as one render of every row -- thousands
 * of cells with icons and chips before the page could answer a click.
 * The first screenful is rendered at once and the rest is filled in
 * while the browser is idle, a slice at a time; everything past the
 * first slice is far below the fold, so the page looks the same, it
 * just becomes usable sooner. Once grown the count never shrinks back.
 */
function useRowBudget(total: number): number {
  const [budget, setBudget] = useState(FIRST_ROWS);

  useEffect(() => {
    if (budget >= total) return;
    const grow = () => setBudget((n) => n + MORE_ROWS);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(grow, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(grow, 50);
    return () => window.clearTimeout(id);
  }, [budget, total]);

  return budget;
}

/**
 * The key table both history pages share. The owner's copy has a Copy
 * action per key; the reseller one names who generated each key instead,
 * as the two pages always have.
 */
export const KeyHistoryTable = memo(function KeyHistoryTable({
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
  const budget = useRowBudget(records.length);
  const rows = records.length > budget ? records.slice(0, budget) : records;

  const columns: NeonColumn[] = [
    "License Key",
    "Package",
    "Validity",
    "HWID",
    ...(showCreator ? ["Creator"] : []),
    "Created On",
    ...(showCopy ? ["Actions"] : []),
  ];

  return (
    <NeonTable
      columns={columns}
      tone="violet"
      // +130 over the old widths for the HWID column's pill.
      minWidth={showCreator ? 1090 : 1010}
      empty={
        <NeonEmpty icon={<KeyIcon />} tone="violet">
          {/* Before the first load the store is empty too; saying there
              are no keys then would contradict the tiles' dashes above. */}
          {loading ? "Loading key history…" : emptyText}
        </NeonEmpty>
      }
    >
      {rows.map((item, i) => (
        <KeyRow
          key={item.key}
          item={item}
          index={i}
          showCreator={showCreator}
          showCopy={showCopy}
          toast={toast}
        />
      ))}
    </NeonTable>
  );
});

/**
 * One key. Memoised: the store keeps an unchanged record the same object
 * across refreshes, so a new key re-renders its own row, not the list.
 */
const KeyRow = memo(function KeyRow({
  item,
  index,
  showCreator,
  showCopy,
  toast,
}: {
  item: KeyRecord;
  index: number;
  showCreator: boolean;
  showCopy: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const validity = keyValidity(item);
  const lifetime = validity.certain && validity.label === "Lifetime";
  return (
    <NeonRow index={index}>
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
                  ? "bg-[#b67cff] shadow-[0_0_5px_rgba(182,124,255,0.4)]"
                  : "bg-[#3ee88a] shadow-[0_0_5px_rgba(62,232,138,0.4)]",
            )}
          />
          <KeyIcon
            aria-hidden
            className="size-[18px] shrink-0 text-[#a78bfa] drop-shadow-[0_0_5px_rgba(167,139,250,0.22)] lt:text-violet-600 lt:drop-shadow-none"
          />
          <span className="text-[#6ef3a5] lt:text-emerald-700">
            {item.key}
          </span>
        </span>
      </NeonCell>
      <NeonCell>
        <PackageChip name={item.package} />
      </NeonCell>
      <ValidityCell item={item} />
      <HwidCell item={item} toast={toast} />
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
});

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

/** What an unlock found when it went to free the key's device at once (see /api/keys/lock). */
type Release = "released" | "free" | "missing" | "banned" | "expired" | "locked" | "error";

const UNLOCKED_COPY: Record<Release, string> = {
  released: "HWID unlocked. Its device was released, so any device can log in now.",
  free: "HWID unlocked. The key is not on a device yet.",
  missing: "HWID unlocked, but the provider has no record of this key.",
  banned: "HWID unlocked, but the provider has this key banned.",
  expired: "HWID unlocked, but the key has expired, so no device can use it.",
  // Someone locked it again in the moment between the two requests.
  locked: "The key was locked again before its device could be released.",
  error: "HWID unlocked. Freeing its device failed; the panel tries again within 30 seconds.",
};

/**
 * The HWID column: a small pill that is also the switch.
 *
 * Teal "Locked" is the provider's own behaviour -- the key stays on the
 * first device that uses it. Amber "Unlocked" is this panel's doing: it
 * keeps releasing the key's binding (lib/use-hwid-sweep.ts), so the next
 * device to log in takes it. Only `false` is unlocked; a key from before
 * the switch existed has no value and was always locked.
 *
 * The pill stays busy until the refresh that carries the new state has
 * landed, so it flips once instead of snapping back for a moment. The
 * store is read on click rather than subscribed to: there is one of
 * these per row, and a long history would otherwise be thousands of
 * subscriptions for a function that never changes.
 */
function HwidCell({ item, toast }: { item: KeyRecord; toast: ReturnType<typeof useToast> }) {
  const [busy, setBusy] = useState(false);
  const locked = item.hwidLock !== false;
  const tone = locked ? "teal" : "amber";

  const flip = async () => {
    // aria-disabled rather than disabled while busy: a disabled button
    // drops keyboard focus to the page body, halfway down a long table.
    if (busy) return;
    setBusy(true);
    try {
      const data = await postJson<{ hwidLock?: boolean; release?: Release }>("/api/keys/lock", {
        key: item.key,
        locked: !locked,
      });
      if (locked) {
        // An unknown answer reads as released: the lock itself did change.
        const release = data.release && data.release in UNLOCKED_COPY ? data.release : "released";
        const clean = release === "released" || release === "free";
        toast(UNLOCKED_COPY[release], clean ? "success" : "info");
      } else {
        toast(
          "HWID locked. The key stays on the device it is on now, or the next one to use it.",
          "success",
        );
      }
      await useDashboard.getState().refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeonCell>
      <button
        type="button"
        role="switch"
        aria-checked={locked}
        aria-label={`HWID lock for ${item.key}`}
        onClick={flip}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        title={
          locked
            ? "Locked to the first device that uses this key. Click to unlock it."
            : "Works on any device; the panel frees its device about every 30 seconds. Click to lock it again."
        }
        style={toneVars(tone)}
        className={cn(
          "group/hwid inline-flex cursor-pointer rounded-full align-middle",
          "aria-disabled:cursor-wait aria-disabled:opacity-70",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))]",
        )}
      >
        <NeonChip
          tone={tone}
          shape="pill"
          icon={busy ? <SpinnerIcon /> : locked ? <LockIcon aria-hidden /> : <UnlockIcon aria-hidden />}
          className={cn(
            "transition-[border-color,box-shadow] duration-200",
            "group-hover/hwid:border-[rgb(var(--tone-hi))] group-hover/hwid:shadow-[0_0_9px_-2px_rgba(var(--tone),0.48),inset_0_1px_0_rgba(255,255,255,0.12)]",
            "lt:group-hover/hwid:border-[rgb(var(--tone))] lt:group-hover/hwid:shadow-[0_2px_5px_-2px_rgba(var(--tone),0.3)]",
          )}
        >
          {locked ? "Locked" : "Unlocked"}
        </NeonChip>
      </button>
    </NeonCell>
  );
}
