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

  const series = [
    metrics.apps,
    metrics.licenses,
    metrics.users,
    metrics.devices,
    metrics.resellers,
  ];

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
            <MetricsChart values={series} />
          </div>
        </Card>
      </div>

      <div data-probe="stats" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        <StatCard
          accent="purple"
          icon={<FolderIcon className="size-5" />}
          value={metrics.apps}
          label="Total Apps"
        />
        <StatCard
          accent="red"
          icon={<KeyIcon className="size-5" />}
          value={metrics.licenses}
          label="Total Licenses"
        />
        <StatCard
          accent="cyan"
          icon={<UsersIcon className="size-5" />}
          value={metrics.users}
          label="Total Users"
        />
        <StatCard
          accent="green"
          icon={<CpuIcon className="size-5" />}
          value={metrics.devices}
          label={
            <>
              Devices <LivePip />
            </>
          }
        />
        <StatCard
          accent="orange"
          icon={<BriefcaseIcon className="size-5" />}
          value={metrics.resellers}
          label="Total Resellers"
        />
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
