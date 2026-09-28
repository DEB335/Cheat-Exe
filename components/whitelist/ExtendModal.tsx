"use client";

import { useState } from "react";

import { GlobeIcon } from "@/components/icons";
import { AlertTriangleIcon, EditIcon, NeonButton, NeonInput, NeonSelect } from "@/components/neon";
import { Modal } from "@/components/ui/Modal";
import { DEFAULT_WHITELIST_DAYS, isWhitelistDays, isWhitelistRegion } from "@/lib/packages";
import type { WhitelistEntry } from "@/lib/types";

import { DurationField, RegionOptions } from "./WhitelistFields";
import { addedMessage, startingRegion, wantedDays, type AddResult } from "./whitelist-shared";

/** Re-issues one UID with a new region, note and validity. */
export function ExtendModal({
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
    // Wider than the modal's default: the nine validity presets need
    // the room to sit in two rows rather than four. Capped at the
    // viewport less the overlay's padding and scrolled inside, because
    // on a short phone the form is taller than the screen and the
    // overlay itself does not scroll -- Re-issue would sit off screen.
    <Modal
      open
      onClose={onClose}
      title={`Extend ${entry.uid}`}
      className="max-h-[calc(100*var(--app-vh)-2rem)] max-w-[540px] overflow-y-auto max-sm:p-5"
    >
      <form onSubmit={submit}>
        {/* The provider has no update call and refuses a UID that is
            already active, so the only route is remove-then-add. Saying
            so up front matters: it spends a credit and it is not free of
            risk. */}
        <p className="mb-5 flex gap-2.5 rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-3 text-[13px] leading-relaxed text-orange">
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            The provider has no edit action. This removes the UID and adds it back with the new
            validity, which spends a credit. If the re-add fails you will be told, and the UID will
            need adding again.
          </span>
        </p>

        <NeonSelect
          id="ext-region"
          label="Server Region"
          leftIcon={<GlobeIcon />}
          leftIconStyle="tile"
          size="sm"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          help={
            isWhitelistRegion(entry.region)
              ? undefined
              : `This entry predates per-region routing (${entry.region}). Re-issuing pins it to a real server.`
          }
          className="mb-4"
        >
          <RegionOptions />
        </NeonSelect>

        <NeonInput
          id="ext-note"
          label="Note"
          leftIcon={<EditIcon />}
          leftIconStyle="tile"
          size="sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Buyer reference or customer name"
          maxLength={40}
          help="Your own reference. The player name comes back from the game."
          className="mb-4"
        />

        <DurationField
          id="ext-days"
          label="New Duration"
          value={days}
          onChange={setDays}
          note="Counted from today, not added to the current expiry. 0 = Lifetime."
          className="mb-6"
        />

        <div className="flex justify-end gap-2.5">
          <NeonButton tone="red" onClick={onClose} disabled={saving}>
            Cancel
          </NeonButton>
          <NeonButton
            type="submit"
            tone="green"
            variant="filled"
            loading={saving}
            disabled={!isWhitelistDays(wantedDays(days))}
          >
            {saving ? "Re-issuing…" : "Re-issue UID"}
          </NeonButton>
        </div>
      </form>
    </Modal>
  );
}
