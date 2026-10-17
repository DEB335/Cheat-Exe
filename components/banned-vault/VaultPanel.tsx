"use client";

import { useMemo, useState } from "react";

import { CalendarIcon, CloseIcon, RefreshIcon, SearchIcon, ShieldCheckIcon, TrashIcon } from "@/components/icons";
import { NeonButton, NeonChip, NeonInput, NeonPanel, PanelHeader, RunIcon, XCircleIcon } from "@/components/neon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { TintButton } from "@/components/ui/buttons";
import { del } from "@/lib/client-api";
import { applyRemoveVaultEntry } from "@/lib/optimistic";
import { useDashboard } from "@/lib/store";
import { cn } from "@/lib/utils";

import { useKickCounts } from "./use-kick-counts";
import { VaultTable } from "./VaultTable";

const SEARCH_ID = "vault-search";

/**
 * The kicked / banned accounts vault: the hero over the records table.
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

  const [clearVaultOpen, setClearVaultOpen] = useState(false);
  const [vaultActionTarget, setVaultActionTarget] = useState<{ username: string; restore: boolean } | null>(null);

  const act = (username: string, restore: boolean) => {
    setVaultActionTarget({ username, restore });
  };

  const handleConfirmVaultAction = async () => {
    if (!vaultActionTarget) return;
    const { username, restore } = vaultActionTarget;
    setVaultActionTarget(null);
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

  const handleConfirmClearVault = async () => {
    setClearVaultOpen(false);
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
    <NeonPanel rim="danger">
      <div className="@container/hero relative">
        <div className="relative z-10">
          <PanelHeader
            className="items-start"
            titleAs="h2"
            title="Kicked / Banned Users Vault"
            badge={
              <NeonChip tone="red" size="sm" icon={<XCircleIcon />}>
                Banned users
              </NeonChip>
            }
            subtitle="Accounts kicked from a session are suspended and listed here. Unban restores full access."
            actions={
              <>
                <button
                  type="button"
                  aria-expanded={searchOpen}
                  aria-controls={SEARCH_ID}
                  onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5",
                    "text-[12px] font-semibold transition-all duration-300 ease-smooth hover:-translate-y-0.5",
                    searchOpen
                      ? "border-[rgba(255,45,90,0.5)] bg-[rgba(255,45,90,0.2)] text-white shadow-[0_0_12px_rgba(255,31,90,0.3)]"
                      : "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] text-[#ffd1dc] hover:bg-[rgba(255,255,255,0.1)]",
                  )}
                >
                  <SearchIcon className="size-3" />
                  Search user
                </button>
                <TintButton
                  tone="green"
                  onClick={async () => {
                    await refresh();
                    toast("Vault refreshed.", "success");
                  }}
                >
                  <RefreshIcon className="size-3" />
                  Refresh Vault
                </TintButton>
                <TintButton tone="red" onClick={() => setClearVaultOpen(true)}>
                  <TrashIcon className="size-3" strokeWidth={2} />
                  Clear Vault
                </TintButton>
              </>
            }
          />

          {/* Clean 4-column stats grid matching Owner Key History / StatCard format */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              accent="red"
              icon={<XCircleIcon className="size-6" />}
              label="TOTAL BANNED"
              value={banned.length}
            />
            <StatCard
              accent="red"
              icon={<RunIcon className="size-6" />}
              label="KICKED TODAY"
              value={kicks ? kicks.today : 0}
            />
            <StatCard
              accent="red"
              icon={<CalendarIcon className="size-6" />}
              label="LAST 7 DAYS"
              value={kicks ? kicks.week : 0}
            />
            <StatCard
              accent="red"
              icon={<ShieldCheckIcon className="size-6" />}
              label="BLOCK RULES"
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

      {/* Centered Translucent Confirm Dialog for Clear Vault */}
      <ConfirmDialog
        isOpen={clearVaultOpen}
        title="Clear Banned Users Vault"
        description="Are you sure you want to permanently clear all kicked and banned account records from the vault? This cannot be undone."
        confirmText="Clear Vault"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmClearVault}
        onCancel={() => setClearVaultOpen(false)}
      />

      {/* Centered Translucent Confirm Dialog for Individual Record Action (Unban or Delete) */}
      <ConfirmDialog
        isOpen={Boolean(vaultActionTarget)}
        title={vaultActionTarget?.restore ? "Unban & Restore User" : "Delete Vault Record"}
        description={
          vaultActionTarget?.restore
            ? `Are you sure you want to unban and restore access for "${vaultActionTarget?.username}"?`
            : `Are you sure you want to delete the vault record for "${vaultActionTarget?.username}"?`
        }
        confirmText={vaultActionTarget?.restore ? "Restore Access" : "Delete Record"}
        cancelText="Cancel"
        variant={vaultActionTarget?.restore ? "primary" : "danger"}
        onConfirm={handleConfirmVaultAction}
        onCancel={() => setVaultActionTarget(null)}
      />
    </NeonPanel>
  );
}
