"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CheatExeButton } from "@/components/ui/CheatExeButton";
import { NeonButton, NeonInput } from "@/components/neon";
import { RegionSelect } from "@/components/whitelist/RegionSelect";
import { useToast } from "@/components/ui/Toast";
import { useDashboard, useEffectiveUser } from "@/lib/store";
import { gloryCreditsRemaining, gloryCreditsUsed } from "@/lib/reseller";
import { cn } from "@/lib/utils";

interface TrackedGuild {
  id: string;
  name: string;
  region: string;
  targetTags: number;
  currentTags: number;
  engineStatus: "Assigned" | "Standby";
  addedAt: string;
  createdBy?: string;
}

const GLORY_REGIONS = [
  { code: "IND", label: "India", countryCode: "IN" },
  { code: "BD", label: "Bangladesh", countryCode: "BD" },
  { code: "SG", label: "Singapore / Global", countryCode: "SG" },
] as const;

export default function GloryOverviewPage() {
  const toast = useToast();
  const user = useEffectiveUser();
  // Same high-water reconciliation the server enforces: the stored counter
  // or the bot audit trail, whichever proves more was spent.
  const gloryBots = useDashboard((s) => s.db.cheatExeGloryBots);
  const gloryUsed = gloryCreditsUsed(user?.gloryCreditsUsed, gloryBots, user?.username);
  const gloryRemaining = user ? gloryCreditsRemaining(user, gloryUsed) : null;
  const isOwner = user?.role === "OWNER";
  const displayCredits = isOwner || gloryRemaining === null ? "Unlimited" : gloryRemaining;

  const currentUsername = (user?.username ?? "admin").toLowerCase();

  // Load bot roster counts filtered by role
  const [botCount, setBotCount] = useState({ active: 0, offline: 0 });
  const [engineState, setEngineState] = useState<"IDLE" | "RUNNING">("RUNNING");
  const [activeGuild, setActiveGuild] = useState<string>("CHEAT2ENGINE");
  const [currentRound, setCurrentRound] = useState<number>(33);
  const [matchesCompleted, setMatchesCompleted] = useState<number>(32);
  const [sessionRemaining, setSessionRemaining] = useState<string>("05h 28m 01s left");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Track Guild Modal State
  const [addGuildModalOpen, setAddGuildModalOpen] = useState(false);
  const [newGuildId, setNewGuildId] = useState("");
  const [newGuildName, setNewGuildName] = useState("");
  const [newGuildRegion, setNewGuildRegion] = useState("IND");
  const [guildSearch, setGuildSearch] = useState("");

  // Tracked Guilds List with multi-tenant storage
  const [trackedGuilds, setTrackedGuilds] = useState<TrackedGuild[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cheat_exe_glory_tracked_guilds");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [
      {
        id: "3865253173",
        name: "CHEAT EXE 01",
        region: "IND",
        targetTags: 1800,
        currentTags: 11,
        engineStatus: "Assigned",
        addedAt: "10:45 AM",
        createdBy: "admin",
      },
      {
        id: "3842794144",
        name: "CHEAT2ENGINE",
        region: "IND",
        targetTags: 1800,
        currentTags: 95,
        engineStatus: "Assigned",
        addedAt: "11:15 AM",
        createdBy: "admin",
      },
    ];
  });

  // Load bots count from storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cheat_exe_glory_bots");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const visible = isOwner
              ? parsed
              : parsed.filter((b) => (b.createdBy ?? "admin").toLowerCase() === currentUsername);
            const active = visible.filter((b) => b.status === "Active").length;
            const offline = visible.filter((b) => b.status === "Offline").length;
            setBotCount({ active, offline });
          }
        } else {
          setBotCount({ active: 46, offline: 74 });
        }
      } catch {
        setBotCount({ active: 46, offline: 74 });
      }
    }
  }, [isOwner, currentUsername]);

  useEffect(() => {
    try {
      localStorage.setItem("cheat_exe_glory_tracked_guilds", JSON.stringify(trackedGuilds));
    } catch {}
  }, [trackedGuilds]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast("Node synchronized. Fleet health and match engine up to date.", "success");
    }, 900);
  };

  const handleAddGuildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuildId.trim() || !newGuildName.trim()) {
      toast("Please enter both Guild Name and Guild ID", "error");
      return;
    }

    const newGuild: TrackedGuild = {
      id: newGuildId.trim(),
      name: newGuildName.trim(),
      region: newGuildRegion,
      targetTags: 1800,
      currentTags: 0,
      engineStatus: "Standby",
      addedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdBy: currentUsername,
    };

    setTrackedGuilds((prev) => [newGuild, ...prev]);
    setNewGuildId("");
    setNewGuildName("");
    setAddGuildModalOpen(false);
    toast(`Guild ${newGuild.name} added to tracking roster!`, "success");
  };

  const handleRemoveGuild = (id: string, name: string) => {
    setTrackedGuilds((prev) => prev.filter((g) => g.id !== id));
    toast(`Removed ${name} from tracked guilds`, "info");
  };

  const visibleTrackedGuilds = useMemo(() => {
    return isOwner
      ? trackedGuilds
      : trackedGuilds.filter((g) => (g.createdBy ?? "admin").toLowerCase() === currentUsername);
  }, [isOwner, trackedGuilds, currentUsername]);

  const filteredGuilds = useMemo(() => {
    return visibleTrackedGuilds.filter(
      (g) =>
        g.name.toLowerCase().includes(guildSearch.toLowerCase()) ||
        g.id.toLowerCase().includes(guildSearch.toLowerCase()) ||
        g.region.toLowerCase().includes(guildSearch.toLowerCase()),
    );
  }, [visibleTrackedGuilds, guildSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Row with Status Badges in Right Corner */}
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* CREDITS BADGE */}
          <div className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,45,90,0.3)] bg-[rgba(255,45,90,0.1)] px-3 py-1 font-mono text-[11px] font-bold text-white shadow-[0_0_12px_rgba(255,45,90,0.15)]">
            <span className="text-[#ff6688]">⚡ CREDITS:</span>
            <span className="text-white">
              {isOwner || gloryRemaining === null
                ? "Unlimited"
                : `${gloryRemaining} / ${user?.gloryCredits ?? gloryRemaining}`}
            </span>
          </div>

          {/* NODE ONLINE BADGE */}
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>NODE ONLINE</span>
          </div>

          {/* ENGINE STATUS BADGE */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-[11px] font-bold tracking-wider",
              engineState === "RUNNING"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "border-white/10 bg-white/5 text-slate-400",
            )}
          >
            <span className="text-slate-500">ENGINE:</span>
            <span className={engineState === "RUNNING" ? "text-emerald-400" : "text-slate-300"}>
              {engineState}
            </span>
          </div>

          {/* SYNC BUTTON with Green Filled Theme from user screenshot */}
          <NeonButton
            type="button"
            tone="green"
            variant="filled"
            size="sm"
            onClick={handleSync}
            loading={isSyncing}
            icon={<RefreshIcon className={cn("size-3.5", isSyncing && "animate-spin")} />}
            className="h-8 px-3.5 text-xs font-bold"
            title="Sync Node Status"
          >
            Sync
          </NeonButton>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: AVAILABLE CREDITS */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-5 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-[rgba(255,45,90,0.45)]">
          <div className="text-[11px] font-extrabold tracking-[1px] text-slate-400 uppercase">
            AVAILABLE CREDITS
          </div>
          <div className="mt-2 font-display text-[32px] sm:text-[34px] leading-none font-extrabold text-white tracking-tight [text-shadow:0_0_12px_rgba(255,45,90,0.2)] lt:[text-shadow:none] lt:text-slate-900">
            {displayCredits}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400 font-medium">
            {isOwner || user?.gloryCredits === undefined || user?.gloryCredits === 0
              ? "1 Credit = 4 Bots • Uncapped"
              : `Quota: ${user.gloryCredits} • Used: ${gloryUsed}`}
          </div>
        </div>

        {/* Card 2: BOT ROSTER */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-5 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-red-500/40">
          <div className="text-[11px] font-extrabold tracking-[1px] text-slate-400 uppercase">
            BOT ROSTER
          </div>
          <div className="mt-2 font-display text-[32px] sm:text-[34px] leading-none font-extrabold text-white tracking-tight [text-shadow:0_0_12px_rgba(255,45,90,0.2)] lt:[text-shadow:none] lt:text-slate-900">
            {botCount.active + botCount.offline}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400 font-medium">
            {botCount.active} active &bull; {botCount.offline} offline
          </div>
        </div>

        {/* Card 3: GUILD ASSIGNMENT */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-5 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-red-500/40">
          <div className="text-[11px] font-extrabold tracking-[1px] text-slate-400 uppercase">
            GUILD ASSIGNMENT
          </div>
          <div className="mt-2 font-display text-[32px] sm:text-[34px] leading-none font-extrabold text-white tracking-tight [text-shadow:0_0_12px_rgba(255,45,90,0.2)] lt:[text-shadow:none] lt:text-slate-900">
            {visibleTrackedGuilds.length}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400 font-medium">
            0 backup / unassigned
          </div>
        </div>

        {/* Card 4: HOMER DRONE AI */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-5 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-emerald-500/40">
          <div className="text-[11px] font-extrabold tracking-[1px] text-slate-400 uppercase">
            HOMER DRONE AI
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <span>ACTIVE</span>
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-medium">
            Recast every 90s &bull; <span className="text-emerald-400">ENGAGED</span>
          </div>
        </div>
      </div>

      {/* Middle Card: 10-Hour Nonstop Match Engine */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
            <BoltIcon className="size-4 text-red-400" />
            10-Hour Nonstop Match Engine
          </h3>
          <span
            className={cn(
              "rounded-lg px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider border",
              engineState === "RUNNING"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-slate-400",
            )}
          >
            {engineState}
          </span>
        </div>

        {/* 4 Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              ACTIVE GUILD
            </div>
            <div className="mt-1.5 text-base sm:text-lg font-bold text-white truncate">
              {activeGuild}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              CURRENT ROUND
            </div>
            <div className="mt-1.5 text-base sm:text-lg font-mono font-bold text-white">
              {currentRound}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              MATCHES COMPLETED
            </div>
            <div className="mt-1.5 text-base sm:text-lg font-mono font-bold text-emerald-400">
              {matchesCompleted}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              10H SESSION REMAINING
            </div>
            <div className="mt-1.5 text-base sm:text-lg font-mono font-bold text-amber-400">
              {sessionRemaining}
            </div>
          </div>
        </div>
      </Card>

      {/* Lower Card: Tracked guilds (Full width, Operations policy omitted as requested) */}
      <Card className="p-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2 text-base font-extrabold text-white">
              <UsersIcon className="size-5 text-red-400" />
              Tracked guilds
              {visibleTrackedGuilds.length > 0 && (
                <span className="ml-2 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-xs font-mono text-red-300 font-bold">
                  {visibleTrackedGuilds.length}
                </span>
              )}
            </span>
          }
          subtitle="Guilds enrolled in automated nonstop match scheduling and dog tag collection"
          actions={
            <div className="flex items-center gap-2.5">
              {visibleTrackedGuilds.length > 0 && (
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={guildSearch}
                    onChange={(e) => setGuildSearch(e.target.value)}
                    placeholder="Search guild..."
                    className="h-8 w-32 sm:w-44 rounded-lg border border-red-500/20 bg-black/40 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500/60 focus:outline-none"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setAddGuildModalOpen(true)}
                className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] px-3.5 py-1.5 text-[12px] font-semibold text-[#ffd1dc] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.1)] active:scale-95"
              >
                + Track Guild
              </button>
            </div>
          }
        />

        {visibleTrackedGuilds.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl text-slate-500">
              🛡️
            </div>
            <p className="mt-4 text-sm font-medium text-slate-400">
              No guilds tracked yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Enroll a guild ID to launch 10-hour nonstop dog tag collection squads.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-2">Guild Name</th>
                  <th className="pb-3">Guild ID</th>
                  <th className="pb-3">Region</th>
                  <th className="pb-3 text-right">Target Tags</th>
                  <th className="pb-3 text-right">Engine Status</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredGuilds.map((guild) => (
                  <tr
                    key={guild.id}
                    className="transition-colors hover:bg-white/[0.03] group"
                  >
                    <td className="py-3 pl-2 font-bold text-white group-hover:text-red-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <span>{guild.name}</span>
                        {isOwner && guild.createdBy && guild.createdBy !== "admin" && (
                          <span className="rounded border border-purple-500/40 bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300 uppercase shadow-[0_0_6px_rgba(168,85,247,0.2)]">
                            @{guild.createdBy}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-slate-400">{guild.id}</td>
                    <td className="py-3">
                      <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-white/10">
                        {guild.region}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono text-slate-300">
                      {guild.targetTags} tags
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border",
                          guild.name === activeGuild && engineState === "RUNNING"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-slate-500/30 bg-slate-500/10 text-slate-400",
                        )}
                      >
                        {guild.name === activeGuild && engineState === "RUNNING"
                          ? "Active Squad"
                          : guild.engineStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveGuild(guild.id, guild.name)}
                        className="cursor-pointer rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Remove Guild"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ADD GUILD MODAL (Styled matching standard app modals with 3D tilt buttons and neon select) */}
      <Modal
        open={addGuildModalOpen}
        onClose={() => setAddGuildModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-white">
            <span className="text-red-400 font-extrabold text-lg">+</span>
            <span className="font-bold tracking-wide">Track New Guild</span>
          </div>
        }
        className="max-w-[480px] p-6 sm:p-7"
      >
        <form onSubmit={handleAddGuildSubmit} className="space-y-4">
          <NeonInput
            id="guild-name-input"
            label="Guild Name"
            tone="red"
            value={newGuildName}
            onChange={(e) => setNewGuildName(e.target.value)}
            placeholder="e.g. CRIMSON LEGION"
            required
          />

          <NeonInput
            id="guild-id-input"
            label="Guild ID"
            tone="red"
            value={newGuildId}
            onChange={(e) => setNewGuildId(e.target.value)}
            placeholder="e.g. GLD-882910"
            required
          />

          <RegionSelect
            id="guild-region-select"
            label="Server Region *"
            value={newGuildRegion}
            onChange={setNewGuildRegion}
            regions={GLORY_REGIONS}
          />

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
            <CheatExeButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setAddGuildModalOpen(false)}
            >
              Cancel
            </CheatExeButton>
            <NeonButton
              type="submit"
              tone="green"
              variant="filled"
              size="md"
              className="h-10 px-6 font-bold"
            >
              Enroll Guild
            </NeonButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
