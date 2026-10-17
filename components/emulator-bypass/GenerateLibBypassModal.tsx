"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyIcon, LockIcon, XSquareIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { patchDb, useDashboard } from "@/lib/store";
import type { KeyRecord } from "@/lib/types";
import { cn, isCreatorMatch } from "@/lib/utils";

const ALL_PRESET_DAYS = [1, 3, 7, 30, 60, 90, 180, 365];

interface GenerateLibBypassModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (key: string) => void;
}

export function GenerateLibBypassModal({
  open,
  onClose,
  onSuccess,
}: GenerateLibBypassModalProps) {
  const toast = useToast();
  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);
  const refresh = useDashboard((s) => s.refresh);
  const isOwner = user?.role === "OWNER";

  // Dynamic Engine maintenance calculation
  const maint = db.emulatorBypassMaintenance;
  const isV2Maintenance = maint?.v2Maintenance !== undefined 
    ? Boolean(maint.v2Maintenance) 
    : Boolean(maint?.active && (maint?.engine === "V2" || maint?.engine === "ALL"));
  const isV1Maintenance = maint?.v1Maintenance !== undefined 
    ? Boolean(maint.v1Maintenance) 
    : true;

  // Selected engine: points to whichever engine is active
  const [engine, setEngine] = useState<"V1" | "V2">(() => {
    if (!isV2Maintenance) return "V2";
    if (!isV1Maintenance) return "V1";
    return "V2";
  });

  useEffect(() => {
    if (isV2Maintenance && !isV1Maintenance && engine === "V2") {
      setEngine("V1");
    } else if (isV1Maintenance && !isV2Maintenance && engine === "V1") {
      setEngine("V2");
    }
  }, [isV1Maintenance, isV2Maintenance, engine]);

  // Key Name / Username input
  const [keyName, setKeyName] = useState("");

  // Allowed days from live reseller record or user session or all for owner
  const allowedDays = useMemo(() => {
    if (isOwner) return ALL_PRESET_DAYS;
    const record = Object.entries(db.cheatExeUsers).find(
      ([name]) => name.toLowerCase() === user?.username.toLowerCase(),
    )?.[1];
    return record?.emulatorAllowedDays ?? user?.emulatorAllowedDays ?? [1, 3, 7];
  }, [isOwner, user?.username, user?.emulatorAllowedDays, db.cheatExeUsers]);

  // Selected duration
  const [days, setDays] = useState<number>(30);
  const [customDaysInput, setCustomDaysInput] = useState("30");

  // Number of keys (fixed 1 with anti-flood rule)
  const [keyCount] = useState("1");

  // Locked note
  const lockedNote = "Lib Bypass Client";

  // HWID lock
  const [hwidLock, setHwidLock] = useState(true);

  // Cooldown / Anti-flood timer (30 seconds)
  const [cooldown, setCooldown] = useState(0);

  // Generation status
  const [generating, setGenerating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setEngine("V2");
      setKeyName("");
      setDays(allowedDays.includes(30) ? 30 : allowedDays[0] ?? 1);
      setCustomDaysInput(String(allowedDays.includes(30) ? 30 : allowedDays[0] ?? 1));
      setHwidLock(true);
      setCreatedKey(null);
    }
  }, [open, allowedDays]);

  // Track how many emulator bypass keys have been generated
  const usedCredits = useMemo(() => {
    if (!user) return 0;
    const isOwnerRole = user.role === "OWNER";
    const historyUsed = db.cheatExeKeyHistory.filter((k) => {
      if (k.package !== "EMULATOR BYPASS") return false;
      if (isOwnerRole) return true;
      return isCreatorMatch(k.creator, user.username);
    }).length;
    if (isOwnerRole) return historyUsed;
    const record = Object.entries(db.cheatExeUsers).find(
      ([name]) => name.toLowerCase() === user.username.toLowerCase(),
    )?.[1];
    return Math.max(record?.emulatorCreditsUsed ?? user.emulatorCreditsUsed ?? 0, historyUsed);
  }, [user, db.cheatExeKeyHistory, db.cheatExeUsers]);

  // Total credits display
  const totalCreditsDisplay = useMemo(() => {
    if (isOwner) return "Unlimited";
    if (!user) return 0;
    const record = Object.entries(db.cheatExeUsers).find(
      ([name]) => name.toLowerCase() === user.username.toLowerCase(),
    )?.[1];
    const totalCredits = record?.emulatorCredits ?? user.emulatorCredits ?? 0;
    if (totalCredits <= 0) return "Unlimited";
    return Math.max(0, totalCredits - usedCredits);
  }, [isOwner, user, db.cheatExeUsers, usedCredits]);

  const usesDisplay = useMemo(() => {
    return String(usedCredits);
  }, [usedCredits]);

  if (!open) return null;

  const handleSelectPreset = (d: number) => {
    if (!allowedDays.includes(d)) {
      toast(`${d} Days preset is locked for your account.`, "error");
      return;
    }
    setDays(d);
    setCustomDaysInput(String(d));
  };

  const handleCustomDaysChange = (val: string) => {
    setCustomDaysInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setDays(num);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (engine === "V1" && isV1Maintenance) {
      toast("Version 1 (V1) is currently under maintenance. Please use Version 2.", "error");
      return;
    }

    if (engine === "V2" && isV2Maintenance) {
      toast("Version 2 (V2) is currently under maintenance. Please use Version 1.", "error");
      return;
    }

    if (cooldown > 0) {
      toast(`Anti-Flood cooldown active. Please wait ${cooldown}s.`, "error");
      return;
    }

    if (!keyName.trim()) {
      toast("Please enter a Key Name or Username.", "error");
      return;
    }

    if (!allowedDays.includes(days) && !isOwner) {
      toast(`Duration ${days} Days is restricted for your account.`, "error");
      return;
    }

    if (!isOwner && typeof totalCreditsDisplay === "number" && totalCreditsDisplay <= 0) {
      toast("Insufficient Emulator Bypass credits remaining.", "error");
      return;
    }

    setGenerating(true);
    try {
      const res = await postJson<{ success: boolean; key: string }>(
        "/api/emulator-bypass/generate",
        {
          keyName: keyName.trim(),
          days,
          engine,
          note: `Lib Bypass Client [${engine === "V2" ? "V2 Sensix" : "V1 Bot"}]`,
          hwidLock,
        },
      );

      const generatedKey = res.key;
      const clientStamp = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const expDate = new Date(Date.now() + days * 86_400_000);
      const expY = expDate.getFullYear();
      const expM = String(expDate.getMonth() + 1).padStart(2, "0");
      const expD = String(expDate.getDate()).padStart(2, "0");
      const expH = String(expDate.getHours()).padStart(2, "0");
      const expMin = String(expDate.getMinutes()).padStart(2, "0");
      const formattedExpiry = `${expY}-${expM}-${expD} ${expH}:${expMin}`;

      const newRecord: KeyRecord = {
        key: generatedKey,
        keyName: keyName.trim().toUpperCase() || generatedKey,
        package: "EMULATOR BYPASS",
        engine,
        duration: String(days),
        appliedDays: days,
        expiry: formattedExpiry,
        creator: isOwner ? "Owner (OWNER)" : `${user?.username ?? ""} (RESELLER)`,
        note: `Lib Bypass Client [${engine === "V2" ? "V2 Sensix" : "V1 Bot"}]`,
        date: clientStamp,
        hwidLock,
      };

      patchDb((currentDb) => ({
        ...currentDb,
        cheatExeKeyHistory: [newRecord, ...currentDb.cheatExeKeyHistory.filter((k) => k.key !== generatedKey)],
      }));

      setCreatedKey(generatedKey);
      setCooldown(30);
      toast(`Successfully generated Lib Bypass Key: ${generatedKey}!`, "success");
      void refresh();
      if (onSuccess) onSuccess(generatedKey);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#060812]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-[580px] rounded-2xl border border-[#232b45] bg-[#0c1020] p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] z-10 text-slate-100 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl text-amber-400">⚡</span>
            <h3 className="text-[17px] font-bold text-white tracking-wide">
              Generate Lib Bypass License Keys
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span className="text-lg leading-none">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Engine Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              SELECT BYPASS ENGINE VERSION <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Version 1 (V1) */}
              <button
                type="button"
                disabled={isV1Maintenance}
                onClick={() => setEngine("V1")}
                className={cn(
                  "relative flex flex-col items-start rounded-xl border-2 p-3.5 text-left select-none transition duration-200",
                  isV1Maintenance
                    ? "border-white/5 bg-[#121628]/60 opacity-55 cursor-not-allowed"
                    : engine === "V1"
                      ? "border-red-500 bg-[#161b32] shadow-[0_0_20px_rgba(239,68,68,0.22)] cursor-pointer"
                      : "border-white/10 bg-[#101424] hover:border-slate-500 cursor-pointer",
                )}
                title={isV1Maintenance ? "Version 1 is under maintenance" : "Select Version 1"}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⚡</span>
                    <span className="text-[13.5px] font-bold text-slate-200">Version 1 (V1)</span>
                  </div>
                  {isV1Maintenance ? (
                    <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Maintenance
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <span className={cn("mt-1 text-[11.5px] font-medium", isV1Maintenance ? "text-slate-400" : "text-slate-300")}>
                  Discord Bot Engine
                </span>
              </button>

              {/* Version 2 (V2) */}
              <button
                type="button"
                disabled={isV2Maintenance}
                onClick={() => setEngine("V2")}
                className={cn(
                  "relative flex flex-col items-start rounded-xl border-2 p-3.5 text-left select-none transition duration-200",
                  isV2Maintenance
                    ? "border-white/5 bg-[#121628]/60 opacity-55 cursor-not-allowed"
                    : engine === "V2"
                      ? "border-red-500 bg-[#161b32] shadow-[0_0_20px_rgba(239,68,68,0.22)] cursor-pointer"
                      : "border-white/10 bg-[#101424] hover:border-slate-500 cursor-pointer",
                )}
                title={isV2Maintenance ? "Version 2 is under maintenance" : "Select Version 2"}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">🚀</span>
                    <span className="text-[13.5px] font-bold text-white">Version 2 (V2)</span>
                  </div>
                  {isV2Maintenance ? (
                    <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Maintenance
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <span className={cn("mt-1 text-[11.5px] font-medium", isV2Maintenance ? "text-slate-400" : "text-slate-300")}>
                  Sensix Direct Server Engine
                </span>
              </button>
            </div>
          </div>

          {/* Credits & 24h Speed info strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-[#11162a]/70 px-4 py-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">⚡</span>
              <span>Total Credits:</span>
              <strong className="text-emerald-400 font-bold">{totalCreditsDisplay}</strong>
            </div>
            <div className="h-3.5 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-sky-400">📊</span>
              <span>Uses:</span>
              <strong className="text-sky-400 font-bold">{usesDisplay}</strong>
            </div>
          </div>

          {/* Key Name / Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <span>🔑</span>
              <span>KEY NAME / USERNAME</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Enter Key Name / Username"
              className="w-full rounded-xl border border-[#222b46] bg-[#090d1c] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
            />
          </div>

          {/* Duration (Custom Days) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                DURATION (CUSTOM DAYS)
              </label>
              <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                <span>📅</span> {days} Days
              </span>
            </div>

            <input
              type="number"
              min={1}
              max={365}
              value={customDaysInput}
              onChange={(e) => handleCustomDaysChange(e.target.value)}
              className="w-full rounded-xl border border-[#222b46] bg-[#090d1c] px-4 py-2.5 text-sm font-bold text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
            />

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
              {ALL_PRESET_DAYS.map((d) => {
                const isPermitted = allowedDays.includes(d);
                const isSelected = days === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!isPermitted}
                    onClick={() => handleSelectPreset(d)}
                    title={isPermitted ? `${d} Days` : "Locked for your account"}
                    className={cn(
                      "relative flex items-center justify-center rounded-lg border py-2 px-1 text-[11.5px] font-bold transition select-none",
                      isSelected && isPermitted
                        ? "border-transparent bg-[#f43f5e] text-white shadow-md shadow-rose-500/25"
                        : isPermitted
                          ? "border-[#202842] bg-[#12172b] text-slate-300 hover:border-slate-500 hover:text-white"
                          : "border-white/5 bg-[#090d1a] text-slate-600 opacity-40 cursor-not-allowed grayscale",
                    )}
                  >
                    {!isPermitted && (
                      <span className="absolute top-0.5 right-0.5 text-[8px] text-red-400 leading-none">🔒</span>
                    )}
                    {d} {d === 1 ? "Day" : "Days"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Number of Keys & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                NUMBER OF KEYS
              </label>
              <input
                type="number"
                readOnly
                disabled
                value={keyCount}
                className="w-full rounded-xl border border-[#222b46] bg-[#090d1c] px-4 py-2.5 text-sm font-bold text-white outline-none cursor-not-allowed disabled:opacity-85"
              />
              <p className="text-[10.5px] text-amber-400/90 leading-tight flex items-start gap-1">
                <span>🔒</span>
                <span>Anti-Flood Rule: 1 key per generation (30-sec cooldown between keys).</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                NOTE / REFERENCE
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={lockedNote}
                className="w-full rounded-xl border border-[#222b46] bg-[#090d1c]/80 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed outline-none select-none disabled:opacity-85"
              />
            </div>
          </div>

          {/* HWID Lock Checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={hwidLock}
              onChange={(e) => setHwidLock(e.target.checked)}
              className="size-4 rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-200">
              Lock to first device HWID upon activation
            </span>
          </label>

          {/* Result Key Box if created */}
          {createdKey && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                  Key Created Successfully
                </span>
                <div className="font-mono text-sm font-bold text-white select-all">
                  {createdKey}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey);
                  toast("Key copied to clipboard!", "success");
                }}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition flex items-center gap-1.5"
              >
                <CopyIcon className="size-3.5" />
                Copy
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-transparent px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={generating || cooldown > 0}
              className={cn(
                "rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-lg transition flex items-center gap-2 select-none",
                cooldown > 0
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/25 active:scale-[0.98]",
              )}
            >
              <span>🚀</span>
              <span>
                {generating
                  ? "Generating..."
                  : cooldown > 0
                    ? `Cooldown (${cooldown}s)`
                    : `Generate ${engine} Keys`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
