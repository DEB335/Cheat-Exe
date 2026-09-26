"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Line } from "react-chartjs-2";

import { BoltIcon } from "@/components/icons";
import { useLightMode } from "@/lib/use-external";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

/** Default series, used when a caller does not narrow it. */
const LABELS = ["Total Apps", "Total Licenses", "Total Users", "Devices", "Total Resellers"];

type Palette = {
  /** Horizontal stops for the line: hot pink, dipping to magenta mid-way. */
  line: [number, string][];
  fillTop: string;
  fillMid: string;
  fillBottom: string;
  point: string;
  ring: string;
  bloom: string;
  bloomBlur: number;
  grid: string;
  tick: string;
  guide: string;
  axisDot: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
};

const DARK: Palette = {
  line: [
    [0, "#ff2d7a"],
    [0.36, "#ff2d86"],
    [0.58, "#d946ef"],
    [0.8, "#ff3d9a"],
    [1, "#ff2d7a"],
  ],
  fillTop: "rgba(255, 45, 122, 0.58)",
  fillMid: "rgba(196, 38, 170, 0.3)",
  fillBottom: "rgba(110, 30, 190, 0.06)",
  point: "#ff2d7a",
  ring: "#ffe2ee",
  bloom: "rgba(255, 45, 122, 0.9)",
  bloomBlur: 16,
  grid: "rgba(96, 116, 214, 0.13)",
  tick: "#c9d3ef",
  guide: "rgba(255, 184, 214, 0.26)",
  axisDot: "#ffd6e6",
  tooltipBg: "rgba(6, 9, 34, 0.94)",
  tooltipTitle: "#ffffff",
  tooltipBody: "#ff5c9a",
  tooltipBorder: "rgba(120, 140, 255, 0.24)",
};

const LIGHT: Palette = {
  line: [
    [0, "#7c3aed"],
    [0.5, "#c026d3"],
    [1, "#7c3aed"],
  ],
  fillTop: "rgba(124, 58, 237, 0.3)",
  fillMid: "rgba(124, 58, 237, 0.12)",
  fillBottom: "rgba(124, 58, 237, 0)",
  point: "#7c3aed",
  ring: "#ffffff",
  bloom: "rgba(124, 58, 237, 0.35)",
  bloomBlur: 8,
  grid: "rgba(15, 23, 42, 0.07)",
  tick: "#475569",
  guide: "rgba(15, 23, 42, 0.16)",
  axisDot: "#a78bfa",
  tooltipBg: "rgba(255, 255, 255, 0.96)",
  tooltipTitle: "#0f172a",
  tooltipBody: "#7c3aed",
  tooltipBorder: "rgba(0, 0, 0, 0.08)",
};

const POINT_R = 6;
const PEAK_R = 8;

/** Below this plot width (a phone-sized card) the x labels are laid out for space. */
const COMPACT_W = 560;

/**
 * Rounds the axis top up to a 1/2/5 x 10^n step, so the gridlines land
 * on round numbers (92 -> 0..100 in 20s) instead of chart.js's own pick,
 * which on a short plot came out as 0..95 or similar.
 */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 5) return { top: 5, step: 1 };
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

/** Index of the first highest value, or -1 when there is nothing to call a peak. */
function peakIndex(values: readonly unknown[]): number {
  let best = -1;
  let bestValue = 0;
  values.forEach((v, i) => {
    if (typeof v === "number" && v > bestValue) {
      best = i;
      bestValue = v;
    }
  });
  return best;
}

/** next/font hashes the family name, so ask the page what it resolved to. */
let fontStack: string | undefined;
function pageFont(): string {
  fontStack ??= getComputedStyle(document.body).fontFamily || "sans-serif";
  return fontStack;
}

type Side = "up-right" | "up-left" | "right" | "left";

export function MetricsChart({
  values,
  labels = LABELS,
  avoid = [],
}: {
  values: number[];
  labels?: string[];
  /** Elements the peak callout must not sit on top of (the card's title, the pills). */
  avoid?: ReadonlyArray<RefObject<HTMLElement | null>>;
}) {
  // Re-reads the palette whenever the theme class flips.
  const light = useLightMode();
  const pal = light ? LIGHT : DARK;

  const calloutRef = useRef<HTMLDivElement>(null);

  // Tracked as state (not read inside chart.js callbacks) because it
  // switches the x-axis alignment, which is not a scriptable option.
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < COMPACT_W));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Kept in a ref so the plugins below (created once per chart) always see
  // the current list without the chart being torn down to pick it up.
  const avoidRef = useRef(avoid);
  useEffect(() => {
    avoidRef.current = avoid;
  });

  const peak = peakIndex(values);
  const { top, step } = niceScale(Math.max(0, ...values));

  const plugins = useMemo<Plugin<"line">[]>(() => {
    /**
     * Area fill, then bloom for the line and points only.
     *
     * The area is painted here as one closed path rather than by the
     * Filler plugin: Filler fills segment by segment under clip rects, and
     * the anti-aliased seams between them showed as a faint diagonal
     * line through the fill. It is drawn before the shadow is set, so the
     * glow never smears into the area. canvas shadowBlur ignores the
     * context transform, hence the device-pixel-ratio scale.
     */
    // The gradient is rebuilt only when the plot's height changes. Held in
    // an object so the draw callbacks mutate a field, not a captured `let`.
    const fill: { key: string; area?: CanvasGradient } = { key: "" };
    const bloom: Plugin<"line"> = {
      id: "perfBloom",
      beforeDatasetDraw(chart) {
        const { ctx, chartArea } = chart;
        const line = chart.getDatasetMeta(0).dataset as LineElement | undefined;
        const points = line?.points ?? [];
        if (line && chartArea && points.length > 1) {
          const k = `${chartArea.top}:${chartArea.bottom}`;
          if (!fill.area || k !== fill.key) {
            const area = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            area.addColorStop(0, pal.fillTop);
            area.addColorStop(0.55, pal.fillMid);
            area.addColorStop(1, pal.fillBottom);
            fill.area = area;
            fill.key = k;
          }
          ctx.save();
          ctx.beginPath();
          line.path(ctx);
          // A point's x is null only before layout; fall back to the plot edges.
          ctx.lineTo(points[points.length - 1].x ?? chartArea.right, chartArea.bottom);
          ctx.lineTo(points[0].x ?? chartArea.left, chartArea.bottom);
          ctx.closePath();
          ctx.fillStyle = fill.area;
          ctx.fill();
          ctx.restore();
        }
        ctx.save();
        ctx.shadowColor = pal.bloom;
        ctx.shadowBlur = pal.bloomBlur * chart.currentDevicePixelRatio;
      },
      afterDatasetDraw(chart) {
        chart.ctx.restore();
      },
    };

    /** Dashed drop line from every point to the axis, and a dot where it lands. */
    const guides: Plugin<"line"> = {
      id: "perfGuides",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const points = chart.getDatasetMeta(0).data;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = pal.guide;
        for (const point of points) {
          const from = point.y + PEAK_R + 3;
          if (from >= chartArea.bottom - 2) continue;
          ctx.beginPath();
          ctx.moveTo(point.x, from);
          ctx.lineTo(point.x, chartArea.bottom);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = pal.axisDot;
        ctx.shadowColor = pal.bloom;
        ctx.shadowBlur = 6 * chart.currentDevicePixelRatio;
        for (const point of points) {
          ctx.beginPath();
          ctx.arc(point.x, chartArea.bottom, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };

    /**
     * Pins the "Peak Usage" box to the highest point, in the chart's own
     * pixel space. It is an HTML overlay rather than canvas text so it
     * can be a real glass box; its position is written straight to the
     * node here, because a React state update from inside a draw hook
     * would re-render, re-update the chart and draw again. Runs after
     * every draw, which covers resizes, but only touches the DOM when the
     * peak actually moved.
     */
    const callout: Plugin<"line"> = {
      id: "perfCallout",
      afterDraw(chart) {
                const box = calloutRef.current;
        const host = box?.parentElement;
        if (!box || !host) return;

        const data = chart.data.datasets[0]?.data ?? [];
        const index = peakIndex(data);
        const point = index < 0 ? undefined : chart.getDatasetMeta(0).data[index];
        if (!point) {
          box.dataset.show = "false";
          box.dataset.key = "";
          return;
        }

        // Final (post-animation) position, so the box does not ride up
        // with the point on the first paint.
        const { x, y } = point.getProps(["x", "y"], true) as { x: number; y: number };
        const w = box.offsetWidth;
        const h = box.offsetHeight;
        const key = `${Math.round(x)}:${Math.round(y)}:${w}:${h}:${chart.width}`;
        if (box.dataset.key === key) return;
        box.dataset.key = key;

        const tail = 9;
        const candidates: { side: Side; left: number; top: number }[] = [
          { side: "up-right", left: x - 1, top: y - PEAK_R - 6 - tail - h },
          { side: "up-left", left: x - w + 1, top: y - PEAK_R - 6 - tail - h },
          { side: "right", left: x + PEAK_R + 12, top: y - h - 4 },
          { side: "left", left: x - PEAK_R - 12 - w, top: y - h - 4 },
          // On a phone the pills wrap onto their own row right above the
          // plot, so everything above the peak is taken: sit level with
          // the point, then below it, rather than on top of the pills.
          { side: "right", left: x + PEAK_R + 12, top: y - h / 2 },
          { side: "left", left: x - PEAK_R - 12 - w, top: y - h / 2 },
          { side: "right", left: x + PEAK_R + 6, top: y + PEAK_R + 6 },
          { side: "left", left: x - PEAK_R - 6 - w, top: y + PEAK_R + 6 },
        ];

        const origin = host.getBoundingClientRect();
        const blocked = avoidRef.current
          .map((ref) => ref.current?.getBoundingClientRect())
          .filter((r): r is DOMRect => !!r && r.width > 0)
          .map((r) => ({
            left: r.left - origin.left - 8,
            right: r.right - origin.left + 8,
            top: r.top - origin.top - 8,
            bottom: r.bottom - origin.top + 8,
          }));
        const fits = (c: { left: number; top: number }) =>
          c.left >= -12 &&
          c.left + w <= origin.width + 40 &&
          !blocked.some(
            (b) => c.left < b.right && c.left + w > b.left && c.top < b.bottom && c.top + h + tail > b.top,
          );
        const pick = candidates.find(fits) ?? candidates[0];

        box.style.transform = `translate(${Math.round(pick.left)}px, ${Math.round(pick.top)}px)`;
        box.dataset.side = pick.side;
        box.dataset.show = "true";
      },
    };

    return [bloom, guides, callout];
  }, [pal]);

  const options = useMemo<ChartOptions<"line">>(() => {
    const font = ({ chart }: { chart: ChartJS }) => ({
      family: pageFont(),
      size: chart.width < 560 ? 12 : 14,
      weight: 500,
    });
    return {
      responsive: true,
      maintainAspectRatio: false,
      // Bloom is per-pixel work on every redraw; a 3x phone canvas buys
      // nothing visible over 2x.
      devicePixelRatio: typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      // autoPadding would reserve room for the hover radius on every side;
      // the card already leaves that room, and the plot height is what the
      // design is measured by.
      layout: { autoPadding: false },
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          min: 0,
          max: top,
          grid: { color: pal.grid, drawTicks: false },
          border: { display: true, color: pal.grid },
          // chart.js reserves this padding on both sides of a label, and
          // also above the top tick -- which is where the plot's top
          // margin comes from, so there is no separate layout padding.
          ticks: { color: pal.tick, font, padding: 23, stepSize: step, precision: 0 },
        },
        x: {
          grid: { display: false, drawTicks: false },
          border: { display: false },
          ticks: {
            color: pal.tick,
            font: compact ? (ctx: { chart: ChartJS }) => ({ ...font(ctx), size: 11 }) : font,
            padding: 16,
            // "inner" right-aligns the last label onto its tick, which on a
            // phone pushes it into its neighbour; centred labels get their
            // half-widths reserved at both ends instead. Every label is
            // kept there too -- there are at most five and they now fit.
            align: compact ? "center" : "inner",
            autoSkip: !compact,
            maxRotation: 0,
            autoSkipPadding: 14,
            // On a phone-width card the "Total" prefix is what collides.
            callback(value) {
              const label = this.getLabelForValue(Number(value));
              return this.chart.width < 560 ? label.replace(/^Total /, "") : label;
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: pal.tooltipBg,
          titleColor: pal.tooltipTitle,
          titleFont: () => ({ family: pageFont(), weight: 700, size: 12 }),
          bodyColor: pal.tooltipBody,
          bodyFont: () => ({ family: pageFont(), weight: 700, size: 14 }),
          borderColor: pal.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          caretPadding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: { label: (item) => item.parsed.y?.toLocaleString() ?? "" },
        },
      },
    };
  }, [pal, top, step, compact]);

  const data = useMemo<ChartData<"line">>(() => {
    // The gradient depends on the plot box, which only exists after
    // layout; cache it per size so a hover redraw does not rebuild it.
    const cache: { key: string; stroke?: CanvasGradient } = { key: "" };
    return {
      labels,
      datasets: [
        {
          label: "Metrics",
          data: values,
          // Painted by the perfBloom plugin instead; see there.
          fill: false,
          clip: false,
          cubicInterpolationMode: "monotone",
          borderColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return pal.point;
            const k = `${chartArea.left}:${chartArea.right}`;
            if (!cache.stroke || k !== cache.key) {
              const stroke = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
              for (const [at, color] of pal.line) stroke.addColorStop(at, color);
              cache.stroke = stroke;
              cache.key = k;
            }
            return cache.stroke;
          },
          borderWidth: 3.5,
          pointBackgroundColor: pal.point,
          pointBorderColor: pal.ring,
          pointBorderWidth: 2.5,
          pointRadius: (context) => (context.dataIndex === peak ? PEAK_R : POINT_R),
          pointHoverRadius: (context) => (context.dataIndex === peak ? PEAK_R + 2 : POINT_R + 2.5),
          pointHoverBackgroundColor: pal.point,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 3,
          pointHitRadius: 18,
        },
      ],
    };
  }, [labels, values, pal, peak]);

  return (
    <div ref={rootRef} className="relative size-full">
      <Line key={light ? "light" : "dark"} options={options} data={data} plugins={plugins} />
      {peak >= 0 && (
        <div
          ref={calloutRef}
          data-show="false"
          title={`${labels[peak]}: ${values[peak].toLocaleString()}`}
          className={cn(
            "group/peak pointer-events-none absolute top-0 left-0 z-[2] min-w-[92px] rounded-[10px] border px-3 py-[7px]",
            "border-[rgba(128,146,255,0.26)] bg-[rgba(7,10,36,0.88)] shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
            "opacity-0 transition-opacity duration-300 data-[show=true]:opacity-100",
            "lt:border-[rgba(15,23,42,0.1)] lt:bg-white/95 lt:shadow-[0_10px_30px_rgba(15,23,42,0.1)]",
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] leading-none font-medium text-[#d5dcf5] lt:text-slate-600">
            <span className="size-[6px] rounded-full bg-[#ff2d7a] shadow-[0_0_6px_#ff2d7a] lt:bg-[#7c3aed] lt:shadow-none" />
            Peak Usage
          </div>
          <div className="mt-[5px] text-[16px] leading-none font-bold text-white tabular-nums lt:text-slate-900">
            {values[peak].toLocaleString()}
          </div>
          {/* Speech-bubble tail, only when the box sits above the point. */}
          <svg
            aria-hidden
            viewBox="0 0 10 10"
            className={cn(
              "absolute top-[calc(100%-1px)] hidden size-[10px]",
              "group-data-[side=up-right]/peak:left-[-1px] group-data-[side=up-right]/peak:block",
              "group-data-[side=up-left]/peak:right-[-1px] group-data-[side=up-left]/peak:block group-data-[side=up-left]/peak:-scale-x-100",
            )}
          >
            <path d="M0 0 H10 L0.5 9.5 Z" className="fill-[rgb(7,10,36)] lt:fill-white" />
            <path d="M0.5 0 V9.5 L10 0" className="fill-none stroke-[rgba(128,146,255,0.26)] lt:stroke-[rgba(15,23,42,0.1)]" />
          </svg>
        </div>
      )}
    </div>
  );
}

/** A desktop display; the shared MonitorIcon is drawn as a chip. */
function ScreenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <line x1="8" y1="20.5" x2="16" y2="20.5" />
      <line x1="12" y1="16.5" x2="12" y2="20.5" />
    </svg>
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

  const pill = cn(
    "flex h-11 min-w-[104px] items-center justify-center gap-2.5 rounded-xl border px-4",
    "text-[16px] leading-none font-bold tabular-nums whitespace-nowrap",
    "transition-transform duration-300 ease-smooth hover:-translate-y-0.5",
  );

  return (
    <div className="flex items-center gap-3 sm:gap-[18px]">
      <div
        title="Client frame rate, sampled briefly every 10s"
        className={cn(
          pill,
          "border-[rgba(22,214,150,0.5)] bg-[#022b2c] text-[#3fe3ae]",
          "shadow-[0_0_16px_rgba(16,185,129,0.2),inset_0_0_14px_rgba(16,185,129,0.12)]",
          "lt:border-[rgba(16,185,129,0.35)] lt:bg-[rgba(16,185,129,0.1)] lt:text-[#047857] lt:shadow-none",
        )}
      >
        <ScreenIcon className="size-[19px] shrink-0" />
        <span>{fps === null ? "-- FPS" : `${fps} FPS`}</span>
      </div>
      <div
        title="Round-trip latency to this server"
        className={cn(
          pill,
          "border-[rgba(236,160,58,0.5)] bg-[#261c15] text-[#ffc454]",
          "shadow-[0_0_16px_rgba(245,158,11,0.16),inset_0_0_14px_rgba(245,158,11,0.1)]",
          "lt:border-[rgba(217,119,6,0.35)] lt:bg-[rgba(245,158,11,0.1)] lt:text-[#b45309] lt:shadow-none",
        )}
      >
        <BoltIcon className="size-[18px] shrink-0" />
        <span>{ping === null ? "-- ms" : `${ping}ms`}</span>
      </div>
    </div>
  );
}
