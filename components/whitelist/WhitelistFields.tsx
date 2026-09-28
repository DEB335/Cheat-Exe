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
        leftIcon={<CalendarIcon />}
        leftIconStyle="tile"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={`Days (1-${MAX_WHITELIST_DAYS}, 0 = Lifetime)`}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={!valid}
        aria-describedby={noteId}
      />

      {/* A value no preset holds (a custom 12) lights none of them. */}
      <NeonSegmented
        options={PRESETS}
        value={valid ? wanted : null}
        onChange={(preset) => onChange(String(preset))}
        size="xs"
        aria-label="Duration presets"
        className="mt-3 gap-1.5"
      />

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
