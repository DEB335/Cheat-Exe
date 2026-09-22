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
  DEFAULT_WHITELIST_REGION,
  MAX_WHITELIST_DAYS,
  WHITELIST_REGIONS,
  isWhitelistRegion,
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
    : `for ${days} day${days === 1 ? "" : "s"}`;
  return `${who} whitelisted ${until}.`;
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
  const { entries, loading, maintenance, reason, reload } = useWhitelist(auto);

  const [uid, setUid] = useState("");
  const [note, setNote] = useState("");
  const [region, setRegion] = useState<string>(DEFAULT_WHITELIST_REGION);
  const [days, setDays] = useState("");
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

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    const wanted = days.trim() === "" ? MAX_WHITELIST_DAYS : Number(days);
    const target = uid.trim();
    try {
      const result = await postJson<AddResult>("/api/uid-bypass", {
        uid: target,
        note: note.trim(),
        region,
        days: wanted,
      });
      setUid("");
      setNote("");
      setDays("");
      await reload();
      toast(addedMessage(result, target, wanted), "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  };

  const removeOne = async (entry: WhitelistEntry) => {
    const who = entry.name || entry.note;
    if (!confirm(`Remove UID ${entry.uid}${who ? ` (${who})` : ""} from the whitelist?`)) {
      return;
    }
    setBusy(entry.uid);
    try {
      const result = await del<{ existed?: boolean }>(
        `/api/uid-bypass?uid=${encodeURIComponent(entry.uid)}`,
      );
      await reload();
      toast(
        result.existed === false
          ? `UID ${entry.uid} was not on the provider's list. Cleared it here.`
          : `UID ${entry.uid} removed.`,
        "success",
      );
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Bulk delete.
   *
   * Upstream has no bulk endpoint, so this is a loop -- and a loop can
   * fail halfway. Every removal is counted separately and the summary
   * reports what actually happened rather than assuming the whole set
   * went through. UIDs the provider did not hold are counted apart from
   * the ones genuinely taken off it: both leave, but only one was there.
   */
  const removeMany = async (targets: WhitelistEntry[], label: string) => {
    if (targets.length === 0) return;
    if (!confirm(`${label} — ${targets.length} UID${targets.length === 1 ? "" : "s"}. This cannot be undone.`)) {
      return;
    }

    setBusy("bulk");
    let removed = 0;
    let stale = 0;
    const failed: string[] = [];

    for (const entry of targets) {
      try {
        const result = await del<{ existed?: boolean }>(
          `/api/uid-bypass?uid=${encodeURIComponent(entry.uid)}`,
        );
        if (result.existed === false) stale += 1;
        else removed += 1;
      } catch {
        failed.push(entry.uid);
      }
    }

    setBusy(null);
    await reload();

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
            <Input
              id="wl-uid"
              value={uid}
              onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter UID"
              inputMode="numeric"
              autoComplete="off"
              required
            />
            {/* Worth saying plainly, because it is the opposite of how
                this worked before: the provider looks the UID up in the
                game and refuses one it cannot find. */}
            <HelpText>
              Digits only, at least 6. The provider checks it against the game and answers with the
              player&apos;s name.
            </HelpText>
          </div>

          <div>
            <FormLabel htmlFor="wl-note">Note</FormLabel>
            <Input
              id="wl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Buyer reference or customer name"
              maxLength={40}
              autoComplete="off"
            />
            <HelpText>Your own reference. Stored as typed.</HelpText>
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

          <div>
            <FormLabel htmlFor="wl-days">Validity (Days)</FormLabel>
            <Input
              id="wl-days"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              placeholder={`Days (Max ${MAX_WHITELIST_DAYS})`}
              inputMode="numeric"
              autoComplete="off"
            />
            <HelpText>Leave empty for the {MAX_WHITELIST_DAYS}-day default.</HelpText>
          </div>

          <div className="md:col-span-2">
            <PrimaryButton type="submit" disabled={adding}>
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
                onClick={() => removeMany(entries.filter(isExpired), "Delete every expired UID")}
              >
                <TrashIcon className="size-[13px]" strokeWidth={2.5} />
                Delete Expired
              </TintButton>

              <TintButton
                tone="red"
                disabled={busy !== null || entries.length === 0}
                onClick={() => removeMany(entries, "Delete the entire whitelist")}
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
            await reload();
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
  const [days, setDays] = useState("");
  const [note, setNote] = useState(entry.note);
  const [region, setRegion] = useState<string>(startingRegion(entry.region));
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const wanted = days.trim() === "" ? MAX_WHITELIST_DAYS : Number(days);
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
        {/* The provider has no update call and refuses a duplicate add, so
            the only route is remove-then-add. Saying so up front matters:
            it spends a credit and it is not free of risk. */}
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

        <div className="mb-6">
          <FormLabel htmlFor="ext-days">New Validity (Days)</FormLabel>
          <Input
            id="ext-days"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
            placeholder={`Days (Max ${MAX_WHITELIST_DAYS})`}
            inputMode="numeric"
          />
          <HelpText>Counted from today, not added to the current expiry.</HelpText>
        </div>

        <div className="flex justify-end gap-2">
          <TintButton type="button" tone="red" onClick={onClose} disabled={saving}>
            Cancel
          </TintButton>
          <TintButton type="submit" tone="green" disabled={saving}>
            {saving ? "Re-issuing…" : "Re-issue UID"}
          </TintButton>
        </div>
      </form>
    </Modal>
  );
}
