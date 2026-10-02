import { CheckIcon } from "@/components/icons";
import { PackageIcon, TONES, packageTone, toneVars } from "@/components/neon";
import { cn } from "@/lib/utils";

/**
 * The chosen tile used to be lit with `filter: brightness(1.1)`. A filter
 * on the tile re-renders it, ring and all, whenever anything on it moves,
 * so the same lift is baked into its colours instead, each multiplied by
 * 1.1 and clipped as the filter did:
 * - the tone, its bright cut and the badge's stops, for the glows, the
 *   border and the badge, which paint each colour on its own;
 * - the fill, which the filter brightened after the tone had been laid
 *   over the navy base (a tone channel near 255 has no room to brighten
 *   on its own), as opaque stops mixed here: --fill-0/1/2 in dark mode
 *   and --fill-lt-0..4 in light, where five stops follow the brightened
 *   fill as it clips to white partway across. The white gloss over the
 *   dark fill is stronger to match (0.1 -> 0.12, 0.16 -> 0.19, checked
 *   against screenshots of the filtered tile).
 */
const lift = (n: number) => Math.min(255, Math.round(n * 1.1));
const channels = (rgb: string) => rgb.split(",").map(Number);
const liftRgb = (rgb: string) => channels(rgb).map(lift).join(", ");
const liftHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${lift(n >> 16)}, ${lift((n >> 8) & 255)}, ${lift(n & 255)})`;
};
/** The tone at `alpha` over an opaque base, then brightened. */
const liftOver = (rgb: string, alpha: number, base: number[]) =>
  channels(rgb)
    .map((c, i) => lift(c * alpha + base[i] * (1 - alpha)))
    .join(", ");
const NAVY = [11, 14, 48]; // #0b0e30, the tile's base
const WHITE = [255, 255, 255];

function selectedVars(name: string): React.CSSProperties {
  const tone = TONES[packageTone(name)];
  return {
    "--tone": liftRgb(tone.rgb),
    "--tone-hi": liftRgb(tone.hi),
    "--tone-a": liftHex(tone.ink[0]),
    "--tone-b": liftHex(tone.ink[1]),
    "--tone-lt": liftHex(tone.lt),
    "--fill-0": liftOver(tone.rgb, 0.86, NAVY),
    "--fill-1": liftOver(tone.rgb, 0.52, NAVY),
    "--fill-2": liftOver(tone.rgb, 0.3, NAVY),
    // The light fill runs from the tone at 20% to 6% over white.
    ...Object.fromEntries(
      [0, 1, 2, 3, 4].map((i) => [`--fill-lt-${i}`, liftOver(tone.rgb, 0.2 - 0.035 * i, WHITE)]),
    ),
  } as React.CSSProperties;
}

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
      style={selected ? { ...toneVars(packageTone(name)), ...selectedVars(name) } : toneVars(packageTone(name))}
      className={cn(
        "glow-ring group/tile relative flex min-h-[124px] min-w-0 cursor-pointer flex-col items-start rounded-[16px] border-[1.5px] px-3.5 pt-4 pb-3.5 text-left",
        "transition-[translate,scale,box-shadow,border-color] duration-300 ease-smooth",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--tone-hi))]",
        // The glass: a gloss over the top half, the tone pooled bright in
        // the lit top-left corner and sinking toward the panel's navy, all
        // over an opaque base so white text holds up on any backdrop. The
        // chosen tile's is the same, 10% brighter (see selectedVars). The
        // glows round it are about half what they were (owner: "too
        // glowing"), hover and selected no more than ~1.4x the resting one.
        selected
          ? [
              "[background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,255,255,0.19),rgba(255,255,255,0)_55%),linear-gradient(150deg,rgb(var(--fill-0))_0%,rgb(var(--fill-1))_52%,rgb(var(--fill-2))_100%)]",
              "lt:[background:linear-gradient(150deg,rgb(var(--fill-lt-0)),rgb(var(--fill-lt-1)),rgb(var(--fill-lt-2)),rgb(var(--fill-lt-3)),rgb(var(--fill-lt-4)))]",
            ]
          : [
              "[background:linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,255,255,0.16),rgba(255,255,255,0)_55%),linear-gradient(150deg,rgba(var(--tone),0.86)_0%,rgba(var(--tone),0.52)_52%,rgba(var(--tone),0.3)_100%),#0b0e30]",
              "lt:[background:linear-gradient(150deg,rgba(var(--tone),0.2),rgba(var(--tone),0.06)),#fff]",
            ],
        selected
          ? [
              "glow-ring-on -translate-y-1 scale-[1.02] border-[rgba(255,255,255,0.95)]",
              "shadow-[0_0_0_1px_rgba(var(--tone-hi),0.6),0_0_16px_-1px_rgba(var(--tone),0.43),0_8px_17px_-8px_rgba(var(--tone),0.4),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_22px_rgba(var(--tone-hi),0.13)]",
              "lt:border-[rgb(var(--tone))] lt:shadow-[0_6px_13px_-7px_rgba(var(--tone),0.36),0_0_0_1px_rgba(var(--tone),0.5)]",
            ]
          : [
              "border-[rgba(var(--tone-hi),0.7)]",
              "shadow-[0_0_12px_-4px_rgba(var(--tone),0.38),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_18px_rgba(var(--tone-hi),0.08)]",
              "hover:glow-ring-on hover:-translate-y-1 hover:border-[rgb(var(--tone-hi))]",
              "hover:shadow-[0_0_14px_-2px_rgba(var(--tone),0.41),0_7px_14px_-8px_rgba(var(--tone),0.41),inset_0_1px_0_rgba(255,255,255,0.24),inset_0_0_20px_rgba(var(--tone),0.1)]",
              "lt:border-[rgba(var(--tone),0.45)] lt:shadow-[0_1px_5px_-2px_rgba(var(--tone),0.18)]",
              "lt:hover:border-[rgb(var(--tone))] lt:hover:shadow-[0_6px_12px_-7px_rgba(var(--tone),0.25)]",
            ],
      )}
    >
      <PackageIcon
        name={name}
        className={cn(
          "mb-3 size-[26px] shrink-0 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]",
          "transition-transform duration-300 ease-smooth group-hover/tile:scale-110",
          "lt:text-[var(--tone-lt)] lt:drop-shadow-none",
        )}
      />

      {selected ? (
        <span
          aria-hidden
          className="absolute top-2.5 right-2.5 flex size-[22px] items-center justify-center rounded-full border border-white/90 text-white shadow-[0_0_7px_rgba(var(--tone-hi),0.43)] [background:linear-gradient(145deg,var(--tone-a),var(--tone-b))] lt:shadow-none"
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
            className={cn(
              "mt-1 line-clamp-2 text-[12.5px] leading-snug font-medium",
              // The chosen tile's: white/80 and slate-600, 10% brighter.
              selected ? "text-white/90 lt:text-[rgb(78,94,116)]" : "text-white/80 lt:text-slate-600",
            )}
          >
            {detail}
          </span>
        ) : null}
      </span>

      {/* The red ring, turned by the compositor (see glow-ring in globals.css). */}
      <span aria-hidden className="glow-ring-track" />
    </button>
  );
}
