"use client";

import { useMemo, useState } from "react";

import { GlobeIcon, SearchIcon, UserIcon, UserPlusIcon } from "@/components/icons";
import { NeonButton, NeonCta, NeonInput, NeonPanel, NeonSelect, PanelHeader, PlusCircleIcon } from "@/components/neon";
import { WhitelistScene } from "@/components/scenes/WhitelistScene";
import { useToast } from "@/components/ui/Toast";
import { patchJson, postJson } from "@/lib/client-api";
import { DEFAULT_WHITELIST_DAYS, DEFAULT_WHITELIST_REGION, isWhitelistDays } from "@/lib/packages";
import type { WhitelistEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DurationField, RegionOptions } from "./WhitelistFields";
import { addedMessage, wantedDays, type AddResult } from "./whitelist-shared";

type LookupResult = AddResult & {
  alreadyWhitelisted?: boolean;
  strayEntry?: boolean;
  resetExisting?: boolean;
};

/**
 * "Add New UID": look a UID's player up, pick a region and a validity,
 * and whitelist it.
 *
 * Owns the form's own state; the list it reads and paints into belongs
 * to the page, which hands over the entries and the two ways to change
 * them.
 */
export function AddUidPanel({
  entries,
  reload,
  mutate,
}: {
  entries: WhitelistEntry[];
  reload: () => Promise<void>;
  mutate: (updater: (prev: WhitelistEntry[]) => WhitelistEntry[]) => void;
}) {
  const toast = useToast();

  const [uid, setUid] = useState("");
  // The name the provider reads off the account. Never typed: the field
  // that shows it is disabled, and it is cleared whenever the UID
  // changes so a name can never be left standing against a different
  // number than the one it was fetched for.
  const [player, setPlayer] = useState("");
  const [looking, setLooking] = useState(false);

  const [region, setRegion] = useState<string>(DEFAULT_WHITELIST_REGION);
  const [days, setDays] = useState(String(DEFAULT_WHITELIST_DAYS));
  const [adding, setAdding] = useState(false);

  // Whether the provider already holds the UID being typed. Read from
  // the list rather than remembered from the last search: a flag set
  // by a search does not survive navigating away, and coming back to
  // press ADD with a stale `false` is how a plain add gets aimed at a
  // UID somebody already holds. The list is refetched; a memory is not.
  // It decides which call the ADD button makes: an active UID is
  // refused by a plain add and has to be re-issued instead.
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

  return (
    <NeonPanel rim="violet" className="mb-[30px]">
      {/* The hologram takes the panel's right-hand side from lg up, and
          the content keeps out of its way with matching right padding.
          Below lg there is no room beside the fields, so it goes. */}
      <WhitelistScene className="pointer-events-none absolute inset-y-0 right-0 my-auto hidden size-[300px] lg:block 2xl:size-[340px] min-[93.75rem]:size-[430px]" />

      <div className="relative z-10 lg:pr-[290px] 2xl:pr-[330px] min-[93.75rem]:pr-[400px]">
        <PanelHeader
          icon={<UserPlusIcon />}
          iconTone="violet"
          iconTone2="magenta"
          title="Add New UID"
          subtitle="Whitelisted UIDs sync straight to the bypass service."
        />

        {/* Two columns from md: UID over region on the left with ADD UID
            under them, the verified name over the validity on the right.
            The source order (UID, name, region, validity, ADD) is the
            order the sale happens in, so a phone's single column and
            the tab order both follow it. */}
        <form
          onSubmit={add}
          className="grid gap-x-8 gap-y-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          {/* Said plainly because the icon looks free and is not: the
              provider only reveals a name by selling the whitelist. */}
          <NeonInput
            id="wl-uid"
            label="UID *"
            leftIcon={<UserIcon />}
            leftIconStyle="tile"
            value={uid}
            onChange={(e) => changeUid(e.target.value)}
            placeholder="Enter UID"
            inputMode="numeric"
            autoComplete="off"
            required
            help="Digits only, at least 6. Search spends a credit unless the UID is already on your list."
            rightSlot={
              <NeonButton
                variant="ghost"
                tone="slate"
                onClick={() => void lookup()}
                loading={looking}
                disabled={uid.trim().length < 6}
                aria-label="Look up the player name for this UID"
                title="Look up the player name"
                icon={<SearchIcon />}
              />
            }
            className="md:col-start-1 md:row-start-1"
          />

          {/* Green once there is a name: it is the one thing on this
              form read back from the game rather than typed, and the
              last chance to notice the wrong customer before paying.
              `disabled:opacity-100` undoes the dimming that would
              otherwise mute the very field being highlighted. */}
          <NeonInput
            id="wl-player"
            label="Player Name"
            leftIcon={<UserIcon />}
            leftIconStyle="tile"
            value={looking ? "Searching…" : player}
            readOnly
            disabled
            placeholder="Press the search icon to fetch the name"
            // A size down on phones so the whole prompt fits the box; on
            // the narrowest it ends in an ellipsis rather than mid-word.
            inputClassName={cn(
              "text-ellipsis max-sm:placeholder:text-[12.5px]",
              player && "font-semibold text-[#34d399] disabled:opacity-100 lt:text-emerald-600",
            )}
            help={
              onList ? (
                <span className="font-semibold text-[#34d399] lt:text-emerald-600">
                  Verified. Choose the validity below and press ADD UID.
                </span>
              ) : (
                "Read from the game, not typed. Press the search icon beside the UID."
              )
            }
            className="md:col-start-2 md:row-start-1"
          />

          <NeonSelect
            id="wl-region"
            label="Server Region *"
            leftIcon={<GlobeIcon />}
            leftIconStyle="tile"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
            help="The server the account plays on. A wrong one still spends a credit."
            className="md:col-start-1 md:row-start-2"
          >
            <RegionOptions />
          </NeonSelect>

          <DurationField
            id="wl-days"
            label="Whitelist Duration"
            value={days}
            onChange={setDays}
            className="md:col-start-2 md:row-span-2 md:row-start-2"
          />

          <NeonCta
            type="submit"
            icon={<PlusCircleIcon />}
            loading={adding}
            disabled={!isWhitelistDays(wantedDays(days))}
            className="w-full sm:w-auto sm:justify-self-start md:col-start-1 md:row-start-3 md:min-w-[max(260px,55%)] md:self-end"
          >
            {adding ? "Adding…" : "Add UID"}
          </NeonCta>
        </form>
      </div>
    </NeonPanel>
  );
}
