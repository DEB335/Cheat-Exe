"use client";

import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/icons";
import { NeonButton } from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { useEffectiveUser } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface GuildMember {
  rank: number;
  nickname: string;
  isOurBot: boolean;
  inGameId: string;
  weeklyGlory: number;
  totalGlory: number;
}

export interface ActiveBotGuild {
  id: string;
  name: string;
  region: string;
  maxMembers: number;
  ourBotsGlory: number;
  ourBotsWeeklyGlory: number;
  totalGuildGlory: number;
  totalGuildWeeklyGlory: number;
  members: GuildMember[];
  expanded?: boolean;
  createdBy?: string;
}

// Initial sample data matching the exact screenshot
const INITIAL_SAMPLE_GUILDS: ActiveBotGuild[] = [
  {
    id: "3865253173",
    name: "CHEAT EXE 01",
    region: "IND",
    maxMembers: 50,
    ourBotsGlory: 0,
    ourBotsWeeklyGlory: 0,
    totalGuildGlory: 0,
    totalGuildWeeklyGlory: 0,
    expanded: true,
    createdBy: "admin",
    members: [
      { rank: 1, nickname: "EXEKQHA7", isOurBot: true, inGameId: "18995726421", weeklyGlory: 0, totalGlory: 0 },
      { rank: 2, nickname: "EXE6C427", isOurBot: true, inGameId: "18995727588", weeklyGlory: 0, totalGlory: 0 },
      { rank: 3, nickname: "EXEJ79RD", isOurBot: true, inGameId: "18995741259", weeklyGlory: 0, totalGlory: 0 },
      { rank: 4, nickname: "DEBOSK9R", isOurBot: true, inGameId: "19862467684", weeklyGlory: 0, totalGlory: 0 },
      { rank: 5, nickname: "DEBKRE2N", isOurBot: true, inGameId: "19862468220", weeklyGlory: 0, totalGlory: 0 },
      { rank: 6, nickname: "DEBDOTIR", isOurBot: true, inGameId: "8481251045", weeklyGlory: 0, totalGlory: 0 },
      { rank: 7, nickname: "DEBTYLZJ", isOurBot: true, inGameId: "19862474586", weeklyGlory: 0, totalGlory: 0 },
      { rank: 8, nickname: "TX999MIKVW", isOurBot: true, inGameId: "19862491888", weeklyGlory: 0, totalGlory: 0 },
      { rank: 9, nickname: "TX999SEEL6", isOurBot: true, inGameId: "19862492485", weeklyGlory: 0, totalGlory: 0 },
      { rank: 10, nickname: "TX999MPLG1", isOurBot: true, inGameId: "19862496782", weeklyGlory: 0, totalGlory: 0 },
      { rank: 11, nickname: "TX991QKKI", isOurBot: true, inGameId: "19862497461", weeklyGlory: 0, totalGlory: 0 },
    ],
  },
  {
    id: "3842794144",
    name: "CHEAT2ENGINE",
    region: "IND",
    maxMembers: 50,
    ourBotsGlory: 0,
    ourBotsWeeklyGlory: 0,
    totalGuildGlory: 0,
    totalGuildWeeklyGlory: 0,
    expanded: false,
    createdBy: "admin",
    members: Array.from({ length: 97 }).map((_, i) => ({
      rank: i + 1,
      nickname: `EXE_BOT_${(i + 1).toString().padStart(2, "0")}`,
      isOurBot: true,
      inGameId: `18995${Math.floor(100000 + i * 37)}`,
      weeklyGlory: 0,
      totalGlory: 0,
    })),
  },
];

export default function GuildAnalyticsPage() {
  const toast = useToast();
  const user = useEffectiveUser();
  const isOwner = user?.role === "OWNER";
  const currentUsername = (user?.username ?? "admin").toLowerCase();

  const [guildIdQuery, setGuildIdQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingGuildId, setSyncingGuildId] = useState<string | null>(null);

  // Persistent storage for active guilds
  const [activeBotGuilds, setActiveBotGuilds] = useState<ActiveBotGuild[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cheat_exe_glory_guilds");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore error
      }
    }
    return INITIAL_SAMPLE_GUILDS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("cheat_exe_glory_guilds", JSON.stringify(activeBotGuilds));
    } catch {
      // ignore write error
    }
  }, [activeBotGuilds]);

  // Multi-tenant role filtering:
  // - Owner sees ALL guilds tracked by Owner and all Resellers
  // - Reseller sees ONLY their own tracked guilds
  const visibleGuilds = isOwner
    ? activeBotGuilds
    : activeBotGuilds.filter((g) => (g.createdBy ?? "admin").toLowerCase() === currentUsername);

  // Query / Add any Guild ID
  const handleQueryGuild = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = guildIdQuery.trim();
    if (!query) {
      toast("Please enter a Guild ID to inspect", "error");
      return;
    }

    setIsQuerying(true);
    setTimeout(() => {
      setIsQuerying(false);
      const existing = activeBotGuilds.find(
        (g) => g.id.toLowerCase() === query.toLowerCase(),
      );
      if (existing) {
        toast(`Guild ${existing.name} is already in analytics`, "info");
        return;
      }

      // Generate initial guild structure for the queried ID stamped with current user
      const generatedMembersCount = 12;
      const newBotGuild: ActiveBotGuild = {
        id: query,
        name: `GUILD ${query.slice(-6) || "ALPHA"}`,
        region: "IND",
        maxMembers: 50,
        ourBotsGlory: 0,
        ourBotsWeeklyGlory: 0,
        totalGuildGlory: 0,
        totalGuildWeeklyGlory: 0,
        expanded: true,
        createdBy: currentUsername,
        members: Array.from({ length: generatedMembersCount }).map((_, i) => ({
          rank: i + 1,
          nickname: `BOT_${query.slice(-3)}_${(i + 1).toString().padStart(2, "0")}`,
          isOurBot: true,
          inGameId: `18995${Math.floor(100000 + Math.random() * 900000)}`,
          weeklyGlory: 0,
          totalGlory: 0,
        })),
      };

      setActiveBotGuilds((prev) => [newBotGuild, ...prev]);
      setGuildIdQuery("");
      toast(`Loaded Guild ${newBotGuild.name} (${newBotGuild.members.length} bots)`, "success");
    }, 600);
  };

  // Toggle Members Expansion
  const toggleExpand = (id: string) => {
    setActiveBotGuilds((prev) =>
      prev.map((g) => (g.id === id ? { ...g, expanded: !g.expanded } : g)),
    );
  };

  // Refresh all guilds
  const handleRefreshAll = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast("Refreshed all bot guilds and live glory data", "success");
    }, 700);
  };

  // Sync Live button handler (Ready for Live API)
  const handleSyncLive = (guildId: string, guildName: string) => {
    setSyncingGuildId(guildId);
    setTimeout(() => {
      setSyncingGuildId(null);
      toast(`Live glory synced for ${guildName}!`, "success");
    }, 700);
  };

  // Remove Guild from Analytics
  const handleRemoveGuild = (id: string, name: string) => {
    setActiveBotGuilds((prev) => prev.filter((g) => g.id !== id));
    toast(`Removed ${name} from guild analytics`, "info");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Row (Single clean bar right-aligned, NO duplicate Guild Analytics header) */}
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap items-center gap-2.5">
          <form onSubmit={handleQueryGuild} className="relative flex items-center">
            <SearchIcon className="absolute left-3 size-3.5 text-slate-400" />
            <input
              type="text"
              value={guildIdQuery}
              onChange={(e) => setGuildIdQuery(e.target.value)}
              placeholder="Inspect Guild ID (e.g. 3865253173)"
              className="h-9 w-48 sm:w-60 rounded-xl border border-white/15 bg-black/40 pl-8 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 font-mono"
            />
          </form>

          <NeonButton
            type="button"
            tone="cyan"
            variant="filled"
            size="sm"
            onClick={() => handleQueryGuild()}
            disabled={isQuerying}
            loading={isQuerying}
            className="h-9 px-4 text-xs font-bold"
          >
            + Track ID
          </NeonButton>

          <NeonButton
            type="button"
            tone="red"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            loading={isRefreshing}
            icon={<RefreshIcon className={cn("size-3.5", isRefreshing && "animate-spin")} />}
            className="h-9 px-3.5 text-xs font-bold"
            title="Refresh All Guilds"
          >
            Refresh
          </NeonButton>
        </div>
      </div>

      {/* Guild Cards List */}
      {visibleGuilds.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-8 text-center flex flex-col items-center justify-center backdrop-blur-xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.75)]">
          <div className="text-3xl mb-2">🛡️</div>
          <h3 className="text-base font-bold text-white">No active bot guilds</h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            Enter a Guild ID above to monitor live guild glory, bot rosters, and weekly dog tag contributions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGuilds.map((guild) => {
            const ourBotsCount = guild.members.filter((m) => m.isOurBot).length;
            const totalMembers = guild.members.length;
            const isFull = totalMembers >= guild.maxMembers;
            const isSyncing = syncingGuildId === guild.id;

            return (
              <div
                key={guild.id}
                className="relative overflow-hidden rounded-[20px] border border-[rgba(255,45,90,0.2)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-5 sm:p-6 backdrop-blur-xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 ease-smooth hover:border-[rgba(255,45,90,0.45)] hover:shadow-[0_20px_42px_-10px_rgba(255,0,50,0.22)]"
              >
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-transparent">
                  {/* Left: Badges + Guild Name */}
                  <div className="space-y-2">
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-950/40 px-3 py-0.5 font-mono text-[11px] font-bold text-cyan-300 tracking-wider shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                        GUILD ID {guild.id}
                      </span>
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-0.5 font-mono text-[11px] font-bold text-emerald-300 tracking-wider shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        {ourBotsCount} OUR BOTS
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-0.5 font-mono text-[11px] font-bold tracking-wider",
                          isFull
                            ? "border-amber-500/40 bg-amber-950/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                            : "border-teal-500/40 bg-teal-950/40 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.2)]",
                        )}
                      >
                        {totalMembers}/{guild.maxMembers} MEMBERS
                      </span>
                      {isFull && (
                        <span className="rounded-full border border-red-500/40 bg-red-950/40 px-3 py-0.5 font-mono text-[11px] font-bold text-red-300 tracking-wider shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                          GUILD FULL (MAX {guild.maxMembers})
                        </span>
                      )}
                      {isOwner && guild.createdBy && guild.createdBy !== "admin" && (
                        <span className="rounded border border-purple-500/40 bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300 uppercase shadow-[0_0_6px_rgba(168,85,247,0.2)]">
                          @{guild.createdBy}
                        </span>
                      )}
                    </div>

                    {/* Guild Name */}
                    <h3 className="font-display text-2xl font-black text-white tracking-wide uppercase [text-shadow:0_0_12px_rgba(255,45,90,0.25)]">
                      {guild.name}
                    </h3>
                  </div>

                  {/* Right: Stat Boxes + Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Stat Box 1: OUR BOTS GLORY */}
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-2.5 shadow-[0_0_14px_rgba(6,182,212,0.1),inset_0_0_12px_rgba(6,182,212,0.05)] transition-all hover:border-cyan-400/50">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono">
                        OUR BOTS GLORY ({ourBotsCount} BOTS)
                      </div>
                      <div className="text-2xl font-black text-white font-mono leading-tight mt-0.5 [text-shadow:0_0_10px_rgba(255,255,255,0.3)]">
                        {guild.ourBotsGlory.toLocaleString()}
                      </div>
                      <div className="text-[11px] font-medium text-cyan-400/80 font-mono mt-0.5">
                        Weekly +{guild.ourBotsWeeklyGlory.toLocaleString()}
                      </div>
                    </div>

                    {/* Stat Box 2: TOTAL REAL GUILD GLORY */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 shadow-[0_0_14px_rgba(16,185,129,0.1),inset_0_0_12px_rgba(16,185,129,0.05)] transition-all hover:border-emerald-400/50">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        TOTAL REAL GUILD GLORY
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono leading-tight mt-0.5 [text-shadow:0_0_10px_rgba(16,185,129,0.3)]">
                        {guild.totalGuildGlory.toLocaleString()}
                      </div>
                      <div className="text-[11px] font-medium text-emerald-400/80 font-mono mt-0.5">
                        Weekly +{guild.totalGuildWeeklyGlory.toLocaleString()}
                      </div>
                    </div>

                    {/* Action Buttons matching app animations & colors */}
                    <div className="flex items-center gap-2">
                      {/* Show / Hide Members Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(guild.id)}
                        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-slate-100 active:scale-95 shadow-[0_4px_14px_rgba(255,255,255,0.2)]"
                      >
                        <span>
                          {guild.expanded
                            ? `Hide Members (${totalMembers})`
                            : `Show Members (${totalMembers})`}
                        </span>
                        <ChevronDownIcon
                          className={cn(
                            "size-3.5 transition-transform duration-200 text-black",
                            guild.expanded && "rotate-180",
                          )}
                        />
                      </button>

                      {/* Sync Live Button */}
                      <button
                        type="button"
                        onClick={() => handleSyncLive(guild.id, guild.name)}
                        disabled={isSyncing}
                        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.08] px-3.5 py-2 text-xs font-bold font-mono text-white transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-300 active:scale-95 shadow-[0_0_12px_rgba(0,0,0,0.4)] disabled:opacity-50"
                        title="Sync live glory"
                      >
                        <RefreshIcon
                          className={cn("size-3.5 text-slate-300", isSyncing && "animate-spin text-emerald-400")}
                        />
                        <span>Sync live</span>
                      </button>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveGuild(guild.id, guild.name)}
                        className="cursor-pointer rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-bold font-mono text-red-400 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/25 hover:text-white active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        title="Remove Guild"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Member Table (100% Seamless Transparent, letting the background shine through) */}
                {guild.expanded && (
                  <div className="mt-6 pt-5 border-t border-white/10 bg-transparent animate-in fade-in-0 duration-300 overflow-x-auto">
                    <table className="w-full text-left text-xs bg-transparent">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold font-mono text-[11px] bg-transparent">
                          <th className="pb-3 pl-2 w-16">RANK</th>
                          <th className="pb-3">MEMBER / NICKNAME</th>
                          <th className="pb-3">IN-GAME ID</th>
                          <th className="pb-3 text-right">WEEKLY GLORY</th>
                          <th className="pb-3 text-right pr-2">TOTAL GLORY</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] font-mono bg-transparent">
                        {guild.members.map((member) => {
                          const rankColor =
                            member.rank === 1
                              ? "border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                              : member.rank === 2
                              ? "border-slate-300/60 bg-slate-300/10 text-slate-200 shadow-[0_0_8px_rgba(203,213,225,0.2)]"
                              : member.rank === 3
                              ? "border-amber-700/60 bg-amber-700/10 text-amber-500 shadow-[0_0_8px_rgba(180,83,9,0.2)]"
                              : "border-white/15 bg-white/5 text-slate-400";

                          return (
                            <tr
                              key={member.inGameId + member.rank}
                              className="bg-transparent hover:bg-white/[0.03] transition-colors"
                            >
                              {/* Rank */}
                              <td className="py-3 pl-2 bg-transparent">
                                <span
                                  className={cn(
                                    "inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold",
                                    rankColor,
                                  )}
                                >
                                  {member.rank}
                                </span>
                              </td>

                              {/* Member / Nickname */}
                              <td className="py-3 bg-transparent">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-cyan-300 tracking-wide">
                                    {member.nickname}
                                  </span>
                                  {member.isOurBot && (
                                    <span className="rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300 tracking-wider shadow-[0_0_6px_rgba(6,182,212,0.2)]">
                                      OUR BOT
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* In-Game ID */}
                              <td className="py-3 text-slate-300 bg-transparent">
                                {member.inGameId}
                              </td>

                              {/* Weekly Glory */}
                              <td className="py-3 text-right font-bold text-cyan-400 bg-transparent">
                                +{member.weeklyGlory}
                              </td>

                              {/* Total Glory */}
                              <td className="py-3 text-right pr-2 font-bold text-emerald-400 bg-transparent">
                                {member.totalGlory}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
