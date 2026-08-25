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

const LABELS = ["Total Apps", "Total Licenses", "Total Users", "Devices", "Total Resellers"];

export function MetricsChart({ values }: { values: number[] }) {
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
        labels: LABELS,
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

/** The simulated FPS / ping readouts in the chart card header. */
export function PerformanceTicker() {
  const [fps, setFps] = useState(60);
  const [ping, setPing] = useState(12);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFps(Math.floor(Math.random() * 2) + 59);
      setPing(Math.floor(Math.random() * 3) + 9);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5 rounded-lg border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] px-2.5 py-1">
        <span className="size-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
        <span className="text-[12px] font-bold text-[#10b981]">{fps} FPS</span>
      </div>
      <div className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] px-2.5 py-1">
        <span className="text-[12px] font-bold text-[#f59e0b]">{ping}ms</span>
      </div>
    </div>
  );
}
