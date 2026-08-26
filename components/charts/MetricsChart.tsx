"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

import { useLightMode } from "@/lib/use-external";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

/** Default series, used when a caller does not narrow it. */
const LABELS = ["Total Apps", "Total Licenses", "Total Users", "Devices", "Total Resellers"];

export function MetricsChart({ values, labels = LABELS }: { values: number[]; labels?: string[] }) {
  // Re-reads the palette whenever the theme class flips.
  const light = useLightMode();

  const lineColor = light ? "#7c3aed" : "#ff1f5a";
  const gridColor = light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const tickColor = light ? "#475569" : "#94a3b8";

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { family: "Plus Jakarta Sans", weight: 600, size: 11 },
          precision: 0,
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "Plus Jakarta Sans", weight: 600, size: 11 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: light ? "rgba(255,255,255,0.95)" : "rgba(10, 11, 20, 0.95)",
        titleColor: light ? "#0f172a" : "#ffffff",
        titleFont: { family: "Plus Jakarta Sans", weight: 700 },
        bodyColor: lineColor,
        bodyFont: { family: "Plus Jakarta Sans", weight: 700 },
        borderColor: light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
      },
    },
  };

  return (
    <Line
      key={light ? "light" : "dark"}
      options={options}
      data={{
        labels,
        datasets: [
          {
            label: "Metrics",
            data: values,
            fill: true,
            backgroundColor: (context) => {
              const { ctx, chartArea } = context.chart;
              if (!chartArea) return "transparent";
              const gradient = ctx.createLinearGradient(0, 0, 0, 180);
              gradient.addColorStop(0, light ? "rgba(124, 58, 237, 0.4)" : "rgba(255, 31, 90, 0.4)");
              gradient.addColorStop(1, light ? "rgba(124, 58, 237, 0)" : "rgba(255, 31, 90, 0)");
              return gradient;
            },
            borderColor: lineColor,
            borderWidth: 3,
            tension: 0.45,
            pointBackgroundColor: lineColor,
            pointBorderColor: light ? "#ffffff" : "#020205",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: lineColor,
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 2,
          },
        ],
      }}
    />
  );
}

/**
 * Real telemetry for the chart header, not decoration.
 *
 * Picked (a) over removing the widget: both numbers are cheap to measure
 * honestly. FPS never runs a permanent rAF loop -- that would itself eat
 * frame budget on an app that is already frame-rate sensitive -- instead
 * it takes a ~1s burst of rAF deltas, averages it, and goes idle until
 * the next scheduled sample. A sample that straddles the tab going
 * hidden (rAF pauses in the background, so elapsed time balloons) is
 * discarded rather than reported as a bogus near-zero reading. Ping is a
 * real round trip to this app's own server, timed with performance.now()
 * around the session endpoint the shell already polls elsewhere -- no
 * new route, no more than one small request every 10s, and nothing while
 * the tab is hidden.
 */
export function PerformanceTicker() {
  const [fps, setFps] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const sampleFps = () => {
      if (document.hidden) return;
      const start = performance.now();
      let frames = 0;
      const tick = (now: number) => {
        frames += 1;
        const elapsed = now - start;
        if (elapsed < 1000) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        if (!cancelled && elapsed < 2000) setFps(Math.round((frames * 1000) / elapsed));
      };
      rafId = requestAnimationFrame(tick);
    };

    const samplePing = async () => {
      if (document.hidden) return;
      const start = performance.now();
      try {
        await fetch("/api/auth/session", { cache: "no-store" });
        if (!cancelled) setPing(Math.round(performance.now() - start));
      } catch {
        if (!cancelled) setPing(null);
      }
    };

    const sample = () => {
      sampleFps();
      void samplePing();
    };

    sample();
    const id = window.setInterval(sample, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      <div
        title="Client frame rate, sampled briefly every 10s"
        className="flex items-center gap-1.5 rounded-lg border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] px-2.5 py-1"
      >
        <span className="size-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
        <span className="text-[12px] font-bold text-[#10b981]">
          {fps === null ? "-- FPS" : `${fps} FPS`}
        </span>
      </div>
      <div
        title="Round-trip latency to this server"
        className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] px-2.5 py-1"
      >
        <span className="text-[12px] font-bold text-[#f59e0b]">
          {ping === null ? "-- ms" : `${ping}ms`}
        </span>
      </div>
    </div>
  );
}
