"use client";

import { useRouter } from "next/navigation";

import { DevicesBanner } from "@/components/dashboard/DevicesBanner";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { LiveDevices } from "@/components/devices/LiveDevices";
import { AppsIcon, BriefcaseIcon, CpuIcon, LinkIcon, UsersIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { StatCard, type StatAccent } from "@/components/ui/StatCard";
import { useDashboard, useMetrics } from "@/lib/store";
import { useTileTrends, type TileKey } from "@/lib/trends";

interface Tile {
  key: TileKey;
  label: string;
  value: number;
  accent: StatAccent;
  icon: React.ReactNode;
  live?: boolean;
}

export default function OverviewPage() {
  const router = useRouter();
  const metrics = useMetrics();
  const trends = useTileTrends();
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  // Nothing records who used a reseller's keys, and a reseller has no
  // sub-resellers -- so for them those two tiles could only ever show a
  // hardcoded 0. Drop them rather than dress up a number nobody can know.
  const ownerOnly = (tile: Tile): Tile[] => (isOwner ? [tile] : []);
  const tiles: Tile[] = [
    { key: "apps", label: "Total Apps", value: metrics.apps, accent: "purple", icon: <AppsIcon className="size-6" /> },
    { key: "licenses", label: "Total Licenses", value: metrics.licenses, accent: "red", icon: <LinkIcon className="size-6" /> },
    ...ownerOnly({ key: "users", label: "Total Users", value: metrics.users, accent: "cyan", icon: <UsersIcon className="size-6" /> }),
    { key: "devices", label: "Devices", value: metrics.devices, accent: "green", icon: <CpuIcon className="size-6" />, live: true },
    ...ownerOnly({ key: "resellers", label: "Total Resellers", value: metrics.resellers, accent: "orange", icon: <BriefcaseIcon className="size-6" /> }),
  ];

  const series = tiles.map((t) => t.value);
  const labels = tiles.map((t) => t.label);

  return (
    <>
      <PerformanceCard values={series} labels={labels} />

      <div
        data-probe="stats"
        className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5"
      >
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            accent={tile.accent}
            icon={tile.icon}
            value={tile.value}
            label={tile.label}
            live={tile.live}
            trend={trends[tile.key]}
          />
        ))}
      </div>

      {isOwner && (
        <Card flat className="mt-6 overflow-hidden p-0">
          <DevicesBanner online={metrics.devices} onViewAll={() => router.push("/devices")} />
          <div className="px-4 pt-5 pb-7 sm:px-[30px] sm:pt-6 sm:pb-[34px]">
            <LiveDevices />
          </div>
        </Card>
      )}
    </>
  );
}
