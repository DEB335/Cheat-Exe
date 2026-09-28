"use client";

import { useMemo, useState } from "react";

import { BoltIcon, RefreshIcon, SearchIcon, TrashIcon } from "@/components/icons";
import {
  DatabaseIcon,
  NeonButton,
  NeonEmpty,
  NeonInput,
  NeonPanel,
  PanelHeader,
  SpinnerIcon,
} from "@/components/neon";
import type { EntryAvatarVariant } from "@/components/scenes/WhitelistScene";
import { MaintenanceNotice } from "@/components/ui/MaintenanceNotice";
import { useToast } from "@/components/ui/Toast";
import { AddUidPanel } from "@/components/whitelist/AddUidPanel";
import { EntryCard } from "@/components/whitelist/EntryCard";
import { ExtendModal } from "@/components/whitelist/ExtendModal";
import type { AddResult } from "@/components/whitelist/whitelist-shared";
import { del, patchJson } from "@/lib/client-api";
import type { WhitelistEntry } from "@/lib/types";
import { useStoredFlag } from "@/lib/use-external";

import { AUTO_REFRESH_MS, daysLeft, isExpired, useWhitelist } from "../use-whitelist";

const AUTO_KEY = "uidBypassAutoRefresh";

/**
 * Runs `task` over `items`, `limit` at a time.
 *
 * The provider has no bulk endpoint, so a mass delete is a loop -- but
 * it need not be a queue. At ~400ms a call, fifty UIDs one after
 * another is half a minute; six at a time is a few seconds, and stays
 * polite enough not to look like an attack.
 */
async function inBatches<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(task))));
  }
  return out;
}

/** A note compared the way people read it, not the way it was typed. */
const noteKey = (note: string) => note.trim().toLowerCase();

export default function WhitelistPage() {
  const toast = useToast();
  const [auto, setAuto] = useStoredFlag(AUTO_KEY);
  const { entries, loading, maintenance, reason, reload, mutate } = useWhitelist(auto);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [editing, setEditing] = useState<WhitelistEntry | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (entry) =>
        entry.uid.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.note.toLowerCase().includes(needle),
    );
  }, [entries, query]);

  const expiredCount = useMemo(() => entries.filter(isExpired).length, [entries]);

  // How many UIDs each buyer reference covers. The note is the seller's
  // own label for who bought, so two UIDs under one note are one
  // customer's accounts -- the only grouping the data really holds.
  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const key = noteKey(entry.note);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  // The glyph beside a card's expiry: a user with a plus on an expired
  // entry (a re-issue away from working again), a group where the
  // buyer holds several UIDs, a single user otherwise.
  const avatarFor = (entry: WhitelistEntry): EntryAvatarVariant =>
    isExpired(entry)
      ? "add"
      : (noteCounts.get(noteKey(entry.note)) ?? 0) > 1
        ? "group"
        : "user";

  const removeOne = async (entry: WhitelistEntry) => {
    // Gone from the screen at once. The call still runs and a failure
    // puts the row back, but the happy path no longer waits on a write
    // and a re-read to show what the click obviously meant.
    mutate((prev) => prev.filter((row) => row.uid !== entry.uid));
    try {
      const result = await del<{ existed?: boolean }>(
        `/api/uid-bypass?uid=${encodeURIComponent(entry.uid)}`,
      );
      toast(
        result.existed === false
          ? `UID ${entry.uid} was not on the provider's list. Cleared it here.`
          : `UID ${entry.uid} removed.`,
        "success",
      );
    } catch (err) {
      mutate((prev) => (prev.some((row) => row.uid === entry.uid) ? prev : [entry, ...prev]));
      toast((err as Error).message, "error");
    }
  };

  /**
   * Bulk delete.
   *
   * Upstream has no bulk endpoint, so this is still a loop -- but the
   * calls overlap, and the rows leave the screen before any of them
   * land. Each removal is counted separately, because a batch can fail
   * halfway and the summary should say what happened rather than what
   * was asked for. UIDs the provider did not hold are counted apart
   * from the ones genuinely taken off it: both leave, but only one was
   * there. The reload at the end puts back anything that failed.
   */
  const removeMany = async (targets: WhitelistEntry[]) => {
    if (targets.length === 0) return;

    const going = new Set(targets.map((entry) => entry.uid));
    mutate((prev) => prev.filter((row) => !going.has(row.uid)));
    setBusy("bulk");

    const outcomes = await inBatches(targets, 6, async (entry) => {
      try {
        const result = await del<{ existed?: boolean }>(
          `/api/uid-bypass?uid=${encodeURIComponent(entry.uid)}`,
        );
        return result.existed === false ? "stale" : "removed";
      } catch {
        return `failed:${entry.uid}`;
      }
    });

    const removed = outcomes.filter((o) => o === "removed").length;
    const stale = outcomes.filter((o) => o === "stale").length;
    const failed = outcomes
      .filter((o) => o.startsWith("failed:"))
      .map((o) => o.slice("failed:".length));

    setBusy(null);
    void reload();

    const staleNote = stale === 0 ? "" : ` (${stale} not on the provider's list)`;
    if (failed.length === 0) {
      toast(`Removed ${removed} UID${removed === 1 ? "" : "s"}${staleNote}.`, "success");
    } else {
      toast(
        `Removed ${removed}${staleNote}; ${failed.length} failed (${failed.slice(0, 3).join(", ")}).`,
        "error",
      );
    }
  };

  // Before anything else, and in place of the form rather than above
  // it. Every button on this page spends a credit; none of them can
  // work while the provider is unavailable. Held in a panel so the
  // notice keeps an opaque backdrop over the bright background video.
  if (maintenance) {
    return (
      <NeonPanel rim="amber">
        <MaintenanceNotice reason={reason} />
      </NeonPanel>
    );
  }

  return (
    <>
      <AddUidPanel entries={entries} reload={reload} mutate={mutate} />

      <NeonPanel rim="blue">
        <PanelHeader
          icon={<DatabaseIcon />}
          iconTone="blue"
          iconTone2="cyan"
          title={`Whitelist Entries (${visible.length})`}
          subtitle={`${entries.length} total · ${expiredCount} expired`}
          actions={
            <>
              <div className="relative w-full sm:w-[230px]">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-[#9fb0dd] lt:text-slate-400"
                />
                <NeonInput
                  tone="blue"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search UID…"
                  aria-label="Search whitelist"
                  boxClassName="h-9 rounded-full"
                  inputClassName="pl-10 text-[14px]"
                />
              </div>

              <NeonButton
                tone="pink"
                icon={<TrashIcon />}
                disabled={busy !== null || expiredCount === 0}
                onClick={() => void removeMany(entries.filter(isExpired))}
              >
                Delete Expired
              </NeonButton>

              <NeonButton
                tone="red"
                icon={<TrashIcon />}
                disabled={busy !== null || entries.length === 0}
                onClick={() => void removeMany(entries)}
              >
                Delete All
              </NeonButton>

              {/* Lit while the list is being re-read on a timer. */}
              <NeonButton
                tone="blue"
                variant={auto ? "filled" : "outline"}
                icon={<BoltIcon />}
                onClick={() => setAuto(!auto)}
                aria-pressed={auto}
                title={`Re-read the list every ${AUTO_REFRESH_MS / 1000} seconds`}
              >
                Auto
              </NeonButton>

              <NeonButton
                tone="green"
                icon={<RefreshIcon />}
                disabled={busy !== null}
                onClick={() => void reload()}
              >
                Refresh
              </NeonButton>
            </>
          }
        />

        {loading ? (
          <NeonEmpty icon={<SpinnerIcon />} tone="blue">
            Loading whitelist…
          </NeonEmpty>
        ) : visible.length === 0 ? (
          <NeonEmpty icon={entries.length === 0 ? <DatabaseIcon /> : <SearchIcon />} tone="blue">
            {entries.length === 0 ? "No UIDs whitelisted yet." : "No UID matches that search."}
          </NeonEmpty>
        ) : (
          // Columns follow the panel's own width rather than the
          // screen's: four across a wide desktop, three at 1280, two on
          // a tablet, one on a phone.
          <div className="@container">
            <div className="grid grid-cols-1 gap-5 @min-[600px]:grid-cols-2 @min-[1040px]:grid-cols-3 @min-[1400px]:grid-cols-4">
              {visible.map((entry, index) => (
                <EntryCard
                  key={entry.uid}
                  entry={entry}
                  left={daysLeft(entry.expireDate)}
                  index={index}
                  avatar={avatarFor(entry)}
                  busy={busy === entry.uid || busy === "bulk"}
                  onEdit={() => setEditing(entry)}
                  onDelete={() => removeOne(entry)}
                />
              ))}
            </div>
          </div>
        )}
      </NeonPanel>

      {/* Keyed so each UID gets a fresh modal: the fields live in its own
          state, and without a remount the last UID's typing would carry
          over to the next one opened. */}
      {editing && (
        <ExtendModal
          key={editing.uid}
          entry={editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            void reload();
            toast(message, "success");
          }}
          onError={(message) => toast(message, "error")}
          extend={(body) => patchJson<AddResult>("/api/uid-bypass", body)}
        />
      )}
    </>
  );
}
