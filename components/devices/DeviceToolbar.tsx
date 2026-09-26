"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, CloseIcon, FilterIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type RoleFilter = "all" | "OWNER" | "RESELLER";

const OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "All accounts" },
  { value: "OWNER", label: "Owner" },
  { value: "RESELLER", label: "Reseller" },
];

/** Neon-blue glass shared by the search field and the filter button. */
const GLASS = cn(
  "border border-[rgba(59,130,246,0.55)] backdrop-blur-md",
  "bg-[linear-gradient(180deg,rgba(12,24,64,0.78),rgba(5,11,36,0.88))]",
  "shadow-[0_0_14px_-4px_rgba(59,130,246,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
  "transition-[border-color,box-shadow,background-color] duration-300 ease-smooth",
  "lt:border-blue-300 lt:bg-none lt:bg-white lt:shadow-[0_6px_16px_-10px_rgba(59,130,246,0.55)]",
);

/** Search and role filter above the live devices table. Both are controlled. */
export function DeviceToolbar({
  query,
  onQuery,
  role,
  onRole,
  className,
}: {
  query: string;
  onQuery: (q: string) => void;
  role: RoleFilter;
  onRole: (r: RoleFilter) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Closing unmounts the focused option; hand focus back to the button
  // or a keyboard user is dropped at the top of the page.
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = role !== "all";

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {/* The input's backdrop blur makes it its own layer, painted over
          anything before it -- the icon and clear button sit above on z. */}
      <div className="relative min-w-0 flex-1">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-[#8ec5ff] drop-shadow-[0_0_5px_rgba(59,130,246,0.7)] lt:text-blue-500 lt:drop-shadow-none"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) onQuery("");
          }}
          placeholder="Search by user, IP or device…"
          aria-label="Search devices by user, IP or device"
          className={cn(
            GLASS,
            "h-11 w-full rounded-xl pr-9 pl-10 text-[13.5px] text-fg outline-none",
            "placeholder:text-[#8fa6d6] lt:placeholder:text-muted",
            "focus:border-[rgba(96,165,250,0.95)]",
            "focus:shadow-[0_0_0_3px_rgba(59,130,246,0.2),0_0_22px_-2px_rgba(59,130,246,0.8),inset_0_1px_0_rgba(255,255,255,0.09)]",
            "lt:focus:border-blue-500 lt:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]",
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQuery("")}
            className="absolute top-1/2 right-2.5 z-[1] flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#8fa6d6] transition-colors hover:bg-white/8 hover:text-white lt:text-muted lt:hover:bg-black/5 lt:hover:text-fg"
          >
            <CloseIcon className="size-3.5" />
          </button>
        )}
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={filtered ? `Filter by role (showing ${role.toLowerCase()} only)` : "Filter by role"}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            GLASS,
            "relative flex size-11 cursor-pointer items-center justify-center rounded-xl text-[#8ec5ff]",
            "hover:border-[rgba(96,165,250,0.95)] hover:text-white",
            "hover:shadow-[0_0_20px_-2px_rgba(59,130,246,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]",
            "active:translate-y-px lt:text-blue-600 lt:hover:border-blue-500 lt:hover:text-blue-700",
            (open || filtered) && "border-[rgba(96,165,250,0.95)] text-white lt:border-blue-500 lt:text-blue-700",
          )}
        >
          <FilterIcon className="size-[17px] drop-shadow-[0_0_5px_rgba(59,130,246,0.7)] lt:drop-shadow-none" />
          {filtered && (
            <span
              aria-hidden
              className="absolute top-2 right-2 size-2 rounded-full bg-[#60a5fa] shadow-[0_0_8px_rgba(96,165,250,0.95)] lt:bg-blue-500 lt:shadow-none"
            />
          )}
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Show sessions for"
            className={cn(
              "animate-dropdown-fade absolute top-[calc(100%+10px)] right-0 z-[100] flex w-[190px] flex-col gap-0.5",
              "rounded-2xl border border-white/8 bg-[rgba(10,15,30,0.85)] p-1.5",
              "shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-[40px]",
              "lt:border-black/6 lt:bg-white/90 lt:shadow-[0_10px_35px_rgba(0,0,0,0.1)]",
            )}
          >
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-extrabold tracking-[1.2px] text-muted uppercase">
              Show
            </div>
            {OPTIONS.map((option) => {
              const active = option.value === role;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onRole(option.value);
                    close();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium",
                    "text-fg transition-colors hover:bg-white/6 lt:hover:bg-black/5",
                    active && "text-[#60a5fa] lt:text-blue-600",
                  )}
                >
                  {option.label}
                  {active && <CheckIcon className="size-3.5" strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
