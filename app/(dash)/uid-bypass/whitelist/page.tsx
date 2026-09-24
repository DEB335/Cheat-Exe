"use client";

import { useMemo, useState } from "react";

import { CheckCircleIcon, RefreshIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { DotBadge } from "@/components/ui/Badge";
import { PrimaryButton, TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, HelpText, Input, Select } from "@/components/ui/form";
import { MaintenanceNotice } from "@/components/ui/MaintenanceNotice";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { del, patchJson, postJson } from "@/lib/client-api";
import {
  DEFAULT_WHITELIST_DAYS,
  DEFAULT_WHITELIST_REGION,
  LIFETIME_WHITELIST_DAYS,
  MAX_WHITELIST_DAYS,
  WHITELIST_DAY_PRESETS,
  WHITELIST_REGIONS,
  isWhitelistDays,
  isWhitelistRegion,
  whitelistDaysLabel,
} from "@/lib/packages";
import type { WhitelistEntry } from "@/lib/types";
import { useStoredFlag } from "@/lib/use-external";
import { cn } from "@/lib/utils";

import { daysLeft, isExpired, useWhitelist } from "../use-whitelist";

const AUTO_KEY = "uidBypassAutoRefresh";

/** A type, not an interface: `api<T>` wants an implicit index signature. */
type AddResult = {
  name?: string;
  expireDate?: string;
};

type LookupResult = AddResult & {
  alreadyWhitelisted?: boolean;
  strayEntry?: boolean;
  resetExisting?: boolean;
};

/**
 * What to tell someone after an add or a re-issue.
 *
 * The provider answers with the player it verified, which is the useful
 * half -- it is the only confirmation that the UID typed belongs to the
 * customer meant. It does not always answer with a date, so the validity
 * asked for stands in rather than a guessed one.
 */
function addedMessage(result: AddResult, uid: string, days: number): string {
  const who = result.name ? `${result.name} (${uid})` : `UID ${uid}`;
  const until = result.expireDate
    ? `until ${result.expireDate}`
    : days === LIFETIME_WHITELIST_DAYS
      ? "for lifetime"
      : `for ${days} day${days === 1 ? "" : "s"}`;
  return `${who} whitelisted ${until}.`;
}

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

/** What the days field asks for. Empty is the default, not zero. */
function wantedDays(days: string): number {
  return days.trim() === "" ? DEFAULT_WHITELIST_DAYS : Number(days);
}

/** Entries predating the move read "ALL SERVER", which is not selectable. */
function startingRegion(region: string): string {
  return isWhitelistRegion(region) ? region : DEFAULT_WHITELIST_REGION;
}

function RegionOptions() {
  return (
    <>
      {WHITELIST_REGIONS.map((region) => (
        <option key={region.code} value={region.code}>
          {region.label} ({region.code})
        </option>
      ))}
    </>
  );
}

export default function WhitelistPage() {
  const toast = useToast();
  const [auto, setAuto] = useStoredFlag(AUTO_KEY);
  const { entries, loading, maintenance, reason, reload, mutate } = useWhitelist(auto);

  const [uid, setUid] = useState("");
  // The name the provider reads off the account. Never typed: the field
  // that shows it is disabled, and it is cleared whenever the UID
  // changes so a name can never be left standing against a different
  // number than the one it was fetched for.
  const [player, setPlayer] = useState("");
  const [looking, setLooking] = useState(false);
  // Set once the provider holds this UID, whether it was just verified
  // or was already on the list. It decides which call the ADD button
  // makes: an active UID is refused by a plain add and has to be
  // re-issued instead.

  const [region, setRegion] = useState<string>(DEFAULT_WHITELIST_REGION);
  const [days, setDays] = useState(String(DEFAULT_WHITELIST_DAYS));
  const [adding, setAdding] = useState(false);

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

  // Whether the provider already holds the UID being typed. Read from
  // the list rather than remembered from the last search: a flag set
  // by a search does not survive navigating away, and coming back to
  // press ADD with a stale `false` is how a plain add gets aimed at a
  // UID somebody already holds. The list is refetched; a memory is not.
  const onList = useMemo(
    () => entries.some((entry) => entry.uid === uid.trim()),
    [entries, uid],
  );

  const changeUid = (value: string) => {
    setUid(value.replace(/\D/g, ""));
    setPlayer("");
  };

  /**
   * Names the UID, at the cost of whitelisting it for a day.
   *
   * The provider sells names; it does not tell them. So the endpoint
   * buys a day and gives it straight back, and the UID is not left
   * whitelisted by having been looked at.
   *
   * The free answer is tried first: a UID already on the list carries
   * its verified name, and the provider would refuse a second add for
   * it anyway.
   */
  const lookup = async () => {
    const target = uid.trim();
    if (target.length < 6) {
      toast("Enter at least 6 digits first.", "error");
      return;
    }

    const known = entries.find((entry) => entry.uid === target);
    if (known) {
      setPlayer(known.name);
      toast(
        `${known.name || target} is already whitelisted${known.expireDate ? ` until ${known.expireDate}` : ""}. No credit spent.`,
        "success",
      );
      return;
    }

    setLooking(true);
    setPlayer("");
    try {
      const found = await postJson<LookupResult>("/api/uid-bypass/lookup", {
        uid: target,
        region,
      });
      setPlayer(found.name ?? "");
      // Anything that left a row behind has to be reflected, because
      // `onList` is read from the list and decides what ADD does next.
      if (found.alreadyWhitelisted || found.strayEntry || found.resetExisting) {
        await reload();
      }

      if (!found.name) {
        toast("The provider returned no name for that UID.", "error");
      } else if (found.resetExisting) {
        // The add landed on an entry that already existed, so its
        // validity is now a day. Removing it was refused -- deleting
        // somebody's customer to tidy up a search is the worse of the
        // two -- which leaves re-issuing it as the fix, and saying so.
        toast(
          `${found.name} was already whitelisted; its validity is now 1 day. Extend it to restore.`,
          "error",
        );
      } else if (found.strayEntry) {
        toast(
          `${found.name} — but the 1-day check entry could not be removed. Delete it from the list.`,
          "error",
        );
      } else {
        toast(`${found.name} — now choose the validity and press ADD UID.`, "success");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLooking(false);
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    const wanted = wantedDays(days);
    const target = uid.trim();
    try {
      const body = {
        uid: target,
        // What the panel showed at the point of sale. The provider
        // verifies the name again on its side, so keeping this is a
        // record of what was agreed, not a second source of truth.
        note: player.trim(),
        region,
        days: wanted,
      };
      // A UID the provider already holds is refused by a plain add, so
      // once it has been verified the second step is a re-issue.
      const result = onList
        ? await patchJson<AddResult>("/api/uid-bypass", body)
        : await postJson<AddResult>("/api/uid-bypass", body);
      setUid("");
      setPlayer("");
      setDays(String(DEFAULT_WHITELIST_DAYS));
      // The reply carries everything a card shows except who added it,
      // so the row can be drawn now and corrected by the reload behind
      // it rather than waited for.
      mutate((prev) => [
        {
          uid: target,
          name: result.name ?? body.note,
          region,
          note: body.note,
          expireDate: result.expireDate ?? "",
          createdBy: "",
        },
        ...prev.filter((row) => row.uid !== target),
      ]);
      void reload();
      toast(addedMessage(result, target, wanted), "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  };

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
  // work while the provider is unavailable.
  if (maintenance) return <MaintenanceNotice reason={reason} />;

  return (
    <>
      <Card className="mb-[30px]">
        <CardHeader
          title="Add New UID"
          subtitle="Whitelisted UIDs sync straight to the bypass service."
        />

        <form onSubmit={add} className="grid gap-5 md:grid-cols-2">
          <div>
            <FormLabel htmlFor="wl-uid">UID *</FormLabel>
            <div className="relative">
              <Input
                id="wl-uid"
                value={uid}
                onChange={(e) => changeUid(e.target.value)}
                placeholder="Enter UID"
                inputMode="numeric"
                autoComplete="off"
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => void lookup()}
                disabled={looking || uid.trim().length < 6}
                aria-label="Look up the player name for this UID"
                title="Look up the player name"
                className={cn(
                  "absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-lg p-2",
                  "text-muted transition-colors duration-200 hover:text-fg",
                  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-muted",
                )}
              >
                <SearchIcon className={cn("size-4", looking && "animate-pulse")} />
              </button>
            </div>
            {/* Worth saying plainly, because it is the opposite of how
                this worked before: the provider looks the UID up in the
                game and refuses one it cannot find. */}
            {/* Said plainly because the icon looks free and is not: the
                provider only reveals a name by selling the whitelist. */}
            <HelpText>
              Digits only, at least 6. Search spends a credit unless the UID is already on your
              list.
            </HelpText>
          </div>

          <div>
            <FormLabel htmlFor="wl-player">Player Name</FormLabel>
            {/* Green once there is a name: it is the one thing on this
                form read back from the game rather than typed, and the
                last chance to notice the wrong customer before paying.
                `disabled:opacity-100` undoes the dimming that would
                otherwise mute the very field being highlighted. */}
            <Input
              id="wl-player"
              value={looking ? "Searching…" : player}
              readOnly
              disabled
              placeholder="Press the search icon to fetch the name"
              className={cn(
                player && "font-semibold text-[#34d399] disabled:opacity-100",
              )}
            />
            <HelpText>
              {onList ? (
                <span className="font-semibold text-[#34d399]">
                  Verified. Choose the validity below and press ADD UID.
                </span>
              ) : (
                "Read from the game, not typed. Press the search icon beside the UID."
              )}
            </HelpText>
          </div>

          <div>
            <FormLabel htmlFor="wl-region">Server Region *</FormLabel>
            <Select
              id="wl-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <RegionOptions />
            </Select>
            <HelpText>
              The server the account plays on. A wrong one still spends a credit.
            </HelpText>
          </div>

          <DurationField id="wl-days" label="Whitelist Duration" value={days} onChange={setDays} />

          <div className="md:col-span-2">
            <PrimaryButton type="submit" disabled={adding || !isWhitelistDays(wantedDays(days))}>
              <CheckCircleIcon className="size-4" />
              {adding ? "ADDING…" : "ADD UID"}
            </PrimaryButton>
          </div>
        </form>
      </Card>

      <Card flat>
        <CardHeader
          title={`Whitelist Entries (${visible.length})`}
          subtitle={`${entries.length} total · ${expiredCount} expired`}
          className="flex-wrap"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search UID…"
                  className="w-[190px] py-2 pl-9 text-[13px]"
                  aria-label="Search whitelist"
                />
              </div>

              <TintButton
                tone="red"
                disabled={busy !== null || expiredCount === 0}
                onClick={() => void removeMany(entries.filter(isExpired))}
              >
                <TrashIcon className="size-[13px]" strokeWidth={2.5} />
                Delete Expired
              </TintButton>

              <TintButton
                tone="red"
                disabled={busy !== null || entries.length === 0}
                onClick={() => void removeMany(entries)}
              >
                <TrashIcon className="size-[13px]" strokeWidth={2.5} />
                Delete All
              </TintButton>

              <button
                type="button"
                onClick={() => setAuto(!auto)}
                aria-pressed={auto}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5",
                  "text-[12px] font-semibold transition-all duration-300 ease-smooth hover:-translate-y-0.5",
                  auto
                    ? "border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.1)] text-[#34d399]"
                    : "border-line bg-white/2 text-muted hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    auto ? "bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.9)]" : "bg-current",
                  )}
                />
                Auto
              </button>

              <TintButton tone="green" disabled={busy !== null} onClick={() => void reload()}>
                <RefreshIcon className="size-[13px]" />
                Refresh
              </TintButton>
            </div>
          }
        />

        {loading ? (
          <p className="py-10 text-center text-[13px] text-muted">Loading whitelist…</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">
            {entries.length === 0 ? "No UIDs whitelisted yet." : "No UID matches that search."}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
            {visible.map((entry) => (
              <EntryCard
                key={entry.uid}
                entry={entry}
                busy={busy === entry.uid || busy === "bulk"}
                onEdit={() => setEditing(entry)}
                onDelete={() => removeOne(entry)}
              />
            ))}
          </div>
        )}
      </Card>

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

function EntryCard({
  entry,
  busy,
  onEdit,
  onDelete,
}: {
  entry: WhitelistEntry;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const left = daysLeft(entry.expireDate);
  const expired = left !== null && left < 0;
  const soon = left !== null && left >= 0 && left <= 3;

  return (
    <div className="rounded-2xl border border-line bg-white/2 p-5 transition-colors duration-300 hover:border-line-hover">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[1px] text-muted uppercase">UID</span>
        <DotBadge tone={expired ? "red" : soon ? "blue" : "green"}>
          {expired ? "Expired" : "Active"}
        </DotBadge>
      </div>
      <div className="mb-4 font-mono text-[16px] font-bold break-all text-fg">{entry.uid}</div>

      <dl className="mb-3 grid grid-cols-2 gap-y-3 text-[11px]">
        <Field label="Player" value={entry.name || "—"} />
        <Field label="Region" value={entry.region} align="right" />
        <Field label="Note" value={entry.note || "—"} />
        <Field label="Added By" value={entry.createdBy || "—"} align="right" accent />
      </dl>

      <div className="mb-4 border-t border-dashed border-line pt-3">
        <span className="text-[10px] font-bold tracking-[1px] text-muted uppercase">Expire Date</span>
        <div className="font-mono text-[13px] font-semibold text-fg">{entry.expireDate || "—"}</div>
        {left !== null && (
          <div
            className={cn(
              "mt-0.5 text-[11px] font-semibold",
              expired ? "text-[#f87171]" : soon ? "text-[#60a5fa]" : "text-muted",
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="flex-1 cursor-pointer rounded-lg border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)] px-3 py-2 text-[12px] font-bold text-[#34d399] transition-all duration-300 hover:bg-[rgba(16,185,129,0.16)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Extend
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="flex-1 cursor-pointer rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] px-3 py-2 text-[12px] font-bold text-[#f87171] transition-all duration-300 hover:bg-[rgba(239,68,68,0.18)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  align = "left",
  accent = false,
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  accent?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <dt className="text-[10px] font-bold tracking-[1px] text-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "truncate text-[12px] font-semibold",
          accent ? "text-[#60a5fa]" : "text-fg",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function ExtendModal({
  entry,
  onClose,
  onDone,
  onError,
  extend,
}: {
  entry: WhitelistEntry;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
  extend: (body: {
    uid: string;
    note: string;
    region: string;
    days: number;
  }) => Promise<AddResult>;
}) {
  const [days, setDays] = useState(String(DEFAULT_WHITELIST_DAYS));
  const [note, setNote] = useState(entry.note);
  const [region, setRegion] = useState<string>(startingRegion(entry.region));
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const wanted = wantedDays(days);
    try {
      const result = await extend({
        uid: entry.uid,
        note: note.trim(),
        region,
        days: wanted,
      });
      await onDone(addedMessage(result, entry.uid, wanted));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Extend ${entry.uid}`}>
      <form onSubmit={submit}>
        {/* The provider has no update call and refuses a UID that is
            already active, so the only route is remove-then-add. Saying
            so up front matters: it spends a credit and it is not free of
            risk. */}
        <p className="mb-5 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] p-3 text-[12px] leading-relaxed text-orange">
          The provider has no edit action. This removes the UID and adds it
          back with the new validity, which spends a credit. If the re-add
          fails you will be told, and the UID will need adding again.
        </p>

        <div className="mb-4">
          <FormLabel htmlFor="ext-region">Server Region</FormLabel>
          <Select id="ext-region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <RegionOptions />
          </Select>
          {!isWhitelistRegion(entry.region) && (
            <HelpText>
              This entry predates per-region routing ({entry.region}). Re-issuing pins it to a real
              server.
            </HelpText>
          )}
        </div>

        <div className="mb-4">
          <FormLabel htmlFor="ext-note">Note</FormLabel>
          <Input
            id="ext-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Buyer reference or customer name"
            maxLength={40}
          />
          <HelpText>Your own reference. The player name comes back from the game.</HelpText>
        </div>

        <DurationField
          id="ext-days"
          label="New Duration"
          value={days}
          onChange={setDays}
          note="Counted from today, not added to the current expiry. 0 = Lifetime."
          className="mb-6"
        />

        <div className="flex justify-end gap-2">
          <TintButton type="button" tone="red" onClick={onClose} disabled={saving}>
            Cancel
          </TintButton>
          <TintButton
            type="submit"
            tone="green"
            disabled={saving || !isWhitelistDays(wantedDays(days))}
          >
            {saving ? "Re-issuing…" : "Re-issue UID"}
          </TintButton>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The validity picker: a free days field with one-tap presets under it.
 *
 * The field stays the source of truth -- a preset only writes into it --
 * so a custom count like 12 is as easy as a listed one, and what is
 * sent is always what is on screen. 0 is lifetime, and typing it is the
 * same as pressing the Lifetime chip.
 */
function DurationField({
  id,
  label,
  value,
  onChange,
  note,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  className?: string;
}) {
  const wanted = wantedDays(value);
  const valid = isWhitelistDays(wanted);

  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <FormLabel htmlFor={id} className="mb-0">
          {label} (Custom Days)
        </FormLabel>
        <span
          aria-live="polite"
          className={cn(
            "shrink-0 text-[12px] font-bold whitespace-nowrap",
            !valid
              ? "text-[#f87171]"
              : wanted === LIFETIME_WHITELIST_DAYS
                ? "text-purple"
                : "text-[#60a5fa] lt:text-blue-600",
          )}
        >
          {valid
            ? `${wanted === LIFETIME_WHITELIST_DAYS ? "\u{1F451}" : "\u{1F4C5}"} ${whitelistDaysLabel(wanted)}`
            : "Invalid"}
        </span>
      </div>

      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={`Days (1-${MAX_WHITELIST_DAYS}, 0 = Lifetime)`}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={!valid}
      />

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Duration presets">
        {WHITELIST_DAY_PRESETS.map((preset) => {
          const lifetime = preset === LIFETIME_WHITELIST_DAYS;
          const active = valid && wanted === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(String(preset))}
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-[12px] font-semibold",
                "transition-all duration-200 ease-smooth hover:-translate-y-px",
                lifetime
                  ? active
                    ? "border-purple bg-purple-glow text-purple shadow-[0_0_10px_rgba(168,85,247,0.35)]"
                    : "border-[rgba(168,85,247,0.45)] bg-white/2 text-purple hover:bg-purple-glow"
                  : active
                    ? "border-[rgba(96,165,250,0.6)] bg-[rgba(96,165,250,0.14)] text-[#60a5fa] lt:text-blue-600"
                    : "border-line bg-white/2 text-fg/85 hover:border-line-hover hover:text-fg",
              )}
            >
              {lifetime ? "\u{1F451} Lifetime (0)" : whitelistDaysLabel(preset)}
            </button>
          );
        })}
      </div>

      <HelpText>
        {valid ? (
          (note ?? "Type any custom days (e.g. 5, 12, 45) or pick a button. 0 = Lifetime.")
        ) : (
          <span className="font-semibold text-[#f87171]">
            Enter 1 to {MAX_WHITELIST_DAYS} days, or 0 for lifetime.
          </span>
        )}
      </HelpText>
    </div>
  );
}
