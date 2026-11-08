"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  RefreshIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { NeonButton, NeonCta } from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { useEffectiveUser } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface SquadBot {
  id: string;
  name: string;
  uid: string;
  role: "MASTER" | "SLAVE";
  slaveIndex?: number;
  target: string;
  lastCheckSec: number;
  state: "CONNECTING UDP" | "STANDBY (SKIPPED)" | "IN TEAM" | "JOINING TEAM";
}

export interface LiveSquad {
  id: number;
  guildName: string;
  guildId: string;
  botCount: number;
  formation: string;
  matches: number;
  timeRemaining: string;
  roomCode: string;
  creator: string; // e.g. "@CHEATEXE" or "@RESELLER_NAME"
  statusBadge: {
    label: string;
    tone: "amber" | "cyan" | "emerald";
  };
  bots: SquadBot[];
}

export interface GuildSelectOption {
  id: string;
  name: string;
  guildId: string;
  botCount: number;
  level: number;
  members: string;
}

const INITIAL_GUILDS: GuildSelectOption[] = [
  {
    id: "3865253173",
    name: "CHEAT EXE 01",
    guildId: "3865253173",
    botCount: 11,
    level: 6,
    members: "11/50",
  },
  {
    id: "3842794144",
    name: "CHEAT2ENGINE",
    guildId: "3842794144",
    botCount: 101,
    level: 6,
    members: "97/50",
  },
];

// Sample live squads without '#' hashtag and with clean visible typography
const INITIAL_SQUADS: LiveSquad[] = [
  {
    id: 1,
    guildName: "CHEAT2ENGINE",
    guildId: "3842794144",
    botCount: 4,
    formation: "SQUAD",
    matches: 2,
    timeRemaining: "05h 01m 36s left",
    roomCode: "2970499",
    creator: "@CHEATEXE",
    statusBadge: {
      label: "ROUND COMPLETED",
      tone: "amber",
    },
    bots: [
      {
        id: "b1-1",
        name: "backup73__Q9R",
        uid: "8402593368",
        role: "MASTER",
        target: "TARGET —",
        lastCheckSec: 346.2,
        state: "CONNECTING UDP",
      },
      {
        id: "b1-2",
        name: "backup63__NA3",
        uid: "8402004767",
        role: "SLAVE",
        slaveIndex: 1,
        target: "TARGET —",
        lastCheckSec: 346.2,
        state: "CONNECTING UDP",
      },
      {
        id: "b1-3",
        name: "backup82__PAE",
        uid: "8402975442",
        role: "SLAVE",
        slaveIndex: 2,
        target: "TARGET —",
        lastCheckSec: 353.8,
        state: "STANDBY (SKIPPED)",
      },
      {
        id: "b1-4",
        name: "backup83__ANI",
        uid: "8402932782",
        role: "SLAVE",
        slaveIndex: 3,
        target: "TARGET —",
        lastCheckSec: 353.8,
        state: "STANDBY (SKIPPED)",
      },
    ],
  },
  {
    id: 2,
    guildName: "CHEAT2ENGINE",
    guildId: "3842794144",
    botCount: 4,
    formation: "SQUAD",
    matches: 47,
    timeRemaining: "05h 01m 36s left",
    roomCode: "8907674",
    creator: "@CHEATEXE",
    statusBadge: {
      label: "IN TEAM (Code: 8907674)",
      tone: "cyan",
    },
    bots: [
      {
        id: "b2-1",
        name: "backup69__FYM",
        uid: "8402336154",
        role: "MASTER",
        target: "TARGET —",
        lastCheckSec: 351.6,
        state: "IN TEAM",
      },
      {
        id: "b2-2",
        name: "backup71__QCC",
        uid: "8402595213",
        role: "SLAVE",
        slaveIndex: 1,
        target: "TARGET —",
        lastCheckSec: 351.4,
        state: "JOINING TEAM",
      },
      {
        id: "b2-3",
        name: "backup77__QDS",
        uid: "8402762720",
        role: "SLAVE",
        slaveIndex: 2,
        target: "TARGET —",
        lastCheckSec: 358.5,
        state: "JOINING TEAM",
      },
      {
        id: "b2-4",
        name: "backup81__OEY",
        uid: "8402843333",
        role: "SLAVE",
        slaveIndex: 3,
        target: "TARGET —",
        lastCheckSec: 358.2,
        state: "JOINING TEAM",
      },
    ],
  },
];

export default function MatchmakingPage() {
  const toast = useToast();
  const user = useEffectiveUser();
  const isOwner = user?.role === "OWNER";
  const userTag = user?.username ? `@${user.username.toUpperCase()}` : "@CHEATEXE";

  // Guild Selection State
  const [guilds, setGuilds] = useState<GuildSelectOption[]>(INITIAL_GUILDS);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("3842794144");
  const [formation, setFormation] = useState<"SQUAD" | "DUO">("SQUAD");
  const [isGuildOpen, setIsGuildOpen] = useState(false);
  const [isFormationOpen, setIsFormationOpen] = useState(false);
  const guildRef = useRef<HTMLDivElement>(null);
  const formationRef = useRef<HTMLDivElement>(null);

  // Live Metrics & Loops
  const [isRunning, setIsRunning] = useState(true);
  const [uptimeSeconds, setUptimeSeconds] = useState(17983.9);
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(18096); // 05h 01m 36s
  const [round, setRound] = useState(35);
  const [squads, setSquads] = useState<LiveSquad[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cheat_exe_glory_squads");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return INITIAL_SQUADS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("cheat_exe_glory_squads", JSON.stringify(squads));
    } catch {}
  }, [squads]);

  // Click outside to close custom select popups
  useEffect(() => {
    if (!isGuildOpen && !isFormationOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (guildRef.current && !guildRef.current.contains(target)) {
        setIsGuildOpen(false);
      }
      if (formationRef.current && !formationRef.current.contains(target)) {
        setIsFormationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGuildOpen, isFormationOpen]);

  // Live ticking timer & uptime simulation
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setUptimeSeconds((prev) => +(prev + 1).toFixed(1));
      setTimerSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 36000));
      // Increment last check counters gently
      setSquads((prev) =>
        prev.map((squad) => ({
          ...squad,
          bots: squad.bots.map((bot) => ({
            ...bot,
            lastCheckSec: +(bot.lastCheckSec + 1).toFixed(1),
          })),
        })),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Format 10h timer display
  const formatTimer = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s left`;
  };

  const selectedGuildObj = guilds.find((g) => g.id === selectedGuildId) || guilds[0];

  // Role Filtering:
  // - Owner sees ALL squads (from Owner + all Resellers)
  // - Reseller sees ONLY squads matching their own username tag
  const visibleSquads = isOwner
    ? squads
    : squads.filter((s) => s.creator.toUpperCase() === userTag.toUpperCase());

  // Count total bots displayed
  const totalBotsCount = visibleSquads.reduce((acc, s) => acc + s.bots.length, 0);

  const handleToggleLoop = () => {
    if (!isRunning) {
      setIsRunning(true);
      // If reseller launches and has no squad yet, auto-provision their squad
      if (!isOwner && !squads.some((s) => s.creator.toUpperCase() === userTag.toUpperCase())) {
        const newSquadId = squads.length + 1;
        const newSquad: LiveSquad = {
          id: newSquadId,
          guildName: selectedGuildObj.name,
          guildId: selectedGuildObj.guildId,
          botCount: 4,
          formation,
          matches: 0,
          timeRemaining: "09h 59m 59s left",
          roomCode: Math.floor(1000000 + Math.random() * 9000000).toString(),
          creator: userTag,
          statusBadge: {
            label: "LOGGING IN BOTS",
            tone: "amber",
          },
          bots: [
            {
              id: `b${newSquadId}-1`,
              name: `bot_${user?.username || "reseller"}_1`,
              uid: Math.floor(8000000000 + Math.random() * 1000000000).toString(),
              role: "MASTER",
              target: "TARGET —",
              lastCheckSec: 0.5,
              state: "CONNECTING UDP",
            },
            {
              id: `b${newSquadId}-2`,
              name: `bot_${user?.username || "reseller"}_2`,
              uid: Math.floor(8000000000 + Math.random() * 1000000000).toString(),
              role: "SLAVE",
              slaveIndex: 1,
              target: "TARGET —",
              lastCheckSec: 0.5,
              state: "JOINING TEAM",
            },
            {
              id: `b${newSquadId}-3`,
              name: `bot_${user?.username || "reseller"}_3`,
              uid: Math.floor(8000000000 + Math.random() * 1000000000).toString(),
              role: "SLAVE",
              slaveIndex: 2,
              target: "TARGET —",
              lastCheckSec: 1.2,
              state: "STANDBY (SKIPPED)",
            },
            {
              id: `b${newSquadId}-4`,
              name: `bot_${user?.username || "reseller"}_4`,
              uid: Math.floor(8000000000 + Math.random() * 1000000000).toString(),
              role: "SLAVE",
              slaveIndex: 3,
              target: "TARGET —",
              lastCheckSec: 1.5,
              state: "STANDBY (SKIPPED)",
            },
          ],
        };
        setSquads((prev) => [...prev, newSquad]);
      }
      toast("10-Hour Nonstop Matchmaking Loop resumed!", "success");
    } else {
      setIsRunning(false);
      toast("Matchmaking Loop paused", "info");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Configuration Card - Perfectly balanced, horizontally aligned on the exact same baseline */}
      <div
        className={cn(
          "relative rounded-[20px] border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-6 backdrop-blur-xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 ease-smooth hover:border-[rgba(255,45,90,0.4)]",
          isGuildOpen || isFormationOpen ? "z-30" : "z-10",
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Column 1: ACTIVE GUILD */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center gap-2 h-5">
              <span className="text-xs font-extrabold tracking-wider text-slate-200 uppercase font-sans">
                ACTIVE GUILD
              </span>
              <span className="text-red-400 font-bold text-xs">(MANDATORY *)</span>
            </div>

            {/* Custom Animated Guild Select */}
            <div ref={guildRef} className={cn("relative", isGuildOpen ? "z-50" : "z-20")}>
              <button
                type="button"
                onClick={() => {
                  setIsGuildOpen((prev) => !prev);
                  setIsFormationOpen(false);
                }}
                className={cn(
                  "relative flex h-[52px] w-full cursor-pointer items-center justify-between rounded-xl border px-4 outline-none select-none backdrop-blur-xl transition-all duration-200",
                  "border-[rgba(255,45,90,0.3)] bg-[linear-gradient(180deg,rgba(22,4,10,0.85),rgba(14,2,7,0.95))]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                  isGuildOpen
                    ? "border-cyan-400 shadow-[0_0_0_2px_rgba(6,182,212,0.25),0_0_16px_rgba(6,182,212,0.35)]"
                    : "hover:border-[rgba(255,60,110,0.7)]",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 font-sans text-sm">
                  <span className="font-extrabold text-white tracking-wide truncate">
                    {selectedGuildObj.name}
                  </span>
                  <span className="text-slate-300 font-mono text-xs font-semibold">
                    ({selectedGuildObj.guildId})
                  </span>
                  <span className="rounded-md border border-cyan-500/50 bg-cyan-950/60 px-2 py-0.5 text-xs font-bold text-cyan-300 font-mono">
                    &bull; {selectedGuildObj.botCount} bots
                  </span>
                </div>

                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-slate-300 transition-transform duration-300 ml-2",
                    isGuildOpen && "rotate-180 text-white",
                  )}
                />
              </button>

              {/* Popover Options matching Screenshot */}
              {isGuildOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-[999] overflow-hidden rounded-xl border border-white/20 bg-[#120409]/98 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150 p-1.5 font-sans"
                >
                  {guilds.map((guild) => {
                    const isSelected = guild.id === selectedGuildId;
                    return (
                      <div
                        key={guild.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedGuildId(guild.id);
                          setIsGuildOpen(false);
                          toast(`Selected active clan ${guild.name} (${guild.botCount} bots)`, "info");
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between px-4 py-3 rounded-lg select-none transition-colors",
                          isSelected
                            ? "bg-[#2563eb] text-white font-bold shadow-md"
                            : "text-slate-200 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <div className="flex items-center gap-2.5 text-sm">
                          <span className="font-extrabold">{guild.name}</span>
                          <span className={isSelected ? "text-blue-100" : "text-slate-400"}>
                            ({guild.guildId})
                          </span>
                          <span className={cn(
                            "rounded px-2 py-0.5 text-xs font-bold font-mono",
                            isSelected ? "bg-white/20 text-white" : "bg-cyan-950/60 text-cyan-300 border border-cyan-500/40"
                          )}>
                            &bull; {guild.botCount} bots
                          </span>
                        </div>
                        {isSelected && <CheckIcon className="size-4 text-white stroke-[2.5]" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: FORMATION */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between h-5">
              <span className="text-xs font-extrabold tracking-wider text-slate-200 uppercase font-sans">
                FORMATION
              </span>
              <span className="text-[11px] text-slate-400 font-sans font-medium">
                (auto backup swap)
              </span>
            </div>

            <div ref={formationRef} className={cn("relative", isFormationOpen ? "z-50" : "z-20")}>
              <button
                type="button"
                onClick={() => {
                  setIsFormationOpen((prev) => !prev);
                  setIsGuildOpen(false);
                }}
                className={cn(
                  "relative flex h-[52px] w-full cursor-pointer items-center justify-between rounded-xl border px-4 outline-none select-none backdrop-blur-xl transition-all duration-200",
                  "border-[rgba(255,45,90,0.3)] bg-[linear-gradient(180deg,rgba(22,4,10,0.85),rgba(14,2,7,0.95))]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                  isFormationOpen ? "border-cyan-400 shadow-[0_0_0_2px_rgba(6,182,212,0.25)]" : "hover:border-[rgba(255,60,110,0.7)]",
                )}
              >
                <span className="text-sm font-bold text-white tracking-wide truncate font-sans">
                  {formation === "SQUAD" ? "SQUAD (4 bots)" : "DUO (2 bots)"}
                </span>

                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-slate-300 transition-transform duration-300 ml-2",
                    isFormationOpen && "rotate-180 text-white",
                  )}
                />
              </button>

              {isFormationOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-[999] overflow-hidden rounded-xl border border-white/20 bg-[#120409]/98 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150 p-1.5 font-sans"
                >
                  {[
                    { id: "SQUAD", label: "SQUAD (4 bots)" },
                    { id: "DUO", label: "DUO (2 bots)" },
                  ].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setFormation(item.id as "SQUAD" | "DUO");
                        setIsFormationOpen(false);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between px-4 py-3 rounded-lg select-none transition-colors text-sm",
                        formation === item.id
                          ? "bg-[#2563eb] text-white font-bold shadow-md"
                          : "text-slate-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <span>{item.label}</span>
                      {formation === item.id && <CheckIcon className="size-4 text-white stroke-[2.5]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: SESSION DURATION & COST + CTA */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center h-5">
              <span className="text-xs font-extrabold tracking-wider text-slate-200 uppercase font-sans">
                SESSION &amp; CONTROLS
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="h-[52px] flex-1 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3.5 text-center font-sans text-xs font-bold text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2">
                <ClockIcon className="size-4 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">10h Nonstop &bull; 1 Credit / Squad</span>
              </div>

              <NeonCta
                size="md"
                onClick={handleToggleLoop}
                className="h-[52px] shrink-0 min-w-[150px] text-xs font-black tracking-wider uppercase font-sans"
                icon={<span className="text-xs">{isRunning ? "⏹" : "▶"}</span>}
                chevron
              >
                {isRunning ? "STOP LOOP" : "LAUNCH LOOP"}
              </NeonCta>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Card: Live squad & bot matrix */}
      <div className="relative overflow-hidden rounded-[20px] border border-[rgba(255,45,90,0.18)] bg-[linear-gradient(180deg,rgba(26,6,13,0.52)_0%,rgba(13,3,7,0.72)_100%)] p-6 backdrop-blur-xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 ease-smooth hover:border-[rgba(255,45,90,0.4)]">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-wide font-sans">
              Live squad &amp; bot matrix
            </h3>
            <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-3.5 py-1 font-sans text-xs font-bold text-amber-300 flex items-center gap-2 shadow-[0_0_10px_rgba(245,158,11,0.25)] uppercase tracking-wider">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              LOGGING IN BOTS
            </span>
          </div>

          {/* Right Counters */}
          <div className="flex flex-wrap items-center gap-5 text-sm font-sans">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 font-mono">
              <span>⏳ 10h Timer: {formatTimer(timerSecondsRemaining)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">Round</span>
              <span className="text-white font-bold font-mono text-base">{round}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">Uptime</span>
              <span className="text-white font-bold font-mono text-base">{uptimeSeconds}s</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Bots</span>
              <span className="text-cyan-400 font-black font-mono text-base">{totalBotsCount}</span>
            </div>
          </div>
        </div>

        {/* Scrollable squads area (Comfortably handles 2, 5, or 10-12 squads with clean scrolling) */}
        <div className="pt-6 space-y-6 max-h-[760px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-red-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-red-500/60">
          {visibleSquads.length === 0 ? (
            <div className="py-16 text-center font-sans">
              <p className="text-base font-bold text-white">No active squads for your account</p>
              <p className="mt-1 text-sm text-slate-400">
                Launch automated loop above to enroll guest bot squads into nonstop matchmaking.
              </p>
            </div>
          ) : (
            visibleSquads.map((squad) => (
              <div
                key={squad.id}
                className="rounded-2xl border border-white/10 bg-transparent p-5 backdrop-blur-xl transition-all duration-200 hover:border-white/20"
              >
                {/* Squad Header Row - Clear typography without '#' */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-extrabold text-white text-base sm:text-lg font-sans tracking-wide">
                      Squad {squad.id}: {squad.guildName} ({squad.guildId}) &bull; {squad.botCount} bots
                    </span>

                    {/* SQUAD badge */}
                    <span className="rounded-md border border-cyan-500/40 bg-cyan-950/50 px-3 py-1 text-xs font-sans font-bold text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                      {squad.formation}
                    </span>

                    {/* MATCHES badge */}
                    <span className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-1 text-xs font-sans font-bold text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                      MATCHES {squad.matches}
                    </span>

                    {/* Timer badge */}
                    <span className="rounded-md border border-amber-500/40 bg-amber-950/50 px-3 py-1 text-xs font-sans font-bold text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)] flex items-center gap-1.5">
                      <span>⏳</span>
                      <span>{squad.timeRemaining}</span>
                    </span>

                    {/* CODE badge */}
                    <span className="rounded-md border border-amber-500/40 bg-amber-950/50 px-3 py-1 text-xs font-sans font-bold text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)] font-mono">
                      CODE {squad.roomCode}
                    </span>

                    {/* Creator Tag (e.g. @CHEATEXE or @RESELLER_NAME) */}
                    <span className="rounded-md border border-purple-500/40 bg-purple-950/50 px-3 py-1 text-xs font-sans font-bold text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.2)] uppercase">
                      {squad.creator}
                    </span>
                  </div>

                  {/* Right Status Badge */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-sans text-xs font-bold shadow-md",
                        squad.statusBadge.tone === "amber" &&
                          "border border-amber-500/40 bg-amber-950/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]",
                        squad.statusBadge.tone === "cyan" &&
                          "border border-cyan-500/40 bg-cyan-950/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]",
                        squad.statusBadge.tone === "emerald" &&
                          "border border-emerald-500/40 bg-emerald-950/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
                      )}
                    >
                      <span className="size-2 rounded-full bg-current animate-pulse" />
                      {squad.statusBadge.label}
                    </span>
                  </div>
                </div>

                {/* Squad Bot Roster Table - Clear, crisp, larger fonts */}
                <div className="mt-4 overflow-x-auto bg-transparent">
                  <table className="w-full text-left text-sm bg-transparent">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-300 uppercase tracking-wider font-bold font-sans text-xs bg-transparent">
                        <th className="pb-3.5 pl-2">BOT</th>
                        <th className="pb-3.5">TARGET</th>
                        <th className="pb-3.5">LAST CHECK</th>
                        <th className="pb-3.5 text-right pr-2">STATE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] bg-transparent">
                      {squad.bots.map((bot) => (
                        <tr
                          key={bot.id}
                          className="bg-transparent hover:bg-white/[0.04] transition-colors"
                        >
                          {/* BOT Info */}
                          <td className="py-3.5 pl-2 bg-transparent">
                            <div className="flex items-center gap-3">
                              {bot.role === "MASTER" ? (
                                <span className="rounded-md border border-amber-400/60 bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300 font-sans shadow-[0_0_10px_rgba(251,191,36,0.25)] shrink-0">
                                  ★ MASTER
                                </span>
                              ) : (
                                <span className="rounded-md border border-slate-500/50 bg-slate-500/15 px-2.5 py-1 text-xs font-bold text-slate-200 font-sans shrink-0">
                                  SLAVE {bot.slaveIndex}
                                </span>
                              )}

                              <div className="flex flex-col">
                                <span className="font-extrabold text-white text-sm font-sans tracking-wide">
                                  {bot.name}
                                </span>
                                <span className="text-xs text-slate-400 font-mono tracking-wider">
                                  UID {bot.uid}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* TARGET */}
                          <td className="py-3.5 text-slate-300 bg-transparent text-sm font-sans">
                            {bot.target}
                          </td>

                          {/* LAST CHECK */}
                          <td className="py-3.5 text-rose-400 font-bold bg-transparent text-sm font-sans tracking-wide">
                            CHECK {bot.lastCheckSec.toFixed(1)}s ago
                          </td>

                          {/* STATE */}
                          <td className="py-3.5 text-right pr-2 bg-transparent">
                            {bot.state === "CONNECTING UDP" && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-1.5 font-sans text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                                <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                                CONNECTING UDP
                              </span>
                            )}

                            {bot.state === "STANDBY (SKIPPED)" && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/50 px-3.5 py-1.5 font-sans text-xs font-bold text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                                <span className="size-2 rounded-full bg-amber-400" />
                                STANDBY (SKIPPED)
                              </span>
                            )}

                            {bot.state === "IN TEAM" && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-950/50 px-3.5 py-1.5 font-sans text-xs font-bold text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.25)]">
                                <span className="size-2 rounded-full bg-teal-400 animate-pulse" />
                                IN TEAM
                              </span>
                            )}

                            {bot.state === "JOINING TEAM" && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-1.5 font-sans text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                                <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                                JOINING TEAM
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
