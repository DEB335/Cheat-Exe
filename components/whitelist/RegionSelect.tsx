"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { NeonHelp, NeonLabel } from "@/components/neon";
import { WHITELIST_REGIONS, type WhitelistRegion } from "@/lib/packages";
import { cn } from "@/lib/utils";

interface RegionSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  help?: React.ReactNode;
  className?: string;
  required?: boolean;
}

export function RegionSelect({
  id = "wl-region",
  label = "Server Region *",
  value,
  onChange,
  help,
  className,
}: RegionSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRegion =
    WHITELIST_REGIONS.find((r) => r.code === value) ?? WHITELIST_REGIONS[0];

  // Close on click outside or escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative min-w-0", open ? "z-50" : "z-10", className)}>
      {label && <NeonLabel htmlFor={id}>{label}</NeonLabel>}

      {/* Select Trigger Box */}
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "relative flex h-[54px] min-w-0 cursor-pointer items-center justify-between rounded-[12px] border px-4 outline-none select-none backdrop-blur-xl",
          "border-[rgba(255,45,90,0.25)] bg-[linear-gradient(180deg,rgba(22,4,10,0.7),rgba(14,2,7,0.8))]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_10px_22px_-16px_rgba(0,0,0,0.9)]",
          "transition-all duration-300 ease-smooth",
          open
            ? "border-[rgba(255,45,90,0.9)] shadow-[0_0_0_3px_rgba(255,45,90,0.2),0_0_20px_rgba(255,31,90,0.38)]"
            : "hover:border-[rgba(255,60,110,0.6)] focus:border-[rgba(255,45,90,0.8)] focus:shadow-[0_0_0_3px_rgba(255,45,90,0.18)]",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <span className="font-mono text-[14px] font-bold text-[#ff8ba7]">
            {selectedRegion.code}
          </span>
          <span className="text-white/40 select-none">-</span>
          <span className="font-semibold text-[15px] text-white tracking-wide truncate">
            {selectedRegion.label}
          </span>
        </div>

        <ChevronDownIcon
          className={cn(
            "size-[18px] shrink-0 text-[#ff8ba7] transition-transform duration-300 ease-smooth ml-2",
            open && "rotate-180 text-white",
          )}
        />
      </div>

      {/* Broad, Tall Animated Dropdown Menu */}
      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-[100] max-h-[380px] overflow-y-auto rounded-2xl p-2",
            "border border-[rgba(255,45,90,0.35)] bg-[linear-gradient(180deg,rgba(24,5,12,0.98),rgba(12,2,6,0.99))]",
            "shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(255,31,90,0.25)] backdrop-blur-2xl",
            "animate-in fade-in-0 zoom-in-95 duration-200 ease-smooth",
            "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,45,90,0.35)]",
          )}
        >
          {WHITELIST_REGIONS.map((r) => {
            const isSelected = r.code === selectedRegion.code;
            return (
              <div
                key={r.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(r.code);
                  setOpen(false);
                }}
                className={cn(
                  "group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 select-none transition-all duration-200",
                  isSelected
                    ? "border border-[rgba(255,45,90,0.45)] bg-[linear-gradient(90deg,rgba(255,45,90,0.28),rgba(255,45,90,0.08))] text-white shadow-[0_0_14px_rgba(255,45,90,0.25)]"
                    : "text-[#cbd5e1] hover:bg-[rgba(255,45,90,0.14)] hover:text-white",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[13.5px] font-bold text-[#ff8ba7] shrink-0">
                    {r.code}
                  </span>
                  <span className="text-white/40 select-none">-</span>
                  <span className="font-semibold text-[14.5px] tracking-wide text-white">
                    {r.label}
                  </span>
                </div>

                {isSelected && (
                  <CheckIcon
                    className="size-4 shrink-0 text-[#ff2a55] drop-shadow-[0_0_6px_rgba(255,42,85,0.7)]"
                    strokeWidth={3}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {help && <NeonHelp>{help}</NeonHelp>}
    </div>
  );
}
