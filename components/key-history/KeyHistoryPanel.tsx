"use client";

import { RefreshIcon, TrashIcon } from "@/components/icons";
import { NeonButton, NeonPanel, PanelHeader } from "@/components/neon";
import { KeyHistoryAmbient, KeyHistoryEmblem } from "@/components/scenes/KeyHistoryScene";
import type { KeyRecord } from "@/lib/types";

import { KeyHistoryStats } from "./KeyHistoryStats";
import { KeyHistoryTable } from "./KeyHistoryTable";

/**
 * The one panel behind both key history pages: header with the hologram
 * and actions, the stat row, then the table. Each page keeps its own
 * wording, filter, clear scope and who may clear; this only lays it out.
 */
export function KeyHistoryPanel({
  title,
  subtitle,
  records,
  emptyText,
  onRefresh,
  onClear,
  showCreator,
  showCopy,
}: {
  title: string;
  subtitle: string;
  records: KeyRecord[];
  emptyText: string;
  onRefresh: () => void;
  /** Leave out to hide Clear History. */
  onClear?: () => void;
  showCreator?: boolean;
  showCopy?: boolean;
}) {
  return (
    <NeonPanel rim="violet" className="@container/khist">
      {/* Ambience behind the header and the stat row only, faded out
          before the table so it never sits under a key. Phones skip it:
          there the tiles stack and it would sit under text all the way. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[300px] overflow-hidden rounded-t-[24px] [mask-image:linear-gradient(180deg,#000_55%,transparent)] sm:block"
      >
        <KeyHistoryAmbient className="size-full" />
      </div>

      <div className="relative z-[1] grid grid-cols-[minmax(0,1fr)] gap-6">
        {/* Once the hologram fits, the row becomes three columns with
            equal outer ones, so it sits on the panel's centre line on both
            pages whatever the buttons beside it; narrower, the title and
            buttons wrap as any panel header does and the hologram goes. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 @[980px]/khist:grid @[980px]/khist:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <PanelHeader title={title} subtitle={subtitle} className="mb-0 min-w-[min(100%,240px)] flex-1" />
          {/* Negative margins let the hologram overhang the header row
              instead of doubling its height: clear of the panel's top rim,
              and its projector pad clear of the stat row under the gap. */}
          <div aria-hidden className="pointer-events-none -mt-5 -mb-5 hidden @[980px]/khist:block">
            <KeyHistoryEmblem className="h-[124px] w-[220px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 @[980px]/khist:justify-self-end">
            <NeonButton tone="cyan" icon={<RefreshIcon />} onClick={onRefresh}>
              Refresh History
            </NeonButton>
            {onClear ? (
              <NeonButton tone="red" icon={<TrashIcon />} onClick={onClear}>
                Clear History
              </NeonButton>
            ) : null}
          </div>
        </div>

        <KeyHistoryStats records={records} />

        <KeyHistoryTable
          records={records}
          emptyText={emptyText}
          showCreator={showCreator}
          showCopy={showCopy}
        />
      </div>
    </NeonPanel>
  );
}
