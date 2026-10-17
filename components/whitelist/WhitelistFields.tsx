"use client";

import { CalendarIcon } from "@/components/icons";
import {
  AlertTriangleIcon,
  CrownIcon,
  InfoIcon,
  NeonHelp,
  NeonInput,
  NeonSegmented,
  type SegmentOption,
} from "@/components/neon";
import {
  LIFETIME_WHITELIST_DAYS,
  MAX_WHITELIST_DAYS,
  WHITELIST_DAY_PRESETS,
  WHITELIST_REGIONS,
  isWhitelistDays,
  whitelistDaysLabel,
} from "@/lib/packages";
import { cn } from "@/lib/utils";

import { wantedDays } from "./whitelist-shared";

export function RegionOptions() {
  return (
    <>
      {WHITELIST_REGIONS.map((region) => (
        <option key={region.code} value={region.code}>
          {region.label} ({region.code})
        </option>
      ))}
    </>
  );
}

/** Lifetime wears amber and a crown even when not chosen, so it reads as the premium sale. */
const PRESETS: SegmentOption<number>[] = WHITELIST_DAY_PRESETS.map((preset) =>
  preset === LIFETIME_WHITELIST_DAYS
    ? { value: preset, label: "Lifetime (0)", icon: <CrownIcon />, tone: "amber" }
    : { value: preset, label: whitelistDaysLabel(preset) },
);

/**
 * The validity picker: a free days field with one-tap presets under it.
 *
 * The field stays the source of truth -- a preset only writes into it --
 * so a custom count like 12 is as easy as a listed one, and what is
 * sent is always what is on screen. 0 is lifetime, and typing it is the
 * same as pressing the Lifetime chip.
 */
export function DurationField({
  id,
  label,
  value,
  onChange,
  note,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  className?: string;
}) {
  const wanted = wantedDays(value);
  const valid = isWhitelistDays(wanted);
  const lifetime = valid && wanted === LIFETIME_WHITELIST_DAYS;
  // Under the presets rather than under the box, so the field's own
  // help slot stays empty and this is tied to the input by hand.
  const noteId = `${id}-note`;

  return (
    <div className={className}>
      <NeonInput
        id={id}
        tone="red"
        // Phones drop the "(Custom Days)" tail: beside the read-out it
        // wraps the label onto two cramped lines, and the box's own
        // placeholder already asks for days.
        label={
          <>
            {label}
            <span className="max-sm:hidden"> (Custom Days)</span>
          </>
        }
        labelAside={
          <span
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap [&>svg]:size-3.5",
              !valid
                ? "text-[#ff8aa0] lt:text-rose-600"
                : lifetime && "text-[#fdd680] lt:text-amber-700",
            )}
          >
            {valid ? (
              <>
                {lifetime ? <CrownIcon /> : <CalendarIcon />}
                {whitelistDaysLabel(wanted)}
              </>
            ) : (
              "Invalid"
            )}
          </span>
        }
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={`Days (1-${MAX_WHITELIST_DAYS}, 0 = Lifetime)`}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={!valid}
        aria-describedby={noteId}
      />

      {/* A value no preset holds (a custom 12) lights none of them. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {WHITELIST_DAY_PRESETS.map((preset) => {
          const on = valid && wanted === preset;
          const isLifetime = preset === LIFETIME_WHITELIST_DAYS;
          const label = isLifetime
            ? "Lifetime (0)"
            : `${preset} ${preset === 1 ? "Day" : "Days"}`;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(String(preset))}
              className={cn(
                "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border px-3 text-[12px] font-bold tracking-[0.8px] whitespace-nowrap uppercase select-none",
                "transition-[translate,scale,background-color,border-color,box-shadow,color] duration-200 ease-smooth",
                "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96]",
                on
                  ? [
                      "border-[#ff0037] text-white",
                      "[background:linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,0,55,0.35),rgba(255,0,55,0)_55%),linear-gradient(150deg,rgba(70,6,20,0.95)_0%,rgba(40,4,12,0.95)_52%,rgba(20,2,6,0.98)_100%)]",
                      "shadow-[0_0_16px_rgba(255,0,55,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]",
                      "lt:border-red-600 lt:[background:rgba(225,29,72,0.15)] lt:text-red-700",
                    ]
                  : [
                      "border-[rgba(255,45,90,0.25)] bg-[rgba(18,2,8,0.7)] text-white/80",
                      "hover:border-[#ff2a55] hover:bg-[rgba(255,45,90,0.12)] hover:text-white",
                      "lt:border-slate-300 lt:bg-white lt:text-slate-600",
                    ],
              )}
            >
              {isLifetime && <CrownIcon className="mr-1.5 size-3.5 text-[#fdd680]" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <NeonHelp id={noteId} error={!valid} className={cn(!valid && "font-semibold")}>
        {valid ? (
          <>
            <InfoIcon />
            {note ?? "Type any custom days (e.g. 5, 12, 45) or pick a button. 0 = Lifetime."}
          </>
        ) : (
          <>
            <AlertTriangleIcon />
            Enter 1 to {MAX_WHITELIST_DAYS} days, or 0 for lifetime.
          </>
        )}
      </NeonHelp>
    </div>
  );
}
