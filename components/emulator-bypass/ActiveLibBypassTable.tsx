"use client";

import { useMemo, useState } from "react";
import {
  CalendarIcon,
  ClockIcon,
  CopyIcon,
  GamepadIcon,
  KeyIcon,
  LockIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  UnlockIcon,
} from "@/components/icons";
import {
  NeonButton,
  NeonChip,
  NeonInput,
  NeonPanel,
  PanelHeader,
  SpinnerIcon,
  toneVars,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { del, patchJson, postJson } from "@/lib/client-api";
import { KeyHistoryAmbient, KeyHistoryEmblem } from "@/components/scenes/KeyHistoryScene";
import { useDashboard } from "@/lib/store";
import { cn, formatStampForDisplay } from "@/lib/utils";

function NeonTableCheckbox({
  checked,
  onChange,
  disabled,
  title,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={cn(
        "group relative inline-flex size-[17px] items-center justify-center rounded-[5px] border transition-all duration-200 cursor-pointer select-none",
        checked
          ? "border-red-500 bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.55)] scale-105"
          : "border-[#2b385e] bg-[#0c1228] text-transparent hover:border-red-400/80 hover:bg-[#121938] hover:shadow-[0_0_8px_rgba(239,68,68,0.25)]",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <svg
        className={cn(
          "size-3 text-white transition-all duration-150 stroke-[3.5]",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0 group-hover:opacity-25 text-red-400",
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </button>
  );
}

export function ActiveLibBypassTable() {
  const toast = useToast();
  const user = useDashboard((s) => s.user);
  const isOwner = user?.role === "OWNER";
  const refresh = useDashboard((s) => s.refresh);
  const keyHistory = useDashboard((s) => s.db.cheatExeKeyHistory);

  const [query, setQuery] = useState("");
  const [engineFilter, setEngineFilter] = useState<"ALL" | "V1" | "V2">("ALL");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // All Emulator Bypass / Lib Bypass keys
  const allEmulatorKeys = useMemo(() => {
    return keyHistory.filter((k) => k.package === "EMULATOR BYPASS");
  }, [keyHistory]);

  // Filtered keys by search and engine
  const displayedKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEmulatorKeys.filter((k) => {
      // Creator check: resellers only see their own keys
      if (!isOwner && user) {
        const me = user.username.toLowerCase();
        const c = (k.creator ?? "").toLowerCase();
        if (c !== me && !c.startsWith(`${me} `) && !c.startsWith(`${me}(`)) {
          return false;
        }
      }

      // Engine filter
      const eng = k.engine ?? "V2";
      if (engineFilter !== "ALL" && eng !== engineFilter) return false;

      // Query filter
      if (!q) return true;
      const keyStr = (k.key ?? "").toLowerCase();
      const noteStr = (k.note ?? "").toLowerCase();
      const creatorStr = (k.creator ?? "").toLowerCase();
      const nameStr = (k.keyName ?? "").toLowerCase();
      return (
        keyStr.includes(q) ||
        noteStr.includes(q) ||
        creatorStr.includes(q) ||
        nameStr.includes(q)
      );
    });
  }, [allEmulatorKeys, isOwner, user, engineFilter, query]);

  // Checkbox select all
  const allSelected = displayedKeys.length > 0 && selectedKeys.length === displayedKeys.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(displayedKeys.map((k) => k.key));
    }
  };

  const toggleSelectOne = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Toggle HWID Lock / Unlock (matching KeyHistoryTable)
  const handleToggleHwid = async (key: string, currentLocked: boolean) => {
    if (togglingKey === key) return;
    setTogglingKey(key);
    try {
      await postJson("/api/keys/lock", {
        key,
        locked: !currentLocked,
      });
      toast(
        !currentLocked
          ? `HWID locked for ${key}. Key bound to device hardware.`
          : `HWID unlocked for ${key}. Device binding freed.`,
        "success",
      );
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setTogglingKey(null);
    }
  };

  // Delete dialog state
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Reset HWID action
  const handleResetHwid = async (key: string) => {
    setActingKey(key);
    try {
      await patchJson("/api/emulator-bypass/keys", { key });
      toast(`Reset HWID device binding for ${key}.`, "success");
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setActingKey(null);
    }
  };

  // Delete single key
  const confirmDeleteKey = async () => {
    if (!deleteTargetKey) return;
    const key = deleteTargetKey;
    setDeleteTargetKey(null);
    setActingKey(key);
    try {
      await del(`/api/emulator-bypass/keys?key=${encodeURIComponent(key)}`);
      toast(`Deleted Lib Bypass key ${key}.`, "success");
      setSelectedKeys((prev) => prev.filter((k) => k !== key));
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setActingKey(null);
    }
  };

  // Bulk delete selected
  const confirmBulkDelete = async () => {
    setShowBulkConfirm(false);
    if (selectedKeys.length === 0) return;

    let deletedCount = 0;
    for (const key of selectedKeys) {
      try {
        await del(`/api/emulator-bypass/keys?key=${encodeURIComponent(key)}`);
        deletedCount++;
      } catch {
        // continue
      }
    }
    toast(`Deleted ${deletedCount} of ${selectedKeys.length} keys.`, "success");
    setSelectedKeys([]);
    void refresh();
  };

  return (
    <div className="w-full">
      <NeonPanel rim="danger" className="@container/khist relative">
        {/* Ambient lighting at the top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[260px] overflow-hidden rounded-t-[24px] [mask-image:linear-gradient(180deg,#000_55%,transparent)] sm:block"
        >
          <KeyHistoryAmbient className="size-full" />
        </div>

        <div className="relative z-[1] mb-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-4 @[1050px]/khist:grid @[1050px]/khist:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Title & subtitle without the gamepad icon */}
          <div className="min-w-0">
            <h3 className="font-display text-[21px] leading-tight font-bold text-white sm:text-[25px] lt:text-slate-900">
              Emulator Bypass Key History
            </h3>
            <p className="mt-1.5 text-[14px] leading-snug text-[#a9b8e0] sm:text-[15px] lt:text-slate-500">
              Sensix V2 direct server keys and client activations
            </p>
          </div>

          {/* 3D Hologram Key Emblem centered in the middle */}
          <div aria-hidden className="pointer-events-none -my-6 hidden justify-self-center @[1050px]/khist:block">
            <KeyHistoryEmblem className="h-[120px] w-[210px]" />
          </div>

          {/* Actions on the right */}
          <div className="flex flex-wrap items-center justify-end justify-self-end gap-2.5">
            {/* Search Box Matching Whitelist Page */}
            <div className="relative w-full sm:w-[220px]">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-[#9fb0dd] lt:text-slate-400"
              />
              <NeonInput
                tone="red"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search License Key…"
                aria-label="Search keys"
                boxClassName="h-9 rounded-full"
                inputClassName="pl-10 text-[13.5px]"
              />
            </div>

            {/* Engine Filter Pills: ALL, then V1, then V2 as requested */}
            <NeonButton
              tone="blue"
              variant={engineFilter === "ALL" ? "filled" : "outline"}
              size="sm"
              onClick={() => setEngineFilter("ALL")}
            >
              ALL
            </NeonButton>

            <NeonButton
              tone="amber"
              variant={engineFilter === "V1" ? "filled" : "outline"}
              size="sm"
              onClick={() => setEngineFilter("V1")}
            >
              ⚡ V1
            </NeonButton>

            <NeonButton
              tone="pink"
              variant={engineFilter === "V2" ? "filled" : "outline"}
              size="sm"
              onClick={() => setEngineFilter("V2")}
            >
              🚀 V2
            </NeonButton>

            {/* Bulk Delete Button */}
            {selectedKeys.length > 0 && (
              <NeonButton
                tone="red"
                size="sm"
                icon={<TrashIcon />}
                onClick={() => setShowBulkConfirm(true)}
              >
                Delete ({selectedKeys.length})
              </NeonButton>
            )}

            {/* Refresh Button with GREEN Neon tone */}
            <NeonButton
              tone="green"
              size="sm"
              icon={<RefreshIcon />}
              onClick={() => {
                void refresh();
                toast("Refreshed Lib Bypass keys.", "success");
              }}
            >
              Refresh
            </NeonButton>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d1e]/80">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-[#0c1228] text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                <th className="w-10 px-4 py-3.5 text-center">
                  <NeonTableCheckbox
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={displayedKeys.length === 0}
                    ariaLabel="Select all keys"
                    title={allSelected ? "Deselect all" : "Select all"}
                  />
                </th>
                <th className="px-4 py-3.5">LICENSE KEY</th>
                <th className="px-4 py-3.5">ENGINE</th>
                <th className="px-4 py-3.5">VALIDITY / EXPIRY</th>
                <th className="px-4 py-3.5">HWID</th>
                <th className="px-4 py-3.5">CREATED BY</th>
                <th className="px-4 py-3.5">NOTE</th>
                <th className="px-4 py-3.5">CREATED ON</th>
                <th className="px-4 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
              {displayedKeys.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">🔍</span>
                      <p className="text-sm">No Lib Bypass license keys found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedKeys.map((record) => {
                  const isSelected = selectedKeys.includes(record.key);
                  const eng = record.engine ?? "V2";
                  const isV2 = eng === "V2";
                  const locked = record.hwidLock !== false;
                  const hwidTone = locked ? "teal" : "amber";
                  const isToggling = togglingKey === record.key;

                  return (
                    <tr
                      key={record.key}
                      className={cn(
                        "transition-colors hover:bg-white/[0.03]",
                        isSelected && "bg-red-500/[0.06]",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <NeonTableCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelectOne(record.key)}
                          ariaLabel={`Select key ${record.key}`}
                          title={isSelected ? "Deselect" : "Select"}
                        />
                      </td>

                      {/* License Key Cell matching Screenshot 1 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {/* Dot indicator */}
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full bg-[#3ee88a] shadow-[0_0_5px_rgba(62,232,138,0.4)]"
                          />
                          {/* Key Icon */}
                          <KeyIcon
                            aria-hidden
                            className="size-[17px] shrink-0 text-[#a78bfa] drop-shadow-[0_0_5px_rgba(167,139,250,0.22)] lt:text-violet-600"
                          />
                          {/* Monospace bright green key text */}
                          <span className="font-mono text-xs font-bold text-[#6ef3a5] select-all tracking-wider">
                            {record.key}
                          </span>
                          {record.banned ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-[linear-gradient(180deg,rgba(239,68,68,0.28),rgba(239,68,68,0.1))] px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider text-rose-300 shadow-[0_0_8px_rgba(239,68,68,0.25)] select-none">
                              <span className="size-1.5 rounded-full bg-rose-400 shadow-[0_0_4px_#f43f5e]" />
                              BANNED
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Engine Badge matching Package Chip in Screenshot 1 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <NeonChip
                          tone={isV2 ? "pink" : "amber"}
                          size="sm"
                          shape="tag"
                          icon={<span className="text-xs">{isV2 ? "🚀" : "⚡"}</span>}
                        >
                          {eng}
                        </NeonChip>
                      </td>

                      {/* Validity / Expiry Cell matching Screenshot 1 with Clock Icon */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-bold text-xs text-[#5ef59a]">
                          <ClockIcon aria-hidden className="size-4 shrink-0 text-[#3ee88a]" />
                          <span>{record.appliedDays ?? record.duration ?? 30} Days</span>
                          {record.expiry ? (
                            <span className="font-semibold text-[#5ef59a]">
                              ({record.expiry})
                            </span>
                          ) : null}
                        </span>
                      </td>

                      {/* HWID Toggle Pill matching Screenshot 1 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={locked}
                          aria-label={`HWID lock for ${record.key}`}
                          onClick={() => handleToggleHwid(record.key, locked)}
                          disabled={isToggling}
                          title={
                            locked
                              ? "Locked to first hardware. Click to unlock."
                              : "Unlocked. Click to lock to hardware."
                          }
                          style={toneVars(hwidTone)}
                          className={cn(
                            "group/hwid inline-flex cursor-pointer rounded-full align-middle",
                            "disabled:cursor-wait disabled:opacity-70",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))]",
                          )}
                        >
                          <NeonChip
                            tone={hwidTone}
                            shape="pill"
                            icon={
                              isToggling ? (
                                <SpinnerIcon />
                              ) : locked ? (
                                <LockIcon aria-hidden />
                              ) : (
                                <UnlockIcon aria-hidden />
                              )
                            }
                            className={cn(
                              "transition-[border-color,box-shadow] duration-200",
                              "group-hover/hwid:border-[rgb(var(--tone-hi))] group-hover/hwid:shadow-[0_0_9px_-2px_rgba(var(--tone),0.48),inset_0_1px_0_rgba(255,255,255,0.12)]",
                            )}
                          >
                            {locked ? "Locked" : "Unlocked"}
                          </NeonChip>
                        </button>
                      </td>

                      {/* Created By Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {(() => {
                          const creatorStr = record.creator || "Owner (OWNER)";
                          const isOwnerCreator =
                            creatorStr.toLowerCase().includes("owner") ||
                            creatorStr.toLowerCase() === "cheat exe" ||
                            creatorStr.toLowerCase() === "admin";
                          return isOwnerCreator ? (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300 text-xs font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                              <span>👑</span>
                              <span>{creatorStr.includes("OWNER") ? creatorStr : "Owner (OWNER)"}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-purple-300 text-xs font-semibold shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                              <span>👤</span>
                              <span>{creatorStr}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-300">
                        {record.note || "Lib Bypass Client [V2 Sensix]"}
                      </td>

                      {/* Created On matching Screenshot 1 */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-300">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <CalendarIcon aria-hidden className="size-4 shrink-0 text-[#a78bfa] lt:text-violet-600" />
                          <span>{formatStampForDisplay(record.date || "")}</span>
                        </span>
                      </td>

                      {/* Actions: Copy, Reset HWID, and Delete (All uniform NeonButton with matching animation and size) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Copy Button (Blue) */}
                          <NeonButton
                            tone="blue"
                            size="sm"
                            icon={<CopyIcon className="size-3.5" />}
                            onClick={async () => {
                              await navigator.clipboard.writeText(record.key);
                              toast(`Key ${record.key} copied to clipboard!`, "success");
                            }}
                            title="Copy Key"
                          >
                            Copy
                          </NeonButton>

                          {/* Reset HWID Button (Cyan) */}
                          <NeonButton
                            tone="cyan"
                            size="sm"
                            icon={
                              <RefreshIcon
                                className={cn(
                                  "size-3.5",
                                  actingKey === record.key && "animate-spin",
                                )}
                              />
                            }
                            onClick={() => handleResetHwid(record.key)}
                            disabled={actingKey === record.key}
                            title="Reset HWID Hardware Binding"
                          >
                            Reset
                          </NeonButton>

                          {/* Delete Key Button (Red) */}
                          <NeonButton
                            tone="red"
                            size="sm"
                            icon={<TrashIcon className="size-3.5" />}
                            onClick={() => setDeleteTargetKey(record.key)}
                            disabled={actingKey === record.key}
                            title="Delete Key"
                          >
                            Delete
                          </NeonButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </NeonPanel>

      {/* Centered Translucent Confirm Dialog for Single Key Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetKey)}
        title="Delete Lib Bypass Key"
        description={`Are you sure you want to delete license key "${deleteTargetKey}"? This will terminate and remove it from the upstream Sensix engine permanently.`}
        confirmText="Delete Key"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteKey}
        onCancel={() => setDeleteTargetKey(null)}
      />

      {/* Centered Translucent Confirm Dialog for Bulk Deletion */}
      <ConfirmDialog
        isOpen={showBulkConfirm}
        title="Delete Selected Keys"
        description={`Are you sure you want to delete ${selectedKeys.length} selected Lib Bypass key(s)? This action cannot be reversed.`}
        confirmText={`Delete ${selectedKeys.length} Keys`}
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkConfirm(false)}
      />
    </div>
  );
}
