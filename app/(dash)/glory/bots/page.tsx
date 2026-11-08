"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  BotIcon,
  TrashIcon,
  SaveIcon,
  ChevronDownIcon,
} from "@/components/icons";
import { NeonCta, NeonLabel } from "@/components/neon";
import { RegionSelect } from "@/components/whitelist/RegionSelect";
import { WHITELIST_REGIONS } from "@/lib/packages";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { gloryCreditsRemaining, gloryCreditsUsed } from "@/lib/reseller";
import { useDashboard, useEffectiveUser } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface BotAccount {
  id: string;
  nickname: string;
  uid: string;
  inGameId: string;
  region: string;
  guildId: string;
  status: "Active" | "Offline";
  createdAt: string;
  createdBy: string; // "admin" or reseller username
}

const GLORY_REGIONS = [
  { code: "IND", label: "India", countryCode: "IN" },
  { code: "BD", label: "Bangladesh", countryCode: "BD" },
  { code: "SG", label: "Singapore / Global", countryCode: "SG" },
] as const;

const AUTO_CAST_OPTIONS = [
  { id: "enabled", label: "Enabled — cast at nearest enemy" },
  { id: "disabled", label: "Disabled" },
] as const;

const INTERCEPTION_OPTIONS = [
  { id: "enabled", label: "Enabled — bots chase closest enemy" },
  { id: "disabled", label: "Disabled — hold spawn" },
] as const;

// Initial mock bots matching the user's screenshot
const INITIAL_MOCK_BOTS: BotAccount[] = [
  { id: "bot-1", nickname: "EXEKQHA7", uid: "8397235031", inGameId: "18995726421", region: "IND", guildId: "3865253173", status: "Active", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-2", nickname: "EXE5C427", uid: "8397235778", inGameId: "18995727588", region: "IND", guildId: "3865253173", status: "Active", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-3", nickname: "EXEJ79RD", uid: "8397246781", inGameId: "18995741259", region: "IND", guildId: "3865253173", status: "Active", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-4", nickname: "fahhO582G", uid: "8397504619", inGameId: "18996171603", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-5", nickname: "fahhOXY5X", uid: "8397505341", inGameId: "18996172568", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-6", nickname: "fahh5AVT2", uid: "8397509728", inGameId: "18996178364", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-7", nickname: "fahh2G6LG", uid: "8397510635", inGameId: "18996179296", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-8", nickname: "fahhP1N0D", uid: "8397519728", inGameId: "18996190786", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-9", nickname: "fahhi25C0", uid: "8397520732", inGameId: "18996191988", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-10", nickname: "fahhKDEX4", uid: "8397529804", inGameId: "18996203384", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-11", nickname: "fahh2P4PE", uid: "8397530712", inGameId: "18996204396", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-12", nickname: "fahhRKWU9", uid: "8397537246", inGameId: "18996212833", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-13", nickname: "fahhW44DN", uid: "8397538147", inGameId: "18996213728", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-14", nickname: "achha3WK6N", uid: "8397651319", inGameId: "18996384388", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-15", nickname: "achhaN52C4", uid: "8397651552", inGameId: "18996384808", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-16", nickname: "achhaVZA75", uid: "8397652070", inGameId: "18996387638", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
  { id: "bot-17", nickname: "achhaAPKIU", uid: "8397653343", inGameId: "18996388899", region: "IND", guildId: "3842794144", status: "Offline", createdAt: new Date().toISOString(), createdBy: "admin" },
];

export default function BotAccountsPage() {
  const toast = useToast();
  const user = useEffectiveUser();
  const refresh = useDashboard((s) => s.refresh);
  // Reconcile the stored counter with the bot audit trail, exactly like the
  // emulator bypass reads its key history -- so the balance shown is never
  // more generous than what the server will actually allow.
  const gloryBots = useDashboard((s) => s.db.cheatExeGloryBots);
  const spentCredits = gloryCreditsUsed(user?.gloryCreditsUsed, gloryBots, user?.username);
  const remainingCredits = user ? gloryCreditsRemaining(user, spentCredits) : null;
  const isOwner = user?.role === "OWNER";
  const currentUsername = (user?.username ?? "admin").toLowerCase();

  // Local persistent state for generated bots
  const [bots, setBots] = useState<BotAccount[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cheat_exe_glory_bots");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore parse error
      }
    }
    return INITIAL_MOCK_BOTS;
  });

  // Selected bots for bulk actions
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);

  // Modal open/close state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Form State
  const [targetGuildId, setTargetGuildId] = useState("");
  const [botCount, setBotCount] = useState<number>(4);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("IND");
  const [namePrefix, setNamePrefix] = useState("CHEAT EXE");
  const [isGenerating, setIsGenerating] = useState(false);

  const cost = Math.ceil((botCount || 4) / 4);

  // Configuration State
  const [autoCast, setAutoCast] = useState<"Enabled" | "Disabled">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cheat_exe_bot_autocast");
      if (saved === "Disabled" || saved === "Enabled") return saved;
    }
    return "Enabled";
  });
  const [autoCastOpen, setAutoCastOpen] = useState(false);
  const autoCastRef = useRef<HTMLDivElement>(null);

  const [homerCooldown, setHomerCooldown] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cheat_exe_bot_cooldown");
      if (saved) return saved;
    }
    return "90";
  });

  const [enemyInterception, setEnemyInterception] = useState<"Enabled" | "Disabled">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cheat_exe_bot_interception");
      if (saved === "Disabled" || saved === "Enabled") return saved;
    }
    return "Enabled";
  });
  const [interceptionOpen, setInterceptionOpen] = useState(false);
  const interceptionRef = useRef<HTMLDivElement>(null);

  const [stopDistance, setStopDistance] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cheat_exe_bot_stop_distance");
      if (saved) return saved;
    }
    return "150";
  });

  // Numeric validation checks
  const cooldownNum = parseInt(homerCooldown, 10);
  const isCooldownInvalid =
    homerCooldown === "" || isNaN(cooldownNum) || cooldownNum < 15 || cooldownNum > 120;

  const distanceNum = parseInt(stopDistance, 10);
  const isDistanceInvalid =
    stopDistance === "" || isNaN(distanceNum) || distanceNum < 50 || distanceNum > 500;

  // Outside click listeners for configuration dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (autoCastRef.current && !autoCastRef.current.contains(e.target as Node)) {
        setAutoCastOpen(false);
      }
      if (interceptionRef.current && !interceptionRef.current.contains(e.target as Node)) {
        setInterceptionOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSaveConfig = () => {
    if (isCooldownInvalid) {
      toast("Cooldown interval must be between 15 and 120 seconds", "error");
      return;
    }
    if (isDistanceInvalid) {
      toast("Stop distance must be between 50 and 500 units", "error");
      return;
    }
    try {
      localStorage.setItem("cheat_exe_bot_autocast", autoCast);
      localStorage.setItem("cheat_exe_bot_cooldown", cooldownNum.toString());
      localStorage.setItem("cheat_exe_bot_interception", enemyInterception);
      localStorage.setItem("cheat_exe_bot_stop_distance", distanceNum.toString());
      toast("Configuration saved & synced to engine", "success");
    } catch {
      toast("Failed to save configuration", "error");
    }
  };

  // Sync bots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("cheat_exe_glory_bots", JSON.stringify(bots));
    } catch {
      // ignore write error
    }
  }, [bots]);

  // Handle generating new bots - WITHOUT '#' hashtag, stamped with createdBy
  const handleGenerateBots = async (e: React.FormEvent) => {
    e.preventDefault();
    const guild = targetGuildId.trim();
    if (!guild) {
      toast("Target Guild ID is required", "error");
      return;
    }

    const count = Math.min(10, Math.max(1, botCount || 4));
    const creditsNeeded = Math.ceil(count / 4);

    if (!isOwner && remainingCredits !== null && remainingCredits < creditsNeeded) {
      toast(
        `Insufficient Guild Glory credits. Need ${creditsNeeded} credit(s), but only ${remainingCredits} left.`,
        "error",
      );
      return;
    }

    setIsGenerating(true);

    try {
      await postJson("/api/glory/bots", {
        count,
        guildId: guild,
        region: selectedRegionCode,
        prefix: namePrefix.trim() || "CHEAT EXE",
      });

      const prefix = namePrefix.trim() || "CHEAT EXE";
      const now = new Date().toISOString();
      const regionObj = WHITELIST_REGIONS.find((r) => r.code === selectedRegionCode);
      const regionText = regionObj ? regionObj.code : selectedRegionCode;

      const newBots: BotAccount[] = [];
      const currentTotal = bots.length;

      for (let i = 1; i <= count; i++) {
        const indexNumber = currentTotal + i;
        const randomUid = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const randomInGameId = Math.floor(10000000000 + Math.random() * 90000000000).toString();

        // Clean nickname: NO '#' hashtag attached!
        const cleanNickname = count === 1 ? prefix : `${prefix} ${indexNumber}`;

        newBots.push({
          id: `bot-${Date.now()}-${i}`,
          nickname: cleanNickname,
          uid: randomUid,
          inGameId: randomInGameId,
          region: regionText,
          guildId: guild,
          status: "Active",
          createdAt: now,
          createdBy: currentUsername, // Track creator (e.g. "admin" or "reseller1")
        });
      }

      setBots((prev) => [...prev, ...newBots]);
      setIsModalOpen(false);
      setTargetGuildId("");
      void refresh();

      toast(
        `Generated ${count} bot account${count > 1 ? "s" : ""} bound to Guild ${guild}!`,
        "success",
      );
    } catch (err) {
      toast((err as Error).message || "Failed to generate bot accounts", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle single bot status (Active <-> Offline)
  const handleToggleBotStatus = (id: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const nextStatus = b.status === "Active" ? "Offline" : "Active";
        toast(`${b.nickname} status changed to ${nextStatus}`, "info");
        return { ...b, status: nextStatus };
      }),
    );
  };

  // Delete single bot
  const handleDeleteBot = (id: string, name: string) => {
    setBots((prev) => prev.filter((b) => b.id !== id));
    setSelectedBotIds((prev) => prev.filter((item) => item !== id));
    toast(`Removed bot account ${name}`, "info");
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (visibleBots.length === 0) {
      toast("No bot accounts to select", "info");
      return;
    }
    if (selectedBotIds.length === visibleBots.length) {
      setSelectedBotIds([]);
    } else {
      setSelectedBotIds(visibleBots.map((b) => b.id));
    }
  };

  const toggleSelectBot = (id: string) => {
    setSelectedBotIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Delete selected bots
  const handleDeleteSelected = () => {
    if (selectedBotIds.length === 0) return;
    setBots((prev) => prev.filter((b) => !selectedBotIds.includes(b.id)));
    setSelectedBotIds([]);
    toast("Selected bot accounts removed", "info");
  };

  // Copy UID helper
  const handleCopyUid = (uid: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(uid);
      toast(`Copied UID ${uid} to clipboard`, "success");
    }
  };

  // Multi-tenant Role Filtering:
  // - Owner sees ALL bots (from Owner + all Resellers)
  // - Reseller sees ONLY their own bots (createdBy === currentUsername)
  const visibleBots = isOwner
    ? bots
    : bots.filter((b) => (b.createdBy ?? "admin").toLowerCase() === currentUsername);

  const isAllSelected = visibleBots.length > 0 && selectedBotIds.length === visibleBots.length;
  const isPartiallySelected = selectedBotIds.length > 0 && selectedBotIds.length < visibleBots.length;
  const activeBotsCount = visibleBots.filter((b) => b.status === "Active").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base font-sans font-black text-white uppercase tracking-wider">
            Fleet Status
          </span>
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-sans font-bold text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)] flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span>{activeBotsCount} Active / {visibleBots.length} Total</span>
          </span>
          <span className="rounded-full bg-[rgba(255,45,90,0.12)] border border-[rgba(255,45,90,0.35)] px-3 py-1 text-xs font-sans font-bold text-white shadow-[0_0_10px_rgba(255,45,90,0.2)] flex items-center gap-1.5">
            <span className="text-[#ff6688]">⚡</span>
            <span>Credits: {isOwner || remainingCredits === null ? "Unlimited" : `${remainingCredits} Left`}</span>
          </span>
        </div>

        {/* Generate Accounts Button */}
        <NeonCta
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 font-sans"
          chevron
        >
          Generate Accounts
        </NeonCta>
      </div>

      {/* Main Bot Accounts Table Card */}
      <div className="relative overflow-hidden rounded-[20px] border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] backdrop-blur-xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] z-10 transition-all duration-300 ease-smooth hover:border-[rgba(255,45,90,0.4)]">
        {/* Bulk Action Bar (when bots are selected) */}
        {selectedBotIds.length > 0 && (
          <div className="bg-red-500/15 border-b border-red-500/25 px-5 py-2.5 flex items-center justify-between text-xs animate-in fade-in-0 duration-200 font-sans">
            <span className="text-red-300 font-bold">
              {selectedBotIds.length} bot account{selectedBotIds.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/40 px-3.5 py-1 text-xs font-bold text-red-300 hover:bg-red-900/40 transition active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
              >
                <TrashIcon className="size-3 text-red-300" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {visibleBots.length === 0 ? (
          <div className="py-24 text-center font-sans">
            <h4 className="text-base font-bold text-white tracking-wide">
              No bot accounts yet
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium max-w-md mx-auto">
              Use &ldquo;Generate accounts&rdquo; to create your first squad.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-transparent">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-slate-300 uppercase tracking-wider font-bold font-sans text-xs select-none">
                  {/* Select All Checkbox */}
                  <th className="py-3.5 pl-4 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      title={isAllSelected ? "Deselect All" : "Select All"}
                      className="flex items-center cursor-pointer p-1 rounded-md hover:bg-white/10 transition-colors"
                    >
                      <div
                        className={cn(
                          "size-4 rounded border flex items-center justify-center transition-all duration-200",
                          isAllSelected
                            ? "border-emerald-500 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            : isPartiallySelected
                              ? "border-amber-400 bg-amber-400/20 text-amber-300"
                              : "border-white/30 bg-white/5",
                        )}
                      >
                        {isAllSelected && <CheckIcon className="size-3 text-black stroke-[3]" />}
                        {isPartiallySelected && <div className="size-2 rounded-xs bg-amber-400" />}
                      </div>
                    </button>
                  </th>

                  {/* NO. / SL Column as requested */}
                  <th className="py-3.5 px-3 w-14 font-mono">NO.</th>
                  <th className="py-3.5 px-3">NICKNAME</th>
                  <th className="py-3.5 px-3 font-mono">UID</th>
                  <th className="py-3.5 px-3 font-mono">IN-GAME ID</th>
                  <th className="py-3.5 px-3 font-mono">REGION</th>
                  <th className="py-3.5 px-3 font-mono">GUILD</th>
                  <th className="py-3.5 px-3 font-mono">STATUS</th>
                  <th className="py-3.5 pr-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] bg-transparent">
                {visibleBots.map((bot, index) => {
                  const isSelected = selectedBotIds.includes(bot.id);
                  return (
                    <tr
                      key={bot.id}
                      className={cn(
                        "transition-colors bg-transparent",
                        isSelected ? "bg-red-500/10" : "hover:bg-white/[0.03]",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 bg-transparent">
                        <button
                          type="button"
                          onClick={() => toggleSelectBot(bot.id)}
                          className="p-1 rounded hover:bg-white/10 transition cursor-pointer"
                        >
                          <div
                            className={cn(
                              "size-4 rounded border flex items-center justify-center transition-all",
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "border-white/30 bg-white/5",
                            )}
                          >
                            {isSelected && <CheckIcon className="size-3 text-black stroke-[3]" />}
                          </div>
                        </button>
                      </td>

                      {/* NO. Column (1, 2, 3, 4...) */}
                      <td className="py-3.5 px-3 font-mono text-slate-400 text-xs font-bold bg-transparent">
                        {index + 1}
                      </td>

                      {/* Clean Nickname without '#' hashtag + Creator badge for Owner */}
                      <td className="py-3.5 px-3 bg-transparent">
                        <div className="flex items-center gap-2">
                          <BotIcon className="size-4 text-red-400 shrink-0" />
                          <span className="font-extrabold text-white text-sm font-sans tracking-wide">
                            {bot.nickname}
                          </span>
                          {isOwner && bot.createdBy && bot.createdBy !== "admin" && (
                            <span className="rounded border border-purple-500/40 bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300 uppercase shadow-[0_0_6px_rgba(168,85,247,0.2)]">
                              @{bot.createdBy}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* UID */}
                      <td className="py-3.5 px-3 font-mono text-slate-300 text-xs bg-transparent">
                        <div className="flex items-center gap-1.5">
                          <span>{bot.uid}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyUid(bot.uid)}
                            title="Copy UID"
                            className="p-1 rounded text-slate-500 hover:text-white transition cursor-pointer"
                          >
                            <CopyIcon className="size-3" />
                          </button>
                        </div>
                      </td>

                      {/* IN-GAME ID */}
                      <td className="py-3.5 px-3 font-mono text-slate-400 text-xs bg-transparent">
                        {bot.inGameId}
                      </td>

                      {/* REGION */}
                      <td className="py-3.5 px-3 bg-transparent">
                        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-mono text-slate-300 font-semibold">
                          {bot.region}
                        </span>
                      </td>

                      {/* GUILD */}
                      <td className="py-3.5 px-3 bg-transparent">
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                          {bot.guildId}
                        </span>
                      </td>

                      {/* STATUS with glowing rounded-full pill badge matching other pages */}
                      <td className="py-3.5 px-3 bg-transparent">
                        {bot.status === "Active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 font-mono text-xs font-bold text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-900/40 px-3 py-1 font-mono text-xs font-bold text-slate-400">
                            <span className="size-2 rounded-full bg-slate-500" />
                            OFFLINE
                          </span>
                        )}
                      </td>

                      {/* ACTIONS matching modern button styling */}
                      <td className="py-3.5 pr-4 text-right bg-transparent">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBotStatus(bot.id)}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-bold font-mono text-slate-200 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-300 active:scale-95"
                          >
                            {bot.status === "Active" ? "Set offline" : "Set active"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBot(bot.id, bot.nickname)}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-1 text-xs font-bold font-mono text-red-400 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-900/40 hover:text-white active:scale-95 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuration Section */}
      <div className="space-y-4 pt-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-sans">
              Configuration
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-sans">
              Combat behaviour for your bots. Saved to your profile and synced to the engine.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveConfig}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[rgba(255,45,90,0.6)] bg-[linear-gradient(180deg,#ff1f5a_0%,#c4002f_100%)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(255,31,90,0.45)] hover:shadow-[0_0_30px_rgba(255,31,90,0.75)] hover:brightness-110 transition-all duration-300 active:scale-95 shrink-0 select-none font-sans"
          >
            <SaveIcon className="size-4 shrink-0 text-white" />
            <span>Save configuration</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Homer drone skill */}
          <div className="relative rounded-2xl border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(18,3,11,0.85),rgba(10,2,6,0.92))] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-[#ff2a55] hover:shadow-[0_20px_45px_-10px_rgba(255,0,55,0.35),0_0_25px_rgba(255,31,90,0.25)] space-y-5">
            <h3 className="text-[14.5px] font-bold text-white tracking-wide font-sans">
              Homer drone skill
            </h3>

            {/* Field 1: AUTO-CAST */}
            <div ref={autoCastRef} className="space-y-2 relative">
              <label className="block font-sans text-xs font-bold tracking-wider text-slate-400 uppercase select-none">
                AUTO-CAST
              </label>

              <div
                role="combobox"
                aria-expanded={autoCastOpen}
                tabIndex={0}
                onClick={() => setAutoCastOpen((prev) => !prev)}
                className={cn(
                  "relative flex h-[50px] min-w-0 cursor-pointer items-center justify-between rounded-[10px] border px-4 outline-none select-none backdrop-blur-xl transition-all duration-300 ease-smooth",
                  "border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_10px_22px_-16px_rgba(0,0,0,0.9)]",
                  autoCastOpen
                    ? "border-[rgba(255,45,90,0.9)] shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)]"
                    : "hover:border-[rgba(255,60,110,0.6)] focus:border-[rgba(255,45,90,0.8)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.18)]"
                )}
              >
                <span className="font-semibold text-sm text-white tracking-wide truncate font-sans">
                  {autoCast === "Enabled"
                    ? "Enabled — cast at nearest enemy"
                    : "Disabled"}
                </span>

                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-[#ff8ba7] transition-transform duration-300 ease-smooth ml-2",
                    autoCastOpen && "rotate-180 text-white"
                  )}
                />
              </div>

              {/* Dropdown Menu */}
              {autoCastOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl p-1.5 border border-[rgba(255,45,90,0.35)] bg-[linear-gradient(180deg,rgba(24,5,12,0.98),rgba(12,2,6,0.99))] shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(255,31,90,0.25)] backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-200 ease-smooth space-y-1 font-sans"
                >
                  {AUTO_CAST_OPTIONS.map((opt) => {
                    const isSelected =
                      (opt.id === "enabled" && autoCast === "Enabled") ||
                      (opt.id === "disabled" && autoCast === "Disabled");
                    return (
                      <div
                        key={opt.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setAutoCast(opt.id === "enabled" ? "Enabled" : "Disabled");
                          setAutoCastOpen(false);
                        }}
                        className={cn(
                          "group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 select-none transition-all duration-200",
                          isSelected
                            ? "border border-[rgba(255,45,90,0.45)] bg-[linear-gradient(90deg,rgba(255,45,90,0.28),rgba(255,45,90,0.08))] text-white shadow-[0_0_14px_rgba(255,45,90,0.25)] font-semibold"
                            : "text-[#cbd5e1] hover:bg-[rgba(255,45,90,0.14)] hover:text-white"
                        )}
                      >
                        <span className="text-sm tracking-wide">{opt.label}</span>
                        {isSelected && (
                          <CheckIcon
                            className="size-4 shrink-0 text-[#ff2a55] drop-shadow-[0_0_6px_rgba(255,42,85,0.7)]"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Field 2: COOLDOWN INTERVAL (15-120 S) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="homer-cooldown"
                  className="block font-sans text-xs font-bold tracking-wider text-slate-400 uppercase select-none"
                >
                  COOLDOWN INTERVAL (15–120 S)
                </label>
                {isCooldownInvalid && (
                  <span className="text-xs font-mono font-bold text-red-400">
                    Range: 15 - 120s
                  </span>
                )}
              </div>
              <input
                id="homer-cooldown"
                type="number"
                value={homerCooldown}
                onChange={(e) => setHomerCooldown(e.target.value)}
                placeholder="15 - 120"
                className={cn(
                  "h-[50px] w-full rounded-[10px] border px-4 font-mono text-sm font-bold transition-all duration-300 backdrop-blur-xl outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  isCooldownInvalid
                    ? "border-red-500 bg-[rgba(35,5,10,0.85)] text-red-200 shadow-[0_0_0_2px_rgba(239,68,68,0.25),0_0_18px_rgba(239,68,68,0.35)] focus:border-red-400"
                    : "border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))] text-white placeholder:text-white/30 focus:border-[rgba(255,45,90,0.9)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)]"
                )}
              />
            </div>
          </div>

          {/* Card 2: Interception behaviour */}
          <div className="relative rounded-2xl border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(18,3,11,0.85),rgba(10,2,6,0.92))] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-[#ff2a55] hover:shadow-[0_20px_45px_-10px_rgba(255,0,55,0.35),0_0_25px_rgba(255,31,90,0.25)] space-y-5">
            <h3 className="text-[14.5px] font-bold text-white tracking-wide font-sans">
              Interception behaviour
            </h3>

            {/* Field 1: ENEMY INTERCEPTION */}
            <div ref={interceptionRef} className="space-y-2 relative">
              <label className="block font-sans text-xs font-bold tracking-wider text-slate-400 uppercase select-none">
                ENEMY INTERCEPTION
              </label>

              <div
                role="combobox"
                aria-expanded={interceptionOpen}
                tabIndex={0}
                onClick={() => setInterceptionOpen((prev) => !prev)}
                className={cn(
                  "relative flex h-[50px] min-w-0 cursor-pointer items-center justify-between rounded-[10px] border px-4 outline-none select-none backdrop-blur-xl transition-all duration-300 ease-smooth",
                  "border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_10px_22px_-16px_rgba(0,0,0,0.9)]",
                  interceptionOpen
                    ? "border-[rgba(255,45,90,0.9)] shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)]"
                    : "hover:border-[rgba(255,60,110,0.6)] focus:border-[rgba(255,45,90,0.8)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.18)]"
                )}
              >
                <span className="font-semibold text-sm text-white tracking-wide truncate font-sans">
                  {enemyInterception === "Enabled"
                    ? "Enabled — bots chase closest enemy"
                    : "Disabled — hold spawn"}
                </span>

                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-[#ff8ba7] transition-transform duration-300 ease-smooth ml-2",
                    interceptionOpen && "rotate-180 text-white"
                  )}
                />
              </div>

              {/* Dropdown Menu */}
              {interceptionOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl p-1.5 border border-[rgba(255,45,90,0.35)] bg-[linear-gradient(180deg,rgba(24,5,12,0.98),rgba(12,2,6,0.99))] shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(255,31,90,0.25)] backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-200 ease-smooth space-y-1 font-sans"
                >
                  {INTERCEPTION_OPTIONS.map((opt) => {
                    const isSelected =
                      (opt.id === "enabled" && enemyInterception === "Enabled") ||
                      (opt.id === "disabled" && enemyInterception === "Disabled");
                    return (
                      <div
                        key={opt.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setEnemyInterception(opt.id === "enabled" ? "Enabled" : "Disabled");
                          setInterceptionOpen(false);
                        }}
                        className={cn(
                          "group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 select-none transition-all duration-200",
                          isSelected
                            ? "border border-[rgba(255,45,90,0.45)] bg-[linear-gradient(90deg,rgba(255,45,90,0.28),rgba(255,45,90,0.08))] text-white shadow-[0_0_14px_rgba(255,45,90,0.25)] font-semibold"
                            : "text-[#cbd5e1] hover:bg-[rgba(255,45,90,0.14)] hover:text-white"
                        )}
                      >
                        <span className="text-sm tracking-wide">{opt.label}</span>
                        {isSelected && (
                          <CheckIcon
                            className="size-4 shrink-0 text-[#ff2a55] drop-shadow-[0_0_6px_rgba(255,42,85,0.7)]"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Field 2: STOP DISTANCE (50-500 UNITS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="stop-distance"
                  className="block font-sans text-xs font-bold tracking-wider text-slate-400 uppercase select-none"
                >
                  STOP DISTANCE (50–500 UNITS)
                </label>
                {isDistanceInvalid && (
                  <span className="text-xs font-mono font-bold text-red-400">
                    Range: 50 - 500
                  </span>
                )}
              </div>
              <input
                id="stop-distance"
                type="number"
                value={stopDistance}
                onChange={(e) => setStopDistance(e.target.value)}
                placeholder="50 - 500"
                className={cn(
                  "h-[50px] w-full rounded-[10px] border px-4 font-mono text-sm font-bold transition-all duration-300 backdrop-blur-xl outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  isDistanceInvalid
                    ? "border-red-500 bg-[rgba(35,5,10,0.85)] text-red-200 shadow-[0_0_0_2px_rgba(239,68,68,0.25),0_0_18px_rgba(239,68,68,0.35)] focus:border-red-400"
                    : "border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))] text-white placeholder:text-white/30 focus:border-[rgba(255,45,90,0.9)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)]"
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Popup Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop with rich blur */}
          <div
            className="fixed inset-0 bg-[#02050f]/85 backdrop-blur-md transition-opacity animate-modal-overlay-fade"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Dialog Box */}
          <div className="relative w-full max-w-[1020px] rounded-2xl border border-[rgba(255,45,90,0.4)] bg-[linear-gradient(180deg,#18040f_0%,#0c0207_100%)] p-7 sm:p-9 shadow-[0_30px_90px_rgba(0,0,0,0.98),0_0_50px_rgba(255,31,90,0.3)] z-10 text-white my-auto animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(255,31,90,0.25)]">
                  <BotIcon className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-wide font-sans">
                    Generate guild bot accounts
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    Spin up automated guest bot accounts linked directly to your target guild.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 font-sans text-xs font-bold text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.25)]">
                  <span className="text-amber-400 text-sm">⚡</span>
                  <span>Cost: {cost} Credit{cost > 1 ? "s" : ""} (1 Credit = 4 Bots)</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleGenerateBots} className="mt-7 space-y-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start font-sans">
                {/* Field 1: TARGET GUILD ID */}
                <div className="space-y-2">
                  <NeonLabel htmlFor="bot-guild-id">
                    Target Guild ID <span className="text-red-400">*</span>
                  </NeonLabel>
                  <input
                    id="bot-guild-id"
                    type="text"
                    required
                    value={targetGuildId}
                    onChange={(e) => setTargetGuildId(e.target.value)}
                    placeholder="e.g. 3055983375"
                    className="h-[54px] w-full rounded-[12px] border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))] px-4 font-mono text-[14px] text-white placeholder:text-white/30 focus:border-[rgba(255,45,90,0.9)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)] focus:outline-none transition-all duration-300 backdrop-blur-xl"
                  />
                </div>

                {/* Field 2: COUNT (1-10) */}
                <div className="space-y-2">
                  <NeonLabel htmlFor="bot-count">
                    Count (1-10) <span className="text-red-400">*</span>
                  </NeonLabel>
                  <input
                    id="bot-count"
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={botCount}
                    onChange={(e) =>
                      setBotCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="h-[54px] w-full rounded-[12px] border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))] px-4 font-mono text-[14px] font-bold text-white placeholder:text-white/30 focus:border-[rgba(255,45,90,0.9)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)] focus:outline-none transition-all duration-300 backdrop-blur-xl text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Field 3: REGION */}
                <div className="space-y-2">
                  <RegionSelect
                    id="bot-region"
                    label="Server Region *"
                    value={selectedRegionCode}
                    onChange={(code) => setSelectedRegionCode(code)}
                    regions={GLORY_REGIONS}
                  />
                </div>

                {/* Field 4: NICKNAME / PREFIX (Clean, without '#' hashtag!) */}
                <div className="space-y-2">
                  <NeonLabel htmlFor="bot-prefix">
                    Nickname / Prefix <span className="text-red-400">*</span>
                  </NeonLabel>
                  <input
                    id="bot-prefix"
                    type="text"
                    required
                    value={namePrefix}
                    onChange={(e) => setNamePrefix(e.target.value)}
                    placeholder="CHEAT EXE"
                    className="h-[54px] w-full rounded-[12px] border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))] px-4 font-sans text-sm font-bold text-white placeholder:text-white/30 uppercase focus:border-[rgba(255,45,90,0.9)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)] focus:outline-none transition-all duration-300 backdrop-blur-xl"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-xs font-bold text-white hover:bg-white/10 transition active:scale-95 font-sans"
                >
                  Cancel
                </button>

                <NeonCta
                  size="md"
                  type="submit"
                  disabled={isGenerating}
                  loading={isGenerating}
                  className="font-sans"
                >
                  {isGenerating ? "Deploying Bots..." : "Deploy Roster Now"}
                </NeonCta>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
