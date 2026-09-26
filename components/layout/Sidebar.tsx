"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { emitClickWave } from "@/components/effects/ClickWave";
import { AppsIcon, ChevronLeftIcon, ChevronRightIcon, LinkIcon } from "@/components/icons";
import { NAV_GROUPS, PROFILE_ITEM, canSeeItem, type NavItem } from "@/lib/nav";
import { useDashboard, useMyPackages } from "@/lib/store";
import { useMediaQuery, useStoredFlag } from "@/lib/use-external";
import type { Role } from "@/lib/types";
import { cn, hexToRgbTriplet } from "@/lib/utils";

const STORAGE_KEY = "sidebarCollapsed";

/**
 * Below this the 290px rail eats too much of the row: at 1024px it left
 * the content column under 700px wide, so the tables and the two-column
 * forms started fighting for space. Between here and the mobile drawer
 * the sidebar is forced to its icon rail whatever the saved preference
 * says, and the preference is restored above it.
 */
const NARROW = "(max-width: 1279px)";

/**
 * The active tab's icon is stroked with this instead of a flat colour.
 * userSpaceOnUse so the gradient spans the whole 24px glyph -- the
 * default bounding-box units would restart it on every rect and path,
 * and a four-square grid came out as four identical little gradients.
 */
const ACTIVE_ICON_GRADIENT = "sidebar-active-icon";

/**
 * The navy fill both boxes share. Opaque on purpose: the rail used to be
 * frosted glass over the page, and a 30px backdrop blur sitting on top
 * of the particle canvas has to be recomputed every frame the canvas
 * draws -- for a panel the design paints as solid navy anyway.
 */
const PANEL_SURFACE = [
  "border border-[#12203f] bg-[linear-gradient(90deg,#030b1d_0%,#050f24_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.35)]",
  "lt:border-black/8 lt:bg-none lt:bg-white/85 lt:shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
];

type BadgeCounts = Record<NonNullable<NavItem["badge"]>, number>;
type Glyph = NavItem["icon"];

/** Speech bubble with the three typing dots the redesign draws for Messages. */
function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M8.5 11.6h.01M12.5 11.6h.01M16.5 11.6h.01" strokeWidth="2.6" />
    </svg>
  );
}

/** One person and a small ring -- the redesign's reseller glyph. */
function ResellerIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <circle cx="19.5" cy="5.5" r="1.75" />
    </svg>
  );
}

/**
 * Where the redesign draws a tab with a different glyph than lib/nav
 * gives it. Only the sidebar draws nav icons, so swapping them here
 * leaves nothing else showing the old one; keyed by route, the same
 * swap covers both roles' copy of a tab.
 */
const GLYPHS: Partial<Record<string, Glyph>> = {
  "/dashboard": AppsIcon,
  "/messages": ChatIcon,
  "/generator": LinkIcon,
  "/resellers": ResellerIcon,
};

/**
 * Glyphs made of closed shapes, which the active pill paints solid the
 * way the reference does. A line glyph filled the same way turns into a
 * blob, so everything else keeps the gradient on its stroke only.
 */
const SOLID_WHEN_ACTIVE = new Set<Glyph>([AppsIcon]);

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
  // Grants as they stand, not as they were at sign-in -- a permission the
  // owner revokes pings, the ping refetches the account record, and the
  // section disappears on the spot instead of at the next sign-in.
  const packages = useMyPackages();

  const [preferCollapsed, setPreferCollapsed] = useStoredFlag(STORAGE_KEY);
  const narrow = useMediaQuery(NARROW);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  // The drawer always shows labels; only the desktop rail collapses.
  const collapsed = (preferCollapsed || narrow) && !mobileOpen;
  const canToggle = !narrow;

  // A tooltip left over from before a collapse points at an element that
  // has just moved, so the toggle clears it on the way through.
  const setCollapsedPreference = (next: boolean) => {
    setTooltip(null);
    setPreferCollapsed(next);
  };

  const badges: BadgeCounts = {
    devices: db.cheatExeDevices.length,
    banned: db.cheatExeBannedUsers.length,
    // Same count the header bell shows, read off the same list, so the
    // two can never disagree about how many are waiting.
    messages: db.cheatExeMessages.filter((m) => !m.read).length,
  };

  const visibleGroups = NAV_GROUPS.filter(
    (group) =>
      group.roles.includes(role) &&
      group.items.some((item) => canSeeItem(item, user, packages)),
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

      {/* The darker column the rail sits in. Fixed and behind <main>, so
          it frames the rail without taking part in the layout; only the
          full rail gets it, the icon pill floats on its own. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed top-0 bottom-1.5 left-0 z-[1] hidden w-[333px] rounded-r-[26px]",
          "border-r border-[rgba(70,100,180,0.16)] bg-[linear-gradient(90deg,rgba(0,4,16,0.92)_0%,rgba(2,9,27,0.94)_100%)]",
          "transition-opacity duration-[400ms] lt:border-black/5 lt:bg-none lt:bg-white/30 lg:block",
          collapsed ? "opacity-0" : "opacity-100",
        )}
      />

      <aside
        data-collapsed={collapsed}
        className={cn(
          // The golden ring lives on this element, so it must NOT be the
          // scroll container: it is an inset-0 pseudo-element, and inside
          // a scrolling box it slid up with the content and drew halfway
          // off the rail. It no longer clips either -- the two boxes
          // inside round and clip themselves -- which is what lets the
          // collapse toggle sit whole across the right edge instead of
          // being cut in half by it.
          "fixed inset-y-0 left-0 z-30 m-5 flex flex-col",
          "h-[calc(100vh-40px)]",
          "transition-[width,height,transform,border-radius,margin] duration-[400ms] ease-smooth",
          "lg:relative lg:inset-auto lg:translate-x-0",
          // Closed, the drawer is the 85px rail: 120% of that (102px) left
          // 3px and its ring glow showing past the 20px margin. Clear the
          // margin and the glow outright instead.
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+60px)]",
          collapsed
            ? "sidebar-ring w-[85px] rounded-[42.5px]"
            : // 31px in and 9px out keeps the rail where the design puts
              // it while the whole footprint stays 330px, so <main> and
              // everything in it starts exactly where it did.
              // The reference also stands the full rail 26px off the
              // bottom edge, a little higher than the icon pill's 20.
              "w-[min(290px,78vw)] rounded-[22px] lg:mr-[9px] lg:mb-[26px] lg:ml-[31px] lg:h-[calc(100vh-46px)] lg:w-[290px]",
        )}
      >
        {/* Referenced by the active icon's stroke. Zero-sized rather than
            display:none, which would stop the gradient painting at all. */}
        <svg aria-hidden focusable="false" className="pointer-events-none absolute size-0 overflow-hidden">
          <defs>
            <linearGradient
              id={ACTIVE_ICON_GRADIENT}
              gradientUnits="userSpaceOnUse"
              x1="4"
              y1="3"
              x2="20"
              y2="21"
            >
              <stop offset="0" stopColor="#f4b8ff" />
              <stop offset="0.45" stopColor="#ff7fc9" />
              <stop offset="1" stopColor="#ff3d97" />
            </linearGradient>
          </defs>
        </svg>

        <div
          className={cn(
            PANEL_SURFACE,
            "flex min-h-0 flex-1 flex-col overflow-hidden transition-[border-radius] duration-[400ms] ease-smooth",
            // Collapsed, the two boxes join into the one pill the golden
            // ring runs around; expanded the user card hangs square-topped
            // off this box's rounded bottom, the way the reference joins them.
            collapsed ? "rounded-t-[42.5px] rounded-b-none border-b-0" : "rounded-[22px]",
          )}
        >
          {/* The nav scrolls in here; the user card below stays pinned. A
              short viewport used to cut the card in half with no hint that
              there was anything left to scroll to. */}
          <div
            className={cn(
              "sidebar-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto",
              collapsed ? "pt-[30px]" : "pb-3",
            )}
          >
            <LogoArea collapsed={collapsed} />

            {/* One wrapper for every group, matching the original .nav-group:
                the section labels are inline, not separate blocks. */}
            <div className={collapsed ? "mb-5" : "mb-2"}>
              {visibleGroups.map((group, index) => (
                <div key={group.label}>
                  {!collapsed && index > 0 && <Divider />}
                  {!collapsed && (
                    <div
                      data-probe="group-label"
                      className={cn(
                        "mb-2 px-5 text-[12px] leading-4 font-extrabold tracking-[1.6px] uppercase",
                        "text-[#abc8f4] lt:text-muted",
                      )}
                    >
                      {group.label}
                    </div>
                  )}
                  {group.items
                    .filter((item) => canSeeItem(item, user, packages))
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

            <div className="mt-auto shrink-0">
              {!collapsed && <Divider />}
              <NavLink
                item={PROFILE_ITEM}
                collapsed={collapsed}
                active={pathname === PROFILE_ITEM.href}
                onNavigate={onCloseMobile}
                onTooltip={setTooltip}
              />
            </div>
          </div>
        </div>

        <UserCard collapsed={collapsed} onTooltip={setTooltip} />

        {canToggle && (
          <>
            <CollapseToggle
              collapsed={collapsed}
              onToggle={() => setCollapsedPreference(!collapsed)}
            />
            <DragHandle collapsed={collapsed} onToggle={setCollapsedPreference} />
          </>
        )}
      </aside>

      {tooltip && collapsed && !mobileOpen ? (
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

/** Hairline between nav groups, inset to the label column. */
function Divider() {
  return <div aria-hidden className="mx-5 mt-1.5 mb-3 h-px bg-[#0e1a38] lt:bg-black/8" />;
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
  const Icon = GLYPHS[item.href] ?? item.icon;
  const solid = active && !collapsed && SOLID_WHEN_ACTIVE.has(Icon);
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

  // An unread count of nothing is not news; the device and ban counts
  // are, so those two stay up at zero as they always have.
  const showBadge = badge !== undefined && (item.badge !== "messages" || badge > 0);

  return (
    <Link
      ref={ref}
      href={item.href}
      // Every tab is one dynamic segment under a cookie-reading layout,
      // so the default "auto" prefetch fetched nothing usable and each
      // click paid for a full RSC round trip before it could paint.
      // These links are all on screen from the first render, so pulling
      // the whole segment in up front is what makes a tab switch land
      // immediately. (Prefetching is production-only; `next dev` will
      // always show the round trip.)
      prefetch
      onMouseEnter={showTooltip}
      onMouseLeave={() => onTooltip(null)}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      style={{ "--tab": hexToRgbTriplet(item.color) } as React.CSSProperties}
      className={cn(
        "group/nav relative flex shrink-0 items-center overflow-hidden whitespace-nowrap",
        "transition-all duration-300 ease-smooth",
        collapsed
          ? [
              // Collapsed rail: circular icon buttons, one accent each.
              "mx-auto mb-2 size-11 justify-center gap-0 rounded-full p-0 text-[13px] font-bold",
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
              // Expanded: 50px rows. Every row carries the 1px border, so
              // the active pill's gradient edge does not nudge its label
              // a pixel off the column the others line up on.
              "mr-2.5 mb-0.5 ml-1 h-[50px] gap-[20px] rounded-[18px] border border-transparent pr-[13px] pl-[23px]",
              "text-[15px] font-medium",
              "before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-0",
              "before:rounded-[inherit] before:transition-[width] before:duration-500 before:content-['']",
              active
                ? [
                    // Magenta into indigo, edged in the same pink-to-violet
                    // run as the wordmark: fill on the padding box, the
                    // edge on the border box behind it.
                    "text-white",
                    "[background:linear-gradient(90deg,#4a1553_0%,#33124f_5%,#28114f_11%,#1c1268_45%,#211a80_70%,#2b26a8_86%,#3530c6_95%,#4034df_100%)_padding-box,linear-gradient(90deg,#ff4d9a_0%,#e0439f_12%,#8a2fb8_32%,#4a2a9e_55%,#4f3ccc_78%,#6a5cff_100%)_border-box]",
                    "shadow-[-5px_3px_18px_-6px_rgba(255,45,122,0.7),6px_0_20px_-6px_rgba(91,85,255,0.75),inset_10px_-6px_16px_-10px_rgba(255,45,122,0.45)]",
                    "hover:shadow-[-5px_3px_22px_-5px_rgba(255,45,122,0.85),6px_0_24px_-5px_rgba(91,85,255,0.9),inset_10px_-6px_18px_-8px_rgba(255,45,122,0.55)]",
                  ]
                : [
                    // Gradient wipe sliding in from the left edge.
                    "text-[#cfdefa] hover:text-accent lt:text-fg lt:hover:text-accent",
                    "before:bg-[linear-gradient(to_right,rgba(255,31,90,0.15)_0%,rgba(255,94,58,0.15)_100%)]",
                    "hover:before:w-full",
                  ],
            ],
        className,
      )}
    >
      <Icon
        className={cn(
          "relative z-[2] shrink-0 transition-[transform,color] duration-[400ms] ease-back",
          collapsed
            ? ["size-5", active ? "opacity-100" : "opacity-80"]
            : [
                "size-6 group-hover/nav:scale-115",
                active
                  ? "drop-shadow-[0_0_6px_rgba(255,77,157,0.55)]"
                  : "text-[#adc6f5] group-hover/nav:text-accent lt:text-muted lt:group-hover/nav:text-accent",
              ],
        )}
        style={
          active && !collapsed
            ? {
                stroke: `url(#${ACTIVE_ICON_GRADIENT})`,
                strokeWidth: solid ? 1.6 : 2.4,
                fill: solid ? `url(#${ACTIVE_ICON_GRADIENT})` : undefined,
              }
            : undefined
        }
      />
      {collapsed && item.badge === "messages" && badge ? (
        // The rail has no room for the count, but an unread message
        // should not vanish just because the sidebar is narrow.
        <span
          aria-hidden
          className="absolute top-2 right-2 z-[2] size-2 rounded-full bg-[#e11d48] shadow-[0_0_6px_rgba(225,29,72,0.8)]"
        />
      ) : null}
      {!collapsed && (
        <>
          <span className="relative z-[2] min-w-0 truncate">{item.label}</span>
          {showBadge && (
            <span
              aria-label={item.badge === "messages" ? `${badge} unread` : undefined}
              className={cn(
                "relative z-[2] ml-auto flex shrink-0 items-center justify-center rounded-full",
                "text-[12.5px] font-bold tabular-nums",
                item.badge === "messages"
                  ? "h-[26px] min-w-[26px] bg-[#9c1a4d] px-1.5 text-white shadow-[0_0_12px_rgba(225,29,72,0.35)] lt:bg-[#e11d48]"
                  : item.badge === "banned"
                    ? "h-[22px] min-w-[34px] bg-[rgba(239,68,68,0.16)] px-2 text-[#f87171] lt:text-[#dc2626]"
                    : "h-[22px] min-w-[34px] bg-[#033d36] px-2 text-[#4ff3cf] lt:bg-[rgba(16,185,129,0.15)] lt:text-[#059669]",
              )}
            >
              {badge > 99 ? "99+" : badge}
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
    <div
      className={cn(
        "flex shrink-0 items-center",
        collapsed ? "justify-center pt-5 pb-5" : "gap-[17px] pt-[18px] pb-[33px] pl-5",
      )}
    >
      <div
        className={cn(
          "glow-ring hover:glow-ring-fast relative shrink-0 cursor-pointer overflow-hidden rounded-full",
          "border-[1.5px] border-[rgba(235,38,38,0.8)] transition-all duration-300",
          "shadow-[0_0_14px_rgba(255,31,31,0.45),0_0_3px_rgba(255,40,40,0.6)]",
          collapsed ? "size-11" : "size-14",
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
          className="text-rgb-flow font-display text-[30px] leading-none font-extrabold tracking-[0.2px] select-none"
          // Same four-stop loop the utility runs on hover, starting from
          // the design's softer pink rather than the accent red. Inline
          // so it lands over the utility's own image whatever order the
          // stylesheet puts them in; the size and clip still come from it.
          style={{
            backgroundImage:
              "linear-gradient(90deg, #ff5470 0%, #ff4e9c 10%, #f040d0 17%, #a54bff 24%, #7048f0 33.3%, #00ddeb 66.6%, #ff5470 100%)",
          }}
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
        PANEL_SURFACE,
        "flex shrink-0 items-center overflow-hidden transition-[border-radius] duration-[400ms] ease-smooth",
        collapsed
          ? "justify-center rounded-t-none rounded-b-[42.5px] border-t-sidebar-line px-0 pt-5 pb-6"
          : // -1px so its top edge and the nav box's bottom edge draw as
            // the one line the reference shows between them.
            "-mt-px h-[90px] justify-between rounded-t-none rounded-b-[22px] px-[18px]",
      )}
    >
      <div className={cn("flex min-w-0 items-center", collapsed ? "gap-0" : "gap-[18px]")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-input-bg",
            "border-[1.5px] border-[rgba(235,38,38,0.8)] shadow-[0_0_12px_rgba(255,31,31,0.45),0_0_3px_rgba(255,40,40,0.6)]",
            collapsed ? "size-9" : "size-[50px]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt="" className="size-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0 whitespace-nowrap">
            <h4 className="truncate text-[15px] font-bold text-white lt:text-fg">{name}</h4>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-[#36eec6] lt:text-green",
                "before:mr-0.5 before:size-[9px] before:shrink-0 before:rounded-full before:bg-[#3dffd2] before:shadow-[0_0_8px_rgba(42,245,189,0.8)] before:content-['']",
                "lt:before:bg-green",
              )}
            >
              {user?.role === "OWNER" ? "Account Owner" : "Reseller"}
              <span aria-hidden className="mx-0.5">&bull;</span>
              active
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Visible collapse control.
 *
 * The rail could only ever be collapsed by dragging its right edge --
 * no affordance, no keyboard route, and nothing at all on a trackpad-shy
 * user's first visit. The drag still works; this just makes it findable.
 */
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = collapsed ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      className={cn(
        // A little below the middle, level with the History group, where
        // the reference has it.
        "absolute top-[56%] z-[1001] hidden size-6 -translate-y-1/2 items-center justify-center",
        "rounded-full border border-[#1a2a52] bg-[#030a1e] text-[#8ea6d8]",
        "shadow-[0_4px_12px_rgba(0,0,0,0.45)]",
        "transition-all duration-300 ease-smooth",
        "hover:border-[rgba(255,31,90,0.45)] hover:text-accent",
        "lt:border-black/10 lt:bg-white lt:text-muted",
        "lg:flex",
        "-right-3",
      )}
    >
      <Icon className="size-3.5" />
    </button>
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
