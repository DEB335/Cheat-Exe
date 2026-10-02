"use client";

import { useMemo, useState } from "react";

import { CalendarIcon, CloseIcon, RefreshIcon, SearchIcon, ShieldCheckIcon, TrashIcon } from "@/components/icons";
import { NeonButton, NeonChip, NeonInput, NeonPanel, NeonStat, PanelHeader, RunIcon, XCircleIcon } from "@/components/neon";
import { VaultLockScene, VaultShieldScene } from "@/components/scenes/VaultScenes";
import { useToast } from "@/components/ui/Toast";
import { del } from "@/lib/client-api";
import { applyRemoveVaultEntry } from "@/lib/optimistic";
import { useDashboard } from "@/lib/store";

import { useKickCounts } from "./use-kick-counts";
import { VaultTable } from "./VaultTable";

const SEARCH_ID = "vault-search";

// Four across leaves each tile about 215px: a little less padding keeps
// "KICKED TODAY" whole instead of cut to "KICKED TO...".
const TIGHT_STAT = "@[1740px]/hero:gap-3.5 @[1740px]/hero:px-4";

/**
 * The kicked / banned accounts vault: the hero (shield, title, four
 * counts, the lock hologram, the actions) over the records table.
 *
 * The hero lays itself out by its own width, not the viewport's -- the
 * sidebar and the 75% desktop zoom make the viewport a poor guide to how
 * much room the panel really has. The holograms only appear once there
 * is room for them beside the text, so they never sit on a word or a
 * button.
 */
export function VaultPanel() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patchDb = useDashboard((s) => s.patch);
  const restoreDb = useDashboard((s) => s.restore);
  const banned = useDashboard((s) => s.db.cheatExeBannedUsers);
  const blocks = useDashboard((s) => s.db.cheatExeBans.length);
  const kicks = useKickCounts(banned);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banned;
    return banned.filter(
      (b) =>
        b.username.toLowerCase().includes(q) ||
        b.ip.toLowerCase().includes(q) ||
        b.device.toLowerCase().includes(q),
    );
  }, [banned, query]);

  const act = async (username: string, restore: boolean) => {
    const label = restore ? "Unban and restore" : "Delete the vault record for";
    if (!confirm(`${label} ${username}?`)) return;
    const snapshot = patchDb((db) => applyRemoveVaultEntry(db, username));
    toast(restore ? `${username} restored.` : `Record for ${username} deleted.`, "success");
    try {
      await del(`/api/banned/${encodeURIComponent(username)}${restore ? "?restore=1" : ""}`);
      void refresh();
    } catch (err) {
      restoreDb(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear the entire vault?")) return;
    try {
      await del("/api/banned");
      await refresh();
      toast("Vault cleared.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  // Closing the search also drops the query: a filter still applied
  // behind a hidden field would leave rows missing for no visible reason.
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <NeonPanel rim="pink">
      <div className="@container/hero relative">
        {/* Holograms. Each sits in its own box, drawn behind the text
            (content is z-10) and never taking the pointer. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[calc(50%-122px)] -left-3 hidden h-[230px] w-[220px] @[760px]/hero:block"
        >
          <VaultShieldScene className="size-full" />
        </div>
        {/* Between the stat row and the actions it is drawn a size down:
            its box then starts 26px inside the last stat tile, which is
            glass in light mode, and the scene keeps that strip empty. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 hidden h-[240px] w-[320px] @[1100px]/hero:block @[1740px]/hero:top-[calc(50%-120px)] @[1740px]/hero:right-[326px] @[1740px]/hero:bottom-auto @[1740px]/hero:h-[225px] @[1740px]/hero:w-[300px]"
        >
          <VaultLockScene className="size-full" />
        </div>

        <div className="relative z-10 @[760px]/hero:pl-[236px]">
          <PanelHeader
            className="items-start"
            titleAs="h2"
            title="Kicked / Banned Users Vault"
            badge={
              <NeonChip tone="pink" size="sm" icon={<XCircleIcon />}>
                Banned users
              </NeonChip>
            }
            subtitle="Accounts kicked from a session are suspended and listed here. Unban restores full access."
            actions={
              <>
                <NeonButton
                  tone="slate"
                  variant={searchOpen ? "filled" : "outline"}
                  icon={<SearchIcon />}
                  aria-expanded={searchOpen}
                  aria-controls={SEARCH_ID}
                  onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                >
                  Search user
                </NeonButton>
                <NeonButton
                  tone="teal"
                  icon={<RefreshIcon />}
                  onClick={async () => {
                    await refresh();
                    toast("Vault refreshed.", "success");
                  }}
                >
                  Refresh Vault
                </NeonButton>
                <NeonButton tone="pink" icon={<TrashIcon />} onClick={clearAll}>
                  Clear Vault
                </NeonButton>
              </>
            }
          />

          {/* Two across while the lock shares the row, four once there is
              room for them and the lock side by side. */}
          <div className="grid gap-4 @[560px]/hero:grid-cols-2 @[1100px]/hero:mr-[340px] @[1740px]/hero:mr-[600px] @[1740px]/hero:grid-cols-4">
            <NeonStat
              tone="pink"
              iconShape="tile"
              tintValue
              className={TIGHT_STAT}
              icon={<XCircleIcon />}
              label="Total Banned"
              value={banned.length}
            />
            <NeonStat
              tone="blue"
              iconShape="tile"
              tintValue
              className={TIGHT_STAT}
              icon={<RunIcon />}
              label="Kicked Today"
              value={kicks ? kicks.today : "—"}
            />
            <NeonStat
              tone="violet"
              iconShape="tile"
              tintValue
              className={TIGHT_STAT}
              icon={<CalendarIcon />}
              label="Last 7 Days"
              value={kicks ? kicks.week : "—"}
            />
            <NeonStat
              tone="teal"
              iconShape="tile"
              tintValue
              className={TIGHT_STAT}
              icon={<ShieldCheckIcon />}
              label="Block Rules"
              value={blocks}
            />
          </div>
        </div>
      </div>

      {searchOpen ? (
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* The ring sits on a wrapper of our own: NeonInput takes no
              children, and the compositor-turned track has to be one. */}
          <div className="glow-ring min-w-[min(100%,260px)] flex-1 rounded-[12px] hover:glow-ring-fast sm:max-w-[560px]">
            <NeonInput
              id={SEARCH_ID}
              autoFocus
              size="sm"
              tone="slate"
              aria-label="Search the vault by user, IP or device"
              placeholder="Search user/IP..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSearch();
              }}
              leftIcon={<SearchIcon />}
              rightSlot={
                <NeonButton
                  tone="slate"
                  variant="ghost"
                  size="xs"
                  aria-label="Close search"
                  title="Close search"
                  icon={<CloseIcon />}
                  onClick={closeSearch}
                />
              }
              className="w-full"
            />
            <span aria-hidden className="glow-ring-track" />
          </div>
          {/* Always rendered, so the live region is in place before the
              first keystroke and each new count is announced. */}
          <span aria-live="polite" className="text-[13px] text-[#a9b8e0] lt:text-slate-500">
            {query.trim() ? `${filtered.length} of ${banned.length} record${banned.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      ) : null}

      <VaultTable records={filtered} query={query} onAct={act} className="mt-6" />
    </NeonPanel>
  );
}
