"use client";

import { useRouter } from "next/navigation";

import { MetricsChart, PerformanceTicker } from "@/components/charts/MetricsChart";
import { BriefcaseIcon, CpuIcon, FolderIcon, KeyIcon, UsersIcon } from "@/components/icons";
import { DevicesTable } from "@/components/tables/DevicesTable";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { GlowButton } from "@/components/ui/GlowButton";
import { LivePip, StatCard } from "@/components/ui/StatCard";
import { useDashboard, useMetrics } from "@/lib/store";

export default function OverviewPage() {
  const router = useRouter();
  const metrics = useMetrics();
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  // Nothing records who used a reseller's keys, and a reseller has no
  // sub-resellers -- so for them those two tiles could only ever show a
  // hardcoded 0. Drop them rather than dress up a number nobody can know.
  const tiles = [
    { key: "apps", label: "Total Apps", value: metrics.apps, accent: "purple" as const, icon: <FolderIcon className="size-5" /> },
    { key: "licenses", label: "Total Licenses", value: metrics.licenses, accent: "red" as const, icon: <KeyIcon className="size-5" /> },
    ...(isOwner
      ? [{ key: "users", label: "Total Users", value: metrics.users, accent: "cyan" as const, icon: <UsersIcon className="size-5" /> }]
      : []),
    {
      key: "devices",
      label: "Devices",
      value: metrics.devices,
      accent: "green" as const,
      icon: <CpuIcon className="size-5" />,
      live: true,
    },
    ...(isOwner
      ? [{ key: "resellers", label: "Total Resellers", value: metrics.resellers, accent: "orange" as const, icon: <BriefcaseIcon className="size-5" /> }]
      : []),
  ];

  const series = tiles.map((t) => t.value);
  const labels = tiles.map((t) => t.label);

  return (
    <>
      <div className="mb-[30px]">
        <Card className="p-0">
          {/* Original .card-header: padding 24px 24px 0, plus its own
              24px bottom margin before the chart. */}
          <div className="p-6 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-[18px] font-bold text-fg">System Performance</h3>
                <p className="mt-1.5 text-[13px] text-muted">Real-time metrics &amp; latency.</p>
              </div>
              <PerformanceTicker />
            </div>
          </div>
          {/* Original .chart-container: height 200px, padding 0 15px 15px,
              max-width 100% and overflow hidden so the canvas cannot
              push the page wider than the viewport. */}
          <div className="relative h-[200px] w-full max-w-full overflow-hidden px-[15px] pb-[15px]">
            <MetricsChart values={series} labels={labels} />
          </div>
        </Card>
      </div>

      <div data-probe="stats" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            accent={tile.accent}
            icon={tile.icon}
            value={tile.value}
            label={
              tile.live ? (
                <>
                  {tile.label} <LivePip />
                </>
              ) : (
                tile.label
              )
            }
          />
        ))}
      </div>

      {isOwner && (
        <Card flat className="mt-6">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                Real-Time Active Devices
                <Badge tone="green">{metrics.devices} Online Now</Badge>
              </span>
            }
            subtitle="Live devices connected via authenticated sessions."
            actions={
              <GlowButton onClick={() => router.push("/devices")}>
                View All Devices &amp; Controls
              </GlowButton>
            }
          />
          <DevicesTable variant="overview" />
        </Card>
      )}
    </>
  );
}
