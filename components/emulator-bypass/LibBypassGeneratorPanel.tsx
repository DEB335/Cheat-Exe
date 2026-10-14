"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyIcon, GamepadIcon, LockIcon } from "@/components/icons";
import {
  IconTile,
  NeonCta,
  NeonPanel,
  NeonToggle,
  PanelHeader,
  RocketIcon,
  toneVars,
} from "@/components/neon";
import { PRESET_VALIDITY_OPTIONS } from "@/components/resellers/ResellerModals";
import { KeyHistoryAmbient } from "@/components/scenes/KeyHistoryScene";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { patchDb, useDashboard } from "@/lib/store";
import type { KeyRecord } from "@/lib/types";
import { cn, isCreatorMatch } from "@/lib/utils";

const ALL_PRESET_DAYS = PRESET_VALIDITY_OPTIONS.map((p) => p.days);

const PRESET_DURATIONS_INFO: Record<number, string> = {
  1: "24 Hours",
  3: "72 Hours",
  7: "1 Week",
  30: "1 Month",
  60: "2 Months",
  90: "3 Months",
  180: "6 Months",
  365: "1 Year",
};

export function LibBypassGeneratorPanel() {
  const toast = useToast();
  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);
  const refresh = useDashboard((s) => s.refresh);
  const isOwner = user?.role === "OWNER";

  // Dynamic Engine maintenance calculation (V1 currently in upstream maintenance, V2 operational)
  const maint = db.emulatorBypassMaintenance;
  const isV2Maintenance = maint?.v2Maintenance !== undefined 
    ? Boolean(maint.v2Maintenance) 
    : Boolean(maint?.active && (maint?.engine === "V2" || maint?.engine === "ALL"));
  const isV1Maintenance = maint?.v1Maintenance !== undefined 
    ? Boolean(maint.v1Maintenance) 
    : true;

  // Recommended engine badge: dynamically V1 or V2
  const recommendedEngine = useMemo(() => {
    if (maint?.recommended) return maint.recommended;
    if (!isV2Maintenance) return "V2";
    if (!isV1Maintenance) return "V1";
    return null;
  }, [maint?.recommended, isV1Maintenance, isV2Maintenance]);

  // Selected engine: points to whichever engine is active
  const [engine, setEngine] = useState<"V1" | "V2">(() => {
    if (!isV2Maintenance) return "V2";
    if (!isV1Maintenance) return "V1";
    return "V2";
  });

  // Automatically update selected engine if maintenance status shifts dynamically
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
  const [days, setDays] = useState<number>(() => {
    return allowedDays.includes(1) ? 1 : allowedDays[0] ?? 1;
  });
  const [customDaysInput, setCustomDaysInput] = useState(() => {
    return String(allowedDays.includes(1) ? 1 : allowedDays[0] ?? 1);
  });

  // Automatically update selected days if permissions update dynamically
  useEffect(() => {
    if (!isOwner && !allowedDays.includes(days) && allowedDays.length > 0) {
      const fallback = allowedDays.includes(1) ? 1 : allowedDays[0];
      setDays(fallback);
      setCustomDaysInput(String(fallback));
    }
  }, [isOwner, allowedDays, days]);

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
    if (isOwner) return "Unlimited";
    return String(usedCredits);
  }, [isOwner, usedCredits]);

  const [previewStamp, setPreviewStamp] = useState("");
  useEffect(() => {
    const at = new Date(Date.now() + days * 86_400_000);
    const y = at.getFullYear();
    const m = String(at.getMonth() + 1).padStart(2, "0");
    const d = String(at.getDate()).padStart(2, "0");
    const hh = String(at.getHours()).padStart(2, "0");
    const mm = String(at.getMinutes()).padStart(2, "0");
    setPreviewStamp(`${y}-${m}-${d} ${hh}:${mm}`);
  }, [days]);

  const expiryPreview = previewStamp || "Calculating...";

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
          clientDate: new Date().toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
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

      // Form reset back to default initial state
      setKeyName("");
      const defaultDay = allowedDays.includes(1) ? 1 : allowedDays[0] ?? 1;
      setDays(defaultDay);
      setCustomDaysInput(String(defaultDay));

      toast(`Successfully generated Lib Bypass Key: ${generatedKey}!`, "success");
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full">
      <NeonPanel rim="danger" className="relative overflow-hidden">
        {/* Ambient perspective floor and particle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[260px] overflow-hidden rounded-t-[24px] [mask-image:linear-gradient(180deg,#000_55%,transparent)] sm:block"
        >
          <KeyHistoryAmbient className="size-full" />
        </div>

        <div className="relative z-[1]">
          <PanelHeader
            icon={<GamepadIcon className="transition-transform duration-300 ease-back group-hover/tile:scale-120 group-hover/tile:rotate-6 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />}
            iconTone="red"
            iconTone2="pink"
            iconClassName="transition-all duration-300 ease-back hover:scale-110 hover:-rotate-3 hover:shadow-[0_0_24px_rgba(255,45,122,0.75)] cursor-pointer"
            title="Generate Lib Bypass License Keys"
            subtitle={`Mint emulator bypass license keys with ${engine === "V2" ? "Sensix V2 Direct Server Engine" : "Discord Bot Engine"}.`}
          />

          <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6">
            {/* 1. Engine Selection Container */}
            <div className="rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(255,45,122,0.06),transparent_70%),#070b1a]/90 p-3.5 sm:p-4 shadow-inner space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Select Bypass Engine Version</span>
                  <span className="text-red-500">*</span>
                </span>
                {recommendedEngine ? (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {recommendedEngine} Recommended
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Maintenance Mode
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                {/* Version 1 (V1) */}
                <div
                  onClick={() => {
                    if (isV1Maintenance) {
                      toast("Version 1 (V1) is currently under maintenance and cannot be selected.", "error");
                    } else {
                      setEngine("V1");
                    }
                  }}
                  className={cn(
                    "relative flex flex-col justify-between rounded-xl border-2 p-3.5 text-left select-none transition-all duration-200",
                    isV1Maintenance
                      ? "border-amber-500/25 bg-[#0e1328]/40 opacity-55 cursor-not-allowed hover:border-amber-500/40"
                      : [
                        "cursor-pointer",
                        engine === "V1"
                          ? "border-red-500 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(239,68,68,0.25),rgba(239,68,68,0.06)_70%),#121735] shadow-[0_0_24px_rgba(239,68,68,0.3)] ring-1 ring-red-400/50"
                          : "border-white/10 bg-[#0e1328] hover:border-slate-400",
                      ],
                  )}
                  title={isV1Maintenance ? "Version 1 is currently in maintenance and cannot be selected" : "Select Version 1"}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-base">⚡</span>
                      <span className={cn("text-sm font-bold", isV1Maintenance ? "text-slate-400 line-through/none" : "text-slate-100")}>
                        Version 1 (V1)
                      </span>
                    </div>
                    {isV1Maintenance ? (
                      <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/35 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                        In Maintenance
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                        <span className="size-1 rounded-full bg-emerald-400" />
                        Active Engine
                      </span>
                    )}
                  </div>
                  <span className={cn("mt-2 text-xs font-medium", isV1Maintenance ? "text-amber-400/80 flex items-center gap-1.5" : "text-slate-300")}>
                    {isV1Maintenance ? (
                      <>
                        <span>🔒</span>
                        <span>Discord Bot Engine • Blocked (Maintenance)</span>
                      </>
                    ) : (
                      "Discord Bot Engine"
                    )}
                  </span>
                </div>

                {/* Version 2 (V2) */}
                <div
                  onClick={() => {
                    if (isV2Maintenance) {
                      toast("Version 2 (V2) is currently under maintenance and cannot be selected.", "error");
                    } else {
                      setEngine("V2");
                    }
                  }}
                  className={cn(
                    "relative flex flex-col justify-between rounded-xl border-2 p-3.5 text-left select-none transition-all duration-200",
                    isV2Maintenance
                      ? "border-amber-500/25 bg-[#0e1328]/40 opacity-55 cursor-not-allowed hover:border-amber-500/40"
                      : [
                        "cursor-pointer",
                        engine === "V2"
                          ? "border-red-500 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(239,68,68,0.25),rgba(239,68,68,0.06)_70%),#121735] shadow-[0_0_24px_rgba(239,68,68,0.3)] ring-1 ring-red-400/50"
                          : "border-white/10 bg-[#0e1328] hover:border-slate-400",
                      ],
                  )}
                  title={isV2Maintenance ? "Version 2 is currently in maintenance and cannot be selected" : "Select Version 2"}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-base">🚀</span>
                      <span className={cn("text-sm font-bold", isV2Maintenance ? "text-slate-400" : "text-white")}>
                        Version 2 (V2)
                      </span>
                    </div>
                    {isV2Maintenance ? (
                      <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/35 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                        In Maintenance
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                        <span className="size-1 rounded-full bg-emerald-400" />
                        Active Engine
                      </span>
                    )}
                  </div>
                  <span className={cn("mt-2 text-xs font-medium", isV2Maintenance ? "text-amber-400/80 flex items-center gap-1.5" : "text-slate-300")}>
                    {isV2Maintenance ? (
                      <>
                        <span>🔒</span>
                        <span>Sensix Direct Server Engine • Blocked (Maintenance)</span>
                      </>
                    ) : (
                      "Sensix Direct Server Engine"
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Credits & Uses Stat Cards (High Contrast Balanced Glass) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Total Credits Card */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.22),transparent_70%),linear-gradient(180deg,#0a1428_0%,#060a16_100%)] p-4 shadow-[0_0_22px_rgba(16,185,129,0.18)] transition-all hover:border-emerald-500/65 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                      <span className="text-lg">⚡</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                        Total Credits
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400/90">
                        Available Balance
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]">
                      {totalCreditsDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Uses Card */}
              <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.22),transparent_70%),linear-gradient(180deg,#0a1428_0%,#060a16_100%)] p-4 shadow-[0_0_22px_rgba(14,165,233,0.18)] transition-all hover:border-sky-500/65 hover:shadow-[0_0_30px_rgba(14,165,233,0.25)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/50 bg-sky-500/20 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.35)]">
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                        Uses
                      </span>
                      <span className="text-[11px] font-medium text-sky-400/90">
                        Keys Generated
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]">
                      {usesDisplay}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Key Name & Custom Days (Pixel-Perfect Alignment) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Key Name / Username */}
              <div className="space-y-1.5">
                <div className="flex h-7 items-center justify-between">
                  <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                    <span>🔑</span>
                    <span>KEY NAME / USERNAME</span>
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Enter Key Name / Username"
                  className="h-11 w-full rounded-xl border border-[#202947] bg-[#070b1a] px-4 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                />
              </div>

              {/* Custom Days Input */}
              <div className="space-y-1.5">
                <div className="flex h-7 items-center justify-between">
                  <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                    <span>⏱️</span>
                    <span>DURATION (CUSTOM DAYS)</span>
                  </label>
                  <span className="text-[11.5px] font-bold text-red-400 flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded-full leading-none">
                    <span>📅</span> {days} Days ({PRESET_DURATIONS_INFO[days] ?? `${days} Days`})
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDaysInput}
                  onChange={(e) => handleCustomDaysChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#202947] bg-[#070b1a] px-4 text-sm font-bold text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                />
              </div>
            </div>

            {/* 4. The 8 Preset Duration Cards */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                  SELECT PRESET DURATION
                </span>
                <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.15)]">
                  <span>⏰</span>
                  <span className="text-slate-400">Expires:</span>
                  <strong className="text-sky-300 font-mono font-bold">{expiryPreview}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {PRESET_VALIDITY_OPTIONS.map((opt) => {
                  const isPermitted = allowedDays.includes(opt.days);
                  const isSelected = days === opt.days;
                  const info = PRESET_DURATIONS_INFO[opt.days] ?? `${opt.days} Days`;

                  return (
                    <button
                      key={opt.days}
                      type="button"
                      disabled={!isPermitted}
                      onClick={() => handleSelectPreset(opt.days)}
                      title={isPermitted ? `Select ${opt.label} (${info})` : "Locked for your account"}
                      style={toneVars(opt.tone)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-0.5 rounded-[14px] border p-2.5 py-3 select-none",
                        "transition-all duration-200 ease-out",
                        isPermitted ? "cursor-pointer hover:-translate-y-1 active:translate-y-0" : "cursor-not-allowed opacity-35 grayscale",
                        isSelected && isPermitted
                          ? [
                            "border-[rgba(var(--tone-hi),0.95)] text-white",
                            "[background:radial-gradient(120%_80%_at_50%_0%,rgba(var(--tone-hi),0.35),rgba(var(--tone),0.18)_60%),linear-gradient(180deg,#121838,#0a0d24)]",
                            "shadow-[0_0_20px_-2px_rgba(var(--tone),0.6),inset_0_1px_0_rgba(255,255,255,0.35)]",
                            "ring-2 ring-[rgba(var(--tone-hi),0.8)]",
                          ]
                          : isPermitted
                            ? [
                              "border-white/10 bg-[#0a0e24]/90 text-slate-300",
                              "hover:border-[rgba(var(--tone),0.7)] hover:bg-[#111738] hover:text-white hover:shadow-[0_0_15px_rgba(var(--tone),0.3)]",
                            ]
                            : "border-white/5 bg-[#080b20]/60 text-[#4c597e] shadow-none",
                      )}
                    >
                      {!isPermitted && (
                        <span className="absolute top-1.5 right-1.5 flex items-center justify-center size-4 rounded-full bg-red-950/90 border border-red-500/40 text-[9px] text-red-300 shadow-sm" title="Locked by owner">
                          🔒
                        </span>
                      )}
                      <span className="text-[13px] font-black tracking-wider uppercase font-display flex items-center justify-center">
                        {opt.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10.5px] font-semibold tracking-wide",
                          isSelected && isPermitted ? "text-slate-200 font-bold" : "text-slate-400",
                        )}
                      >
                        {info}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Number of Keys & Note / Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              <div className="space-y-1.5 cursor-not-allowed">
                <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase cursor-not-allowed">
                  NUMBER OF KEYS
                </label>
                <input
                  type="number"
                  readOnly
                  value={keyCount}
                  className="w-full rounded-xl border border-[#202947] bg-[#070b1a]/70 px-4 py-2.5 text-sm font-bold text-slate-400 outline-none cursor-not-allowed select-none"
                />
                <p className="text-[10.5px] text-amber-400/90 leading-tight flex items-start gap-1 cursor-not-allowed">
                  <span>🔒</span>
                  <span>Anti-Flood Rule: 1 key per generation (30-sec cooldown between keys).</span>
                </p>
              </div>

              <div className="space-y-1.5 cursor-not-allowed">
                <label className="text-[11px] font-bold tracking-wider text-slate-300 uppercase cursor-not-allowed">
                  NOTE / REFERENCE
                </label>
                <input
                  type="text"
                  readOnly
                  value={lockedNote}
                  className="w-full rounded-xl border border-[#202947] bg-[#070b1a]/70 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed outline-none select-none"
                />
              </div>
            </div>

            {/* 6. HWID Device Lock */}
            <div className="flex items-center justify-between rounded-xl border border-[#202945] bg-[#0c1226]/60 p-3.5 lt:border-slate-200 lt:bg-slate-50">
              <div className="flex items-center gap-3">
                <IconTile tone="violet" variant="ring" size="xs">
                  <LockIcon />
                </IconTile>
                <div>
                  <h5 className="text-[13.5px] font-bold text-white lt:text-slate-900">
                    HWID Device Lock
                  </h5>
                  <p className="text-[12px] text-[#9bb0db] lt:text-slate-500">
                    Binds generated key to the first computer hardware.
                  </p>
                </div>
              </div>
              <NeonToggle
                id="hwid-toggle"
                title=""
                tone="violet"
                boxed={false}
                checked={hwidLock}
                onChange={setHwidLock}
              />
            </div>

            {/* 7. Key Created Result Box */}
            {createdKey && (
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/25 p-4 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                    Key Created Successfully
                  </span>
                  <div className="font-mono text-base font-black text-white select-all">
                    {createdKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKey);
                    toast("Key copied to clipboard!", "success");
                  }}
                  className="rounded-xl bg-emerald-500/25 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/35 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CopyIcon className="size-3.5" />
                  Copy
                </button>
              </div>
            )}

            {/* 8. Generate CTA Button */}
            <div className="pt-2 flex justify-center">
              <NeonCta
                type="submit"
                size="md"
                icon={<RocketIcon />}
                loading={generating}
                disabled={cooldown > 0}
                className="w-full sm:w-auto"
              >
                {generating
                  ? "Generating..."
                  : cooldown > 0
                    ? `Cooldown (${cooldown}s)`
                    : `Generate ${engine} Keys`}
              </NeonCta>
            </div>
          </form>
        </div>
      </NeonPanel>
    </div>
  );
}
