"use client";

import { useEffect, useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { DeviceSummary } from "@/components/devices/DeviceSummary";
import { DeviceToolbar, type RoleFilter } from "@/components/devices/DeviceToolbar";
import { LiveDevicesTable } from "@/components/devices/LiveDevicesTable";
import { parseDeviceUser } from "@/lib/device-parse";
import { useDashboard } from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

/**
 * The live sessions, on the overview under the "Real-Time Active
 * Devices" banner and on /devices: four summary chips, search and role
 * filter, then the table in a glass panel with its own pager.
 *
 * Every number comes from the store -- sessions, the accounts behind
 * them, the block rules, the addresses -- so nothing here can show more
 * than the table underneath can back up.
 */
export function LiveDevices() {
  const devices = useDashboard((s) => s.db.cheatExeDevices);
  const bans = useDashboard((s) => s.db.cheatExeBans);
  const sessionId = useDashboard((s) => s.user?.sessionId);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);

  const stats = useMemo(
    () => ({
      online: devices.length,
      accounts: new Set(devices.map((d) => d.user)).size,
      // Blocks, not rules: one "Ban HWID" writes an hwid and a fingerprint
      // rule at the same instant, and that is one blocked device.
      blocked: new Set(
        bans.map((b) => (b.scope === "ip" ? `ip:${b.value}` : `device:${b.at}:${b.user ?? b.value}`)),
      ).size,
      uniqueIps: new Set(devices.map((d) => d.ip)).size,
    }),
    [devices, bans],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return devices.filter((d) => {
      const who = parseDeviceUser(d.user);
      if (role !== "all" && who.role !== role) return false;
      if (!needle) return true;
      return [who.name, who.role, d.ip, d.device].some((field) => field.toLowerCase().includes(needle));
    });
  }, [devices, query, role]);

  // A kick that empties the last page lands on the one before it. The
  // clamp is written back, or the list growing again would jump the view
  // forward to a page nobody picked.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (page > pageCount) setPage(pageCount);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const narrowed = query.trim() !== "" || role !== "all";
  const emptyMessage =
    devices.length === 0
      ? "No active sessions."
      : query.trim()
        ? `No devices match "${query.trim()}".`
        : "No devices match this filter.";

  return (
    // A container, not the viewport, decides when chips and search share
    // a line: the card is ~820px wide on a 1280px screen and ~1200px on a
    // wide one, and the four chips need the latter.
    <div className="@container">
      <div className="flex flex-col gap-4 @min-[1080px]:flex-row @min-[1080px]:items-center">
        <DeviceSummary stats={stats} className="min-w-0 @min-[1080px]:flex-[3.3]" />
        <DeviceToolbar
          query={query}
          onQuery={(q) => {
            setQuery(q);
            setPage(1);
          }}
          role={role}
          onRole={(r) => {
            setRole(r);
            setPage(1);
          }}
          className="w-full @min-[1080px]:w-auto @min-[1080px]:flex-[1.25]"
        />
      </div>

      <GlassPanel className="mt-5">
        <LiveDevicesTable devices={rows} currentSessionId={sessionId} emptyMessage={emptyMessage} />

        <div
          className={cn(
            "relative flex flex-wrap items-center justify-between gap-3 px-5 py-3.5",
            "border-t border-[rgba(59,130,246,0.18)] lt:border-blue-100",
          )}
        >
          <span className="text-[12.5px] text-[#9fb4dc] lt:text-muted">
            {filtered.length === 0
              ? `Showing 0 of 0 devices`
              : `Showing ${start + 1}–${start + rows.length} of ${filtered.length} devices`}
            {narrowed && devices.length !== filtered.length && (
              <span className="text-[#6f86b5] lt:text-muted"> (filtered from {devices.length})</span>
            )}
          </span>
          <Pager page={current} pageCount={pageCount} onPage={setPage} />
        </div>
      </GlassPanel>
    </div>
  );
}

/**
 * The neon glass slab the table sits in.
 *
 * It tips back a few degrees and settles flat once, on mount; a highlight
 * sits along its top, a blue reflection pools underneath, and one band of
 * light runs along the top edge -- moved by transform alone, so it never
 * repaints the table under it.
 */
function GlassPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // One frame at the tilted pose first, or the browser has nothing to
    // transition from. Reduced motion skips the pose entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(id);
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <div className={cn("relative [perspective:1400px]", className)}>
      {/* Reflection: the panel's glow pooling on the card beneath it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] -bottom-4 h-8 rounded-[50%] bg-[rgba(37,99,235,0.35)] blur-2xl lt:bg-[rgba(59,130,246,0.18)]"
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-[18px] border [transform-origin:50%_0%]",
          "border-[rgba(59,130,246,0.55)]",
          "bg-[linear-gradient(180deg,rgba(16,34,96,0.62)_0%,rgba(8,16,52,0.82)_45%,rgba(5,10,36,0.9)_100%)]",
          "shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_0_30px_-4px_rgba(37,99,235,0.55),0_24px_40px_-24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(147,197,253,0.22),inset_0_0_40px_rgba(37,99,235,0.08)]",
          "transition-[transform,opacity] duration-[900ms] ease-smooth",
          "lt:border-blue-200 lt:bg-none lt:bg-white/85",
          "lt:shadow-[0_0_0_1px_rgba(59,130,246,0.06),0_14px_34px_-18px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.9)]",
          settled
            ? "[transform:none] opacity-100"
            : "[transform:rotateX(9deg)_translateY(18px)_scale(0.985)] opacity-0",
        )}
      >
        {/* Top highlight: the glass catching light along its upper edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(125,170,255,0.1),transparent)] lt:bg-none lt:bg-transparent"
        />
        {/* The travelling light along the top border. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden">
          <div
            className={cn(
              // Hidden, not frozen, under reduced motion: with the animation
              // cut to one instant frame it would rest mid-border as a bar.
              "animate-panel-sweep h-full w-1/4 motion-reduce:hidden",
              "bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.95),transparent)]",
              "shadow-[0_0_12px_rgba(56,189,248,0.9)]",
              "lt:bg-none lt:bg-[rgba(59,130,246,0.55)] lt:shadow-none",
            )}
          />
        </div>

        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

/** Page numbers with the ends always reachable and gaps shown as dots. */
function pageList(page: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = new Set([1, count, page - 1, page, page + 1]);
  const out: Array<number | "gap"> = [];
  for (let n = 1; n <= count; n++) {
    if (keep.has(n)) out.push(n);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

const PAGER_BUTTON = cn(
  "flex size-8 cursor-pointer items-center justify-center rounded-full border text-[12.5px] font-bold",
  "transition-[transform,box-shadow,background-color,border-color] duration-200 ease-smooth",
  "enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40",
);

const PAGER_IDLE = cn(
  "border-[rgba(59,130,246,0.35)] text-[#9cc3ff]",
  "bg-[linear-gradient(180deg,rgba(37,64,150,0.55),rgba(10,20,62,0.85))]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_8px_-2px_rgba(0,0,0,0.55)]",
  "enabled:hover:border-[rgba(96,165,250,0.7)] enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_12px_rgba(59,130,246,0.45)]",
  "lt:border-blue-200 lt:bg-none lt:bg-white lt:text-blue-600 lt:shadow-[0_2px_6px_-2px_rgba(37,99,235,0.35)]",
);

const PAGER_ACTIVE = cn(
  "border-[rgba(147,197,253,0.8)] text-white",
  "bg-[linear-gradient(180deg,#4f8dff,#1d4ed8)]",
  "shadow-[0_0_16px_rgba(59,130,246,0.8),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.25)]",
  "lt:bg-none lt:bg-blue-600 lt:shadow-[0_4px_12px_-3px_rgba(37,99,235,0.7)]",
);

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Devices pages" className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={cn(PAGER_BUTTON, PAGER_IDLE)}
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      {pageList(page, pageCount).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="px-0.5 text-[12px] text-[#6f86b5] lt:text-muted">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
            className={cn(PAGER_BUTTON, n === page ? PAGER_ACTIVE : PAGER_IDLE)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className={cn(PAGER_BUTTON, PAGER_IDLE)}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </nav>
  );
}
