import { CheckIcon } from "@/components/icons";
import { PackageIcon, packageTone, toneVars } from "@/components/neon";
import { cn } from "@/lib/utils";

/**
 * A license package in the generator's picker: a slab of coloured glass
 * in the package's own tone (packageTone), its glyph lit white in the
 * corner, the name, and the description the license API sends with it.
 *
 * Replaces PackageCard here only -- that one is shared, and the reseller
 * forms still use it. The behaviour is the same: a plain button that
 * reports a click, lifted with the red glow ring running round it while
 * selected, and doing the same on hover while not.
 *
 * The top-right corner carries the selection mark: a check badge on the
 * chosen tile, so which package is going to be generated does not rest on
 * colour alone, and a faint copy of the glyph on the others.
 *
 * The live license API describes most packages as just their name plus
 * "Package" ("BASIC PANEL Package"). Printed under the name that says
 * nothing new and wraps to two cramped lines at six tiles a row, so a
 * description is shown only when it adds something to the name.
 */
export function PackageTile({
  name,
  description,
  selected,
  onSelect,
}: {
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const said = description.trim();
  const restates = [name, `${name} package`].some((s) => s.toLowerCase() === said.toLowerCase());
  const detail = restates ? "" : said;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={toneVars(packageTone(name))}
      className={cn(
        "glow-ring group/tile relative flex min-h-[124px] min-w-0 cursor-pointer flex-col items-start rounded-[16px] border-[1.5px] px-3.5 pt-4 pb-3.5 text-left",
        "transition-[translate,scale,box-shadow,border-color,filter] duration-300 ease-smooth",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--tone-hi))]",
        // The glass: a gloss over the top half, the tone pooled bright in
        // the lit top-left corner and sinking toward the panel's navy, all
        // over an opaque base so white text holds up whatever the video
        // behind is doing.
        "[background:linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,255,255,0.16),rgba(255,255,255,0)_55%),linear-gradient(150deg,rgba(var(--tone),0.86)_0%,rgba(var(--tone),0.52)_52%,rgba(var(--tone),0.3)_100%),#0b0e30]",
        "lt:[background:linear-gradient(150deg,rgba(var(--tone),0.2),rgba(var(--tone),0.06)),#fff]",
        selected
          ? [
              "glow-ring-on -translate-y-1 scale-[1.02] border-[rgba(255,255,255,0.85)] brightness-110",
              "shadow-[0_0_0_1px_rgba(var(--tone-hi),0.6),0_0_26px_-2px_rgba(var(--tone),0.95),0_14px_28px_-14px_rgba(var(--tone),0.9),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_22px_rgba(var(--tone-hi),0.25)]",
              "lt:border-[rgb(var(--tone))] lt:shadow-[0_10px_22px_-12px_rgba(var(--tone),0.8),0_0_0_1px_rgba(var(--tone),0.5)]",
            ]
          : [
              "border-[rgba(var(--tone-hi),0.7)]",
              "shadow-[0_0_20px_-6px_rgba(var(--tone),0.85),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_18px_rgba(var(--tone-hi),0.16)]",
              "hover:glow-ring-on hover:-translate-y-1 hover:border-[rgb(var(--tone-hi))]",
              "hover:shadow-[0_0_24px_-4px_rgba(var(--tone),0.9),0_12px_24px_-14px_rgba(var(--tone),0.9),inset_0_1px_0_rgba(255,255,255,0.24),inset_0_0_20px_rgba(var(--tone),0.2)]",
              "lt:border-[rgba(var(--tone),0.45)] lt:shadow-[0_2px_8px_-4px_rgba(var(--tone),0.4)]",
              "lt:hover:border-[rgb(var(--tone))] lt:hover:shadow-[0_10px_20px_-12px_rgba(var(--tone),0.7)]",
            ],
      )}
    >
      <PackageIcon
        name={name}
        className={cn(
          "mb-3 size-[26px] shrink-0 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.75)]",
          "transition-transform duration-300 ease-smooth group-hover/tile:scale-110",
          "lt:text-[var(--tone-lt)] lt:drop-shadow-none",
        )}
      />

      {selected ? (
        <span
          aria-hidden
          className="absolute top-2.5 right-2.5 flex size-[22px] items-center justify-center rounded-full border border-white/90 text-white shadow-[0_0_12px_rgba(var(--tone-hi),0.95)] [background:linear-gradient(145deg,var(--tone-a),var(--tone-b))] lt:shadow-none"
        >
          <CheckIcon className="size-3" strokeWidth={3.2} />
        </span>
      ) : (
        <PackageIcon
          name={name}
          className="absolute top-3 right-3 size-4 text-white opacity-25 transition-opacity duration-300 group-hover/tile:opacity-50 lt:text-[var(--tone-lt)]"
        />
      )}

      {/* The words sit on the tile's floor (mt-auto), in a block held
          open for a name line and a description line (38px), so the
          names in a row line up whether or not each tile has one. */}
      <span className="mt-auto flex min-h-[38px] w-full flex-col">
        <span className="font-display text-[13.5px] leading-tight font-bold break-words text-white uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] lt:text-slate-900 lt:[text-shadow:none]">
          {name}
        </span>
        {detail ? (
          // Clamped to keep the row even; the title still has all of it.
          <span
            title={detail}
            className="mt-1 line-clamp-2 text-[12.5px] leading-snug font-medium text-white/80 lt:text-slate-600"
          >
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}
