"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { emitClickWave } from "@/components/effects/ClickWave";
import { NAV_GROUPS, PROFILE_ITEM, type NavItem } from "@/lib/nav";
import { useDashboard } from "@/lib/store";
import { useStoredFlag } from "@/lib/use-external";
import type { Role } from "@/lib/types";
import { cn, hexToRgbTriplet } from "@/lib/utils";

const STORAGE_KEY = "sidebarCollapsed";

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);
  const role: Role = user?.role ?? "RESELLER";

  const [collapsed, setCollapsed] = useStoredFlag(STORAGE_KEY);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  const badges = {
    devices: db.cheatExeDevices.length,
    banned: db.cheatExeBannedUsers.length,
  };

  const visibleGroups = NAV_GROUPS.filter(
    (group) => group.roles.includes(role) && group.items.some((item) => item.roles.includes(role)),
  );

  return (
    <>
      {/* Scrim behind the mobile drawer */}
      <div
        role="presentation"
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-20 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        data-collapsed={collapsed}
        className={cn(
          "sidebar-scroll fixed inset-y-0 left-0 z-30 m-5 flex flex-col overflow-x-hidden overflow-y-auto",
          "h-[calc(100vh-40px)] border border-white/8 bg-[rgba(10,15,30,0.55)] pt-[30px] pb-6 backdrop-blur-[30px]",
          "transition-[width,transform,border-radius] duration-[400ms] ease-smooth",
          "lt:border-black/8 lt:bg-white/60",
          "lg:relative lg:inset-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%]",
          collapsed ? "sidebar-ring w-[85px] rounded-[42.5px]" : "w-[270px] rounded-[24px]",
        )}
      >
        <LogoArea collapsed={collapsed} />

        {/* One wrapper for every group, matching the original .nav-group:
            the section labels are inline, not separate blocks. */}
        <div className="mb-[30px]">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div
                  data-probe="group-label"
                  className="mb-3 px-7 text-[11px] font-extrabold tracking-[1.8px] text-muted uppercase"
                >
                  {group.label}
                </div>
              )}
              {group.items
                .filter((item) => item.roles.includes(role))
                .map((item) => (
                  <NavLink
                    key={`${group.label}-${item.href}-${item.label}`}
                    item={item}
                    collapsed={collapsed}
                    active={pathname === item.href}
                    badge={item.badge ? badges[item.badge] : undefined}
                    onNavigate={onCloseMobile}
                    onTooltip={setTooltip}
                  />
                ))}
            </div>
          ))}
        </div>

        <NavLink
          item={PROFILE_ITEM}
          collapsed={collapsed}
          active={pathname === PROFILE_ITEM.href}
          onNavigate={onCloseMobile}
          onTooltip={setTooltip}
          className="mt-auto shrink-0"
        />

        <UserCard collapsed={collapsed} onTooltip={setTooltip} />

        <DragHandle collapsed={collapsed} onToggle={setCollapsed} />
      </aside>

      {tooltip && collapsed ? (
        <div
          className={cn(
            "pointer-events-none fixed z-[999999] -translate-y-1/2 rounded-lg border border-white/8",
            "bg-[rgba(10,15,30,0.9)] px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-fg",
            "shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-[10px]",
          )}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      ) : null}
    </>
  );
}

type TooltipSetter = (value: { label: string; x: number; y: number } | null) => void;

function NavLink({
  item,
  collapsed,
  active,
  badge,
  onNavigate,
  onTooltip,
  className,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  badge?: number;
  onNavigate: () => void;
  onTooltip: TooltipSetter;
  className?: string;
}) {
  const Icon = item.icon;
  const ref = useRef<HTMLAnchorElement>(null);

  const showTooltip = () => {
    if (!collapsed || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onTooltip({ label: item.label, x: rect.right + 12, y: rect.top + rect.height / 2 });
  };

  const handleClick = () => {
    onTooltip(null);
    if (collapsed && ref.current) emitClickWave(ref.current, item.color);
    onNavigate();
  };

  return (
    <Link
      ref={ref}
      href={item.href}
      onMouseEnter={showTooltip}
      onMouseLeave={() => onTooltip(null)}
      onClick={handleClick}
      style={{ "--tab": hexToRgbTriplet(item.color) } as React.CSSProperties}
      className={cn(
        "relative flex shrink-0 items-center overflow-hidden whitespace-nowrap",
        "text-[13px] font-bold transition-all duration-300 ease-smooth",
        collapsed
          ? [
              // Collapsed rail: circular icon buttons, one accent each.
              "mx-auto mb-2.5 size-11 justify-center gap-0 rounded-full p-0",
              active
                ? [
                    "border-2 border-[rgb(var(--tab))] bg-[rgba(var(--tab),0.15)] text-[rgb(var(--tab))]",
                    "shadow-[0_0_15px_rgba(var(--tab),0.85),inset_0_0_8px_rgba(var(--tab),0.4)]",
                    "hover:bg-[rgba(var(--tab),0.22)]",
                    "hover:shadow-[0_0_20px_rgba(var(--tab),0.95),inset_0_0_10px_rgba(var(--tab),0.5)]",
                  ]
                : [
                    "text-muted hover:bg-[rgba(var(--tab),0.08)] hover:text-[rgb(var(--tab))]",
                    "hover:shadow-[0_0_12px_rgba(var(--tab),0.35),inset_0_0_4px_rgba(var(--tab),0.15)]",
                  ],
            ]
          : [
              // Expanded: gradient wipe sliding in from the left edge.
              "mx-4 mb-1.5 gap-3.5 rounded-xl px-[18px] py-3",
              "before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-0",
              "before:rounded-[inherit] before:transition-[width] before:duration-500 before:content-['']",
              active
                ? "text-accent before:w-full before:bg-[rgba(255,31,90,0.12)]"
                : [
                    "text-muted hover:text-accent",
                    "before:bg-[linear-gradient(to_right,rgba(255,31,90,0.15)_0%,rgba(255,94,58,0.15)_100%)]",
                    "hover:before:w-full",
                  ],
            ],
        className,
      )}
    >
      <Icon
        className={cn(
          "relative z-[2] size-5 shrink-0 transition-[transform,color] duration-[400ms] ease-back",
          active ? "opacity-100" : "opacity-80",
          !collapsed && "group-hover:scale-115",
        )}
      />
      {!collapsed && (
        <>
          <span className="relative z-[2]">{item.label}</span>
          {badge !== undefined && (
            <span
              className={cn(
                "relative z-[2] ml-auto shrink-0 rounded-[10px] border px-1.5 py-0.5 text-[10px] font-bold",
                item.badge === "banned"
                  ? "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
                  : "border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.15)] text-[#10b981]",
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function LogoArea({ collapsed }: { collapsed: boolean }) {
  const avatar = useDashboard((s) => s.db.profile.avatar);

  return (
    // Original: padding: 20px 0 30px, gap 10px, centred.
    <div className={cn("flex items-center justify-center pt-5 pb-[30px]", !collapsed && "gap-2.5")}>
      <div
        className={cn(
          "glow-ring hover:glow-ring-fast relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-full",
          "border-[1.5px] border-[rgba(255,31,90,0.4)] shadow-[0_0_8px_rgba(255,31,90,0.3)] transition-all duration-300",
        )}
      >
        {/* Animated GIF from an arbitrary CDN -- next/image would need a
            configured remote loader for no benefit here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className="size-full object-cover" />
      </div>
      {!collapsed && (
        <div
          data-probe="logo"
          className="text-rgb-flow font-display text-[22px] font-extrabold tracking-[1px] select-none"
        >
          CHEAT EXE
        </div>
      )}
    </div>
  );
}

function UserCard({ collapsed, onTooltip }: { collapsed: boolean; onTooltip: TooltipSetter }) {
  const user = useDashboard((s) => s.user);
  const profile = useDashboard((s) => s.db.profile);
  const ref = useRef<HTMLDivElement>(null);
  const name = user?.role === "OWNER" ? profile.displayName : (user?.username ?? "");

  return (
    <div
      ref={ref}
      data-probe="user-card"
      onMouseEnter={() => {
        if (!collapsed || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        onTooltip({ label: name, x: rect.right + 12, y: rect.top + rect.height / 2 });
      }}
      onMouseLeave={() => onTooltip(null)}
      className={cn(
        "flex items-center border-t border-sidebar-line pt-6",
        collapsed ? "justify-center px-0" : "justify-between px-6",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "gap-0" : "gap-3")}>
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[rgba(255,31,90,0.4)] bg-input-bg shadow-[0_0_8px_rgba(255,31,90,0.3)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt="" className="size-full object-cover" />
        </div>
        {!collapsed && (
          <div className="whitespace-nowrap">
            <h4 className="text-[13px] font-[750] text-fg">{name}</h4>
            <p className="flex items-center gap-1.5 text-[11px] font-[750] text-green before:size-1.5 before:rounded-full before:bg-green before:shadow-[0_0_8px_var(--accent-green)] before:content-['']">
              {user?.role === "OWNER" ? "Account Owner" : "Reseller"} &bull; active
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Drag or swipe the right edge past 40px to collapse or expand,
 * reproducing the original gesture.
 */
function DragHandle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: (next: boolean) => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const collapsedRef = useRef(collapsed);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    const applyDelta = (currentX: number) => {
      const delta = currentX - startX.current;
      if (collapsedRef.current && delta > 40) {
        onToggle(false);
        startX.current = currentX;
      } else if (!collapsedRef.current && delta < -40) {
        onToggle(true);
        startX.current = currentX;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      applyDelta(event.clientX);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onToggle]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to collapse"
      onMouseDown={(event) => {
        dragging.current = true;
        startX.current = event.clientX;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
      }}
      onTouchStart={(event) => {
        startX.current = event.touches[0]!.clientX;
      }}
      onTouchMove={(event) => {
        const currentX = event.touches[0]!.clientX;
        const delta = currentX - startX.current;
        if (collapsed && delta > 40) {
          onToggle(false);
          startX.current = currentX;
        } else if (!collapsed && delta < -40) {
          onToggle(true);
          startX.current = currentX;
        }
      }}
      className="absolute top-0 -right-2 z-[1000] hidden h-full w-4 cursor-ew-resize lg:block"
    />
  );
}
