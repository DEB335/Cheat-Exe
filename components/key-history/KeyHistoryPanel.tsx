"use client";

import { RefreshIcon, TrashIcon } from "@/components/icons";
import { NeonPanel, PanelHeader } from "@/components/neon";
import { KeyHistoryAmbient, KeyHistoryEmblem } from "@/components/scenes/KeyHistoryScene";
import { TintButton } from "@/components/ui/buttons";
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
    <NeonPanel rim="danger" className="@container/khist">
      <div className="relative z-[1] grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4">
          <PanelHeader title={title} subtitle={subtitle} className="mb-0 min-w-[min(100%,240px)] flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <TintButton tone="green" onClick={onRefresh}>
              <RefreshIcon className="size-3" />
              Refresh History
            </TintButton>
            {onClear ? (
              <TintButton tone="red" onClick={onClear}>
                <TrashIcon className="size-3" strokeWidth={2} />
                Clear History
              </TintButton>
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
