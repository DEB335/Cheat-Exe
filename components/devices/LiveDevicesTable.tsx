"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BrowserIcon, OsIcon } from "@/components/devices/DeviceIcons";
import {
  BanIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  CpuChipIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  UserIcon,
  WifiOffIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { parseDevice, parseDeviceUser } from "@/lib/device-parse";
import type { DeviceSession, Role } from "@/lib/types";
import { deviceRules, useDeviceActions } from "@/lib/use-device-actions";
import { cn, splitStampForDisplay } from "@/lib/utils";

const COLUMNS = ["STATUS", "USER ACCOUNT", "DEVICE & BROWSER", "IP ADDRESS", "LOGGED IN", "ACTION"];

/** Row entrance stagger. Ten rows finish inside half a second. */
const STAGGER_MS = 45;

/**
 * The overview's live session list, drawn as a neon glass table.
 *
 * It renders exactly the rows it is handed -- search, filters and paging
 * belong to the caller -- so a page change mounts fresh rows and they
 * tip in again, while a refresh of the same page leaves them still.
 */
export function LiveDevicesTable({
  devices,
  currentSessionId,
  emptyMessage = "No active sessions.",
}: {
  devices: DeviceSession[];
  currentSessionId?: string;
  emptyMessage?: string;
}) {
  const { kick, block } = useDeviceActions();

  return (
    // Phones scroll the table sideways rather than squash six columns
    // into 360px.
    <div className="-mx-2 overflow-x-auto px-2 pb-1">
      <div className="relative min-w-[760px]">
        {/* One band of light crossing the header, clipped to it. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-11 overflow-hidden rounded-t-xl">
          <span className="animate-panel-sweep absolute motion-reduce:hidden inset-y-0 left-0 w-1/5 bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.22),transparent)] lt:bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.14),transparent)]" />
        </div>

        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className={cn(
                    "h-11 border-b border-[rgba(96,165,250,0.28)] px-2.5 whitespace-nowrap 2xl:px-4",
                    "text-[11.5px] font-extrabold tracking-[1.3px] text-[#dbeafe]/85 uppercase",
                    "lt:border-[rgba(59,130,246,0.25)] lt:text-slate-600",
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="p-6 text-center text-[13px] text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              devices.map((device, index) => (
                <DeviceRow
                  key={device.sessionId}
                  device={device}
                  index={index}
                  isCurrent={device.sessionId === currentSessionId}
                  onKick={kick}
                  onBlock={block}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Actions = ReturnType<typeof useDeviceActions>;

function DeviceRow({
  device,
  index,
  isCurrent,
  onKick,
  onBlock,
}: {
  device: DeviceSession;
  index: number;
  isCurrent: boolean;
  onKick: Actions["kick"];
  onBlock: Actions["block"];
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const { name, role } = parseDeviceUser(device.user);
  const parsed = parseDevice(device.device);
  const stamp = splitStampForDisplay(device.timestamp);
  const hasDeviceId = Boolean(device.hwid || device.fingerprint);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copyIp = async () => {
    try {
      await navigator.clipboard.writeText(device.ip);
      setCopied(true);
      toast(`IP ${device.ip} copied to clipboard!`, "success");
    } catch {
      toast("Could not copy -- the browser refused clipboard access.", "error");
    }
  };

  return (
    <tr
      // Backwards fill only: once the entrance ends the row's own
      // transform applies again, which is what lets hover lift it.
      style={{ animationDelay: `${index * STAGGER_MS}ms` }}
      className={cn(
        "group/row animate-device-row-in relative [animation-fill-mode:backwards]",
        "transition-[transform,box-shadow] duration-300 ease-smooth",
        "hover:z-[1] hover:-translate-y-0.5",
        "hover:shadow-[0_14px_30px_-14px_rgba(59,130,246,0.7)] lt:hover:shadow-[0_14px_30px_-16px_rgba(59,130,246,0.45)]",
        // Faint blue rule under every row, and a brighter glass fill on hover.
        "[&>td]:border-b [&>td]:border-[rgba(96,165,250,0.12)] [&>td]:transition-colors [&>td]:duration-300",
        "hover:[&>td]:bg-[rgba(59,130,246,0.09)] [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl",
        "lt:[&>td]:border-[rgba(59,130,246,0.14)] lt:hover:[&>td]:bg-[rgba(59,130,246,0.06)]",
      )}
    >
      {/* Status. The neon accent bar rides this cell's left edge on hover. */}
      <td
        className={cn(
          "relative px-2.5 py-3 2xl:px-4",
          "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:content-['']",
          "before:bg-[#3b82f6] before:opacity-0 before:shadow-[0_0_10px_#3b82f6] before:transition-opacity",
          "group-hover/row:before:opacity-100",
        )}
      >
        <div className="flex flex-col items-start gap-1">
          <OnlinePill />
          {isCurrent && (
            <span className="pl-1 text-[9.5px] font-bold tracking-[0.8px] text-[#60a5fa] uppercase lt:text-blue-600">
              This device
            </span>
          )}
        </div>
      </td>

      <td className="px-2.5 py-3 2xl:px-4">
        <div className="flex items-center gap-3">
          <Avatar role={role} />
          <span className="text-[13px] font-semibold whitespace-nowrap text-fg">
            {name} <span className="text-[#cbd5e1]/80 lt:text-slate-500">({role})</span>
          </span>
        </div>
      </td>

      {/* OS mark, "Windows (Chrome)", then the browser mark, as in the
          design. The label is capped so a long agent cannot widen the column. */}
      <td className="px-2.5 py-3 2xl:px-4">
        <div title={device.device} className="flex items-center gap-2.5">
          <OsIcon os={parsed.os} className="size-[18px] shrink-0" />
          <span className="max-w-[150px] truncate text-[13px] whitespace-nowrap text-fg 2xl:max-w-[190px]">
            {parsed.osLabel}{" "}
            <span className="text-muted max-2xl:sr-only">({parsed.browserLabel})</span>
          </span>
          <BrowserIcon browser={parsed.browser} className="size-[18px] shrink-0" />
        </div>
      </td>

      <td className="px-2.5 py-3 2xl:px-4">
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-4 shrink-0 text-[#93c5fd] lt:text-blue-500" />
          <span
            title={device.ip}
            className="max-w-[116px] truncate font-mono text-[12.5px] whitespace-nowrap text-[#cbd5e1] 2xl:max-w-none lt:text-slate-700"
          >
            {device.ip}
          </span>
          <button
            type="button"
            onClick={copyIp}
            title="Copy IP"
            aria-label={`Copy IP ${device.ip}`}
            className={cn(
              "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#93c5fd]/70",
              "transition-all duration-200 hover:bg-[rgba(59,130,246,0.18)] hover:text-white active:scale-90",
              "lt:text-blue-500/70 lt:hover:bg-blue-50 lt:hover:text-blue-700",
            )}
          >
            {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
          </button>
        </div>
      </td>

      <td className="px-2.5 py-3 2xl:px-4">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(96,165,250,0.3)] max-xl:hidden bg-[rgba(59,130,246,0.12)] text-[#93c5fd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] lt:border-blue-200 lt:bg-blue-50 lt:text-blue-600 lt:shadow-none">
            <CalendarIcon className="size-3.5" />
          </span>
          <div>
            <div className="text-[12.5px] text-fg">{stamp.date}</div>
            <div className="text-[11px] text-muted">{stamp.time}</div>
          </div>
        </div>
      </td>

      <td className="px-2.5 py-3 2xl:px-4">
        <div className="flex flex-nowrap items-center gap-2">
          {isCurrent ? (
            <span className="min-w-[72px] text-[12px] font-bold text-[#60a5fa] 2xl:min-w-[84px] lt:text-blue-600">Active</span>
          ) : (
            <KickButton onClick={() => onKick(device.sessionId, name)} />
          )}
          <MoreMenu
            items={[
              { label: "Copy IP", icon: CopyIcon, onSelect: copyIp },
              ...(isCurrent
                ? []
                : [
                    {
                      label: "Ban IP",
                      icon: WifiOffIcon,
                      danger: true,
                      title: `Block ${device.ip} from the panel`,
                      onSelect: () => onBlock([{ scope: "ip", value: device.ip }], `IP ${device.ip}`, name),
                    },
                    {
                      label: "Ban HWID",
                      icon: CpuChipIcon,
                      danger: true,
                      disabled: !hasDeviceId,
                      title: hasDeviceId
                        ? "Block this machine from the panel"
                        : "This session predates device tracking -- it will get an ID on next sign-in",
                      onSelect: () => onBlock(deviceRules(device), "this device (HWID)", name),
                    },
                  ]),
            ]}
          />
        </div>
      </td>
    </tr>
  );
}

/** Glossy green pill; a ring keeps leaving the dot so the row reads as live. */
function OnlinePill() {
  return (
    <span
      className={cn(
        "inline-flex w-max items-center gap-2 rounded-full border px-3 py-1",
        "text-[10.5px] font-extrabold tracking-[0.8px] whitespace-nowrap uppercase",
        "border-[rgba(52,211,153,0.45)] text-[#6ee7b7]",
        "bg-[linear-gradient(180deg,rgba(16,185,129,0.3),rgba(16,185,129,0.1))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_4px_rgba(0,0,0,0.25),0_0_14px_rgba(16,185,129,0.3)]",
        "lt:border-emerald-300 lt:bg-none lt:bg-emerald-50 lt:text-emerald-700 lt:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span aria-hidden className="animate-status-ping absolute inset-0 rounded-full bg-[#34d399]" />
        <span className="relative size-2 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399] lt:bg-emerald-500 lt:shadow-none" />
      </span>
      Online
    </span>
  );
}

const AVATAR_STYLE: Record<Role, React.CSSProperties> = {
  OWNER: {
    background: "radial-gradient(circle at 32% 28%, #dbeafe 0%, #60a5fa 24%, #2563eb 58%, #1e3a8a 100%)",
    boxShadow:
      "inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.45), 0 0 14px rgba(59,130,246,0.5)",
  },
  RESELLER: {
    background: "radial-gradient(circle at 32% 28%, #ede9fe 0%, #a78bfa 24%, #7c3aed 58%, #4c1d95 100%)",
    boxShadow:
      "inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.45), 0 0 14px rgba(139,92,246,0.5)",
  },
};

/** A lit sphere rather than a flat circle: highlight up-left, shade down-right. */
function Avatar({ role }: { role: Role }) {
  return (
    <span
      style={AVATAR_STYLE[role]}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 ease-back group-hover/row:scale-110 group-hover/row:-rotate-6"
    >
      <UserIcon className="size-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
    </span>
  );
}

/** Raised red pill that sinks onto its own shadow when pressed. */
function KickButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-w-[72px] cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 2xl:min-w-[84px] 2xl:px-4",
        "text-[12px] font-bold whitespace-nowrap text-[#ffe4e6] select-none",
        "border-[rgba(251,113,133,0.6)] bg-[linear-gradient(180deg,rgba(244,63,94,0.42),rgba(190,18,60,0.3))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_3px_0_rgba(136,19,55,0.85),0_0_16px_rgba(244,63,94,0.4)]",
        "transition-all duration-150 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_3px_0_rgba(136,19,55,0.85),0_0_24px_rgba(244,63,94,0.65)]",
        "active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_0_rgba(136,19,55,0.85),0_0_10px_rgba(244,63,94,0.4)]",
        "lt:border-rose-300 lt:bg-none lt:bg-rose-50 lt:text-rose-600",
        "lt:shadow-[inset_0_1px_0_#fff,0_3px_0_rgba(225,29,72,0.28)] lt:hover:shadow-[inset_0_1px_0_#fff,0_3px_0_rgba(225,29,72,0.28),0_0_14px_rgba(244,63,94,0.25)]",
        "lt:active:shadow-[inset_0_1px_0_#fff,0_0_0_rgba(225,29,72,0.28)]",
      )}
    >
      <BanIcon className="size-3" />
      Kick
    </button>
  );
}

interface MenuItem {
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

const MENU_W = 176;
const MENU_H_ESTIMATE = 140;

/**
 * The row's overflow menu. Portalled with fixed coordinates because the
 * table sits in a sideways-scrolling box, which would clip a menu
 * dropped from the bottom rows; it flips upward near the viewport edge
 * and closes on any scroll, resize, outside click or Escape.
 */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8));
    const below = rect.bottom + 6;
    const top = below + MENU_H_ESTIMATE > window.innerHeight ? rect.top - 6 - MENU_H_ESTIMATE : below;
    setPos({ top: Math.max(8, top), left });
  };

  // Snap the flipped menu to its real height once it has rendered.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!menu || !rect || !pos || pos.top >= rect.bottom) return;
    const top = Math.max(8, rect.top - 6 - menu.offsetHeight);
    if (top !== pos.top) setPos({ ...pos, top });
  }, [pos]);

  // Closing unmounts whatever item had focus; hand it back to the button
  // or a keyboard user lands at the top of the page.
  const closeToButton = () => {
    setPos(null);
    buttonRef.current?.focus();
  };

  // The menu is portalled to the end of <body>, so Tab alone would never
  // reach it: focus moves in on open, and the arrows move between items.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        setPos(null);
        buttonRef.current?.focus();
        return;
      }
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []),
      ];
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "ArrowDown"
          ? items[(at + 1) % items.length]
          : event.key === "ArrowUp"
            ? items[(at - 1 + items.length) % items.length]
            : event.key === "Home"
              ? items[0]
              : event.key === "End"
                ? items[items.length - 1]
                : null;
      if (next) {
        event.preventDefault();
        next.focus();
      }
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setPos(null) : place())}
        className={cn(
          "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[#bfdbfe]",
          "border-[rgba(96,165,250,0.4)] bg-[rgba(59,130,246,0.12)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_10px_rgba(59,130,246,0.25)]",
          "transition-all duration-200 hover:border-[rgba(147,197,253,0.7)] hover:bg-[rgba(59,130,246,0.22)] hover:text-white active:scale-90",
          // lt:hover:text-* is needed: hover:text-white outranks lt:text-*
          // (the lt: variant adds no specificity) and vanished on blue-50.
          "lt:border-blue-200 lt:bg-white lt:text-blue-600 lt:shadow-[0_1px_3px_rgba(15,23,42,0.08)] lt:hover:bg-blue-50 lt:hover:text-blue-700",
          open && "border-[rgba(147,197,253,0.8)] bg-[rgba(59,130,246,0.25)] text-white lt:bg-blue-50 lt:text-blue-700",
        )}
      >
        <MoreHorizontalIcon className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            className={cn(
              "animate-dropdown-fade fixed z-[1000] overflow-hidden rounded-xl border p-1.5",
              "border-[rgba(96,165,250,0.3)] bg-[rgba(8,15,40,0.94)] backdrop-blur-[20px]",
              "shadow-[0_18px_40px_rgba(0,0,0,0.55),0_0_20px_rgba(59,130,246,0.2)]",
              "lt:border-slate-200 lt:bg-white/95 lt:shadow-[0_18px_40px_rgba(15,23,42,0.15)]",
            )}
          >
            {items.map(({ label, icon: Icon, onSelect, danger, disabled, title }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                title={title}
                disabled={disabled}
                onClick={() => {
                  closeToButton();
                  onSelect();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold",
                  "transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  danger
                    ? "text-[#fda4af] hover:bg-[rgba(244,63,94,0.14)] lt:text-rose-600 lt:hover:bg-rose-50"
                    : "text-[#dbeafe] hover:bg-[rgba(59,130,246,0.16)] lt:text-slate-700 lt:hover:bg-blue-50",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
